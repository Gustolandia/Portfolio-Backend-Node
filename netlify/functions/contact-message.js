import { contactRateLimitKey, createContactRateLimiter } from "../../src/contact/contactRateLimiter.js";
import { getHeader } from "../../src/http/headers.js";
import { getMethod } from "../../src/http/request.js";

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const POSTMAIL_URL = "https://postmail.invotes.com/send";
const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_REQUEST_HEADERS = "content-type";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 20_000;
const ALLOWED_FIELDS = new Set(["subject", "email", "message", "turnstileToken"]);

const DEFAULT_CONTACT_ORIGINS = Object.freeze([
  "http://localhost:3000",
  "https://gustavopedroricou.netlify.app",
  "https://gustavopedroricou.com",
  "https://www.gustavopedroricou.com"
]);

function contactOrigins() {
  const configured = [
    process.env.CONTACT_ALLOWED_ORIGINS,
    process.env.FRONTEND_ORIGIN
  ]
    .filter(Boolean)
    .flatMap((value) => value.split(","))
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== "*");

  return new Set([...DEFAULT_CONTACT_ORIGINS, ...configured]);
}

function requestOrigin(event = {}) {
  return getHeader(event.headers, "origin")?.trim();
}

function isOriginAllowed(event) {
  const origin = requestOrigin(event);
  return !origin || contactOrigins().has(origin);
}

function corsHeaders(event = {}) {
  const origin = requestOrigin(event);
  const headers = { Vary: "Origin" };

  if (origin && contactOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function response(event, statusCode, body = null, extraHeaders = {}) {
  const headers = {
    ...corsHeaders(event),
    "Cache-Control": "no-store",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  };

  if (body === null) {
    return { statusCode, headers, body: "" };
  }

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function errorResponse(event, statusCode, error, extraHeaders = {}) {
  return response(event, statusCode, { error }, extraHeaders);
}

function isJsonContentType(event) {
  const contentType = getHeader(event.headers, "content-type") || "";
  return contentType.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function requestBody(event) {
  if (!event.body) {
    throw new Error("invalid-body");
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    throw new Error("invalid-body");
  }

  return JSON.parse(body);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const keys = Object.keys(payload);
  if (keys.length !== ALLOWED_FIELDS.size || keys.some((key) => !ALLOWED_FIELDS.has(key))) {
    return null;
  }

  if (Object.values(payload).some((value) => typeof value !== "string")) {
    return null;
  }

  const subject = payload.subject.trim();
  const email = payload.email.trim();
  const message = payload.message.trim();
  const turnstileToken = payload.turnstileToken.trim();

  if (
    subject.length < 1 ||
    subject.length > 200 ||
    /[\r\n]/.test(subject) ||
    email.length < 3 ||
    email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    message.length < 1 ||
    message.length > 5_000 ||
    turnstileToken.length < 1 ||
    turnstileToken.length > 2_048
  ) {
    return null;
  }

  return { subject, email, message, turnstileToken };
}

function configuredTurnstile() {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const action = process.env.TURNSTILE_EXPECTED_ACTION?.trim();
  const hostnames = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);

  if (!secret || !action || hostnames.length === 0 || hostnames.includes("*")) {
    return null;
  }

  return { secret, action, hostnames: new Set(hostnames) };
}

async function fetchWithTimeout(fetchImpl, url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyTurnstile({ fetchImpl, token, configuration }) {
  const body = new URLSearchParams({
    secret: configuration.secret,
    response: token
  });
  let providerResponse;

  try {
    providerResponse = await fetchWithTimeout(fetchImpl, TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });
  } catch {
    return { ok: false, providerFailure: true };
  }

  if (!providerResponse || providerResponse.ok !== true || typeof providerResponse.json !== "function") {
    return { ok: false, providerFailure: true };
  }

  let result;
  try {
    result = await providerResponse.json();
  } catch {
    return { ok: false, providerFailure: true };
  }

  const hostname = typeof result?.hostname === "string"
    ? result.hostname.trim().toLowerCase()
    : "";
  const action = typeof result?.action === "string" ? result.action.trim() : "";
  const hasProviderErrors = Object.hasOwn(result || {}, "error-codes") && (
    !Array.isArray(result["error-codes"]) || result["error-codes"].length > 0
  );

  if (
    result?.success !== true ||
    hasProviderErrors ||
    !hostname ||
    !configuration.hostnames.has(hostname) ||
    action !== configuration.action
  ) {
    return { ok: false, providerFailure: false };
  }

  return { ok: true, providerFailure: false };
}

async function sendPostmail({ fetchImpl, subject, email, message, accessToken }) {
  const body = new URLSearchParams({
    access_token: accessToken,
    subject,
    text: `From: ${email}. Message: ${message}`
  });

  try {
    const providerResponse = await fetchWithTimeout(fetchImpl, POSTMAIL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    return providerResponse?.ok === true;
  } catch {
    return false;
  }
}

function validPreflight(event) {
  const requestedMethod = getHeader(event.headers, "access-control-request-method")?.trim().toUpperCase();
  const requestedHeaders = (getHeader(event.headers, "access-control-request-headers") || "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  return requestedMethod === "POST" && requestedHeaders.every((header) => header === ALLOWED_REQUEST_HEADERS);
}

export function createHandler({
  fetchImpl = globalThis.fetch,
  logger = console,
  rateLimiter = createContactRateLimiter()
} = {}) {
  return async function contactMessageHandler(event = {}) {
    const method = getMethod(event);

    if (method === "OPTIONS") {
      if (!isOriginAllowed(event) || !requestOrigin(event) || !validPreflight(event)) {
        return errorResponse(event, 403, "Forbidden");
      }

      return response(event, 204, null, {
        Allow: ALLOWED_METHODS,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": ALLOWED_METHODS,
        "Access-Control-Max-Age": "600"
      });
    }

    if (!isOriginAllowed(event)) {
      return errorResponse(event, 403, "Forbidden", { Allow: ALLOWED_METHODS });
    }

    if (method !== "POST") {
      return errorResponse(event, 405, "Method Not Allowed", { Allow: ALLOWED_METHODS });
    }

    if (!isJsonContentType(event)) {
      return errorResponse(event, 415, "Unsupported Media Type");
    }

    let payload;
    try {
      payload = validatePayload(requestBody(event));
    } catch {
      payload = null;
    }

    if (!payload) {
      return errorResponse(event, 400, "Invalid request");
    }

    let rateLimitResult;
    try {
      rateLimitResult = await rateLimiter.consume(contactRateLimitKey(event));
    } catch {
      logger.error?.("Contact rate limiter failed");
      return errorResponse(event, 503, "Service unavailable");
    }

    if (!rateLimitResult.allowed) {
      return errorResponse(event, 429, "Too many requests", {
        "Retry-After": String(rateLimitResult.retryAfterSeconds || 900)
      });
    }

    const turnstile = configuredTurnstile();
    const accessToken = process.env.POSTMAIL_ACCESS_TOKEN?.trim();
    if (!turnstile || !accessToken || typeof fetchImpl !== "function") {
      logger.error?.("Contact message configuration is incomplete");
      return errorResponse(event, 503, "Service unavailable");
    }

    const verification = await verifyTurnstile({
      fetchImpl,
      token: payload.turnstileToken,
      configuration: turnstile
    });

    if (!verification.ok) {
      if (verification.providerFailure) {
        logger.error?.("Turnstile provider unavailable");
        return errorResponse(event, 502, "Service unavailable");
      }

      return errorResponse(event, 400, "Unable to verify request");
    }

    if (!(await sendPostmail({
      fetchImpl,
      subject: payload.subject,
      email: payload.email,
      message: payload.message,
      accessToken
    }))) {
      logger.error?.("Postmail delivery failed");
      return errorResponse(event, 502, "Service unavailable");
    }

    return response(event, 200, { ok: true });
  };
}

export const handler = createHandler();
