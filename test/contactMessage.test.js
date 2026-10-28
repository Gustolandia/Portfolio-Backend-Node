import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "../netlify/functions/contact-message.js";

const origin = "https://gustavopedroricou.com";
const originalEnvironment = { ...process.env };

function setEnvironment(overrides = {}) {
  process.env = {
    ...originalEnvironment,
    CONTACT_ALLOWED_ORIGINS: origin,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    TURNSTILE_EXPECTED_ACTION: "contact_message",
    TURNSTILE_ALLOWED_HOSTNAMES: "gustavopedroricou.com",
    POSTMAIL_ACCESS_TOKEN: "postmail-secret",
    ...overrides
  };
}

function restoreEnvironment() {
  process.env = { ...originalEnvironment };
}

function event({ body = validPayload(), headers = {}, method = "POST" } = {}) {
  return {
    body: JSON.stringify(body),
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "x-nf-client-connection-ip": "203.0.113.10",
      ...headers
    },
    httpMethod: method
  };
}

function validPayload() {
  return {
    subject: "Research question",
    email: "visitor@example.com",
    message: "Hello from the contact form.",
    turnstileToken: "token-123"
  };
}

function successfulFetch(calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    if (url.includes("siteverify")) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          hostname: "gustavopedroricou.com",
          action: "contact_message"
        })
      };
    }
    return { ok: true };
  };
}

test.afterEach(() => {
  restoreEnvironment();
});

test("contact-message verifies Turnstile before sending the compatible Postmail payload", async () => {
  setEnvironment();
  const calls = [];
  const response = await createHandler({
    fetchImpl: successfulFetch(calls),
    rateLimiter: { consume: async () => ({ allowed: true }) }
  })(event());

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /turnstile\/v0\/siteverify$/);
  assert.match(calls[0].options.body, /secret=turnstile-secret/);
  assert.match(calls[0].options.body, /response=token-123/);
  assert.equal(calls[1].url, "https://postmail.invotes.com/send");
  assert.match(calls[1].options.body, /access_token=postmail-secret/);
  assert.match(calls[1].options.body, /subject=Research\+question/);
  assert.match(calls[1].options.body, /text=From%3A\+visitor%40example.com/);
});

test("malformed JSON, wrong media type, and invalid payloads are rejected generically", async () => {
  setEnvironment();
  const handler = createHandler({
    fetchImpl: successfulFetch(),
    rateLimiter: { consume: async () => ({ allowed: true }) }
  });

  const malformed = await handler({
    ...event(),
    body: "not-json"
  });
  const wrongType = await handler({
    ...event(),
    headers: { ...event().headers, "Content-Type": "application/x-www-form-urlencoded" }
  });
  const invalid = await handler(event({ body: { ...validPayload(), extra: "nope" } }));

  assert.equal(malformed.statusCode, 400);
  assert.equal(wrongType.statusCode, 415);
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(JSON.parse(invalid.body), { error: "Invalid request" });
});

test("unapproved origins are rejected and preflight is narrow", async () => {
  setEnvironment();
  const handler = createHandler({
    fetchImpl: successfulFetch(),
    rateLimiter: { consume: async () => ({ allowed: true }) }
  });

  const rejected = await handler(event({ headers: { Origin: "https://evil.example.com" } }));
  const preflight = await handler(event({
    method: "OPTIONS",
    body: null,
    headers: {
      "access-control-request-method": "POST",
      "access-control-request-headers": "Content-Type"
    }
  }));
  const broadPreflight = await handler(event({
    method: "OPTIONS",
    body: null,
    headers: {
      "access-control-request-method": "POST",
      "access-control-request-headers": "Authorization, Content-Type"
    }
  }));

  assert.equal(rejected.statusCode, 403);
  assert.equal(rejected.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(preflight.headers["Access-Control-Allow-Methods"], "POST, OPTIONS");
  assert.equal(broadPreflight.statusCode, 403);
});

test("missing backend configuration fails closed without contacting providers", async () => {
  setEnvironment({ TURNSTILE_SECRET_KEY: "", POSTMAIL_ACCESS_TOKEN: "" });
  const calls = [];
  const response = await createHandler({
    fetchImpl: successfulFetch(calls),
    rateLimiter: { consume: async () => ({ allowed: true }) }
  })(event());

  assert.equal(response.statusCode, 503);
  assert.deepEqual(calls, []);
  assert.deepEqual(JSON.parse(response.body), { error: "Service unavailable" });
});

test("bad, expired, replayed, and mismatched Turnstile results never reach Postmail", async () => {
  for (const verification of [
    { success: false, "error-codes": ["invalid-input-response"] },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "evil.example.com", action: "contact_message" },
    { success: true, hostname: "gustavopedroricou.com", action: "other_action" },
    {
      success: true,
      hostname: "gustavopedroricou.com",
      action: "contact_message",
      "error-codes": ["timeout-or-duplicate"]
    }
  ]) {
    setEnvironment();
    const calls = [];
    const response = await createHandler({
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, json: async () => verification };
      },
      rateLimiter: { consume: async () => ({ allowed: true }) }
    })(event());

    assert.equal(response.statusCode, 400);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  }
});

test("Turnstile network and malformed-provider failures fail closed", async () => {
  setEnvironment();
  const network = await createHandler({
    fetchImpl: async () => { throw new Error("provider secret"); },
    rateLimiter: { consume: async () => ({ allowed: true }) }
  })(event());
  const badResponse = await createHandler({
    fetchImpl: async () => ({ ok: false }),
    rateLimiter: { consume: async () => ({ allowed: true }) }
  })(event());

  assert.equal(network.statusCode, 502);
  assert.equal(badResponse.statusCode, 502);
  assert.equal(JSON.parse(network.body).error, "Service unavailable");
});

test("Postmail errors are generic and do not retry delivery", async () => {
  setEnvironment();
  const calls = [];
  const response = await createHandler({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes("siteverify")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            hostname: "gustavopedroricou.com",
            action: "contact_message"
          })
        };
      }
      return { ok: false };
    },
    rateLimiter: { consume: async () => ({ allowed: true }) }
  })(event());

  assert.equal(response.statusCode, 502);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(response.body), { error: "Service unavailable" });
});

test("IP rate limiting blocks before Turnstile and does not use message content in the key", async () => {
  setEnvironment();
  let receivedKey;
  let fetchCalled = false;
  const response = await createHandler({
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true };
    },
    rateLimiter: {
      consume: async (key) => {
        receivedKey = key;
        return { allowed: false, retryAfterSeconds: 42 };
      }
    }
  })(event({ body: { ...validPayload(), message: "do-not-store-this" } }));

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "42");
  assert.equal(fetchCalled, false);
  assert.equal(receivedKey, "contact-message:203.0.113.10");
  assert.equal(receivedKey.includes("do-not-store-this"), false);
});
