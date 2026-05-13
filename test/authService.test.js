import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthService } from "../src/auth/authService.js";

test("authenticates requests with the configured API key", async () => {
  const authService = createAuthService({
    getApiKey: () => "test-api-key"
  });

  const result = await authService.authenticateEvent({
    headers: {
      "x-api-key": "test-api-key"
    }
  });

  assert.equal(result.authenticated, true);
  assert.equal(result.principal.type, "api-key");
});

test("rejects missing or invalid authentication credentials", async () => {
  const authService = createAuthService({
    getApiKey: () => "test-api-key"
  });

  const missingResult = await authService.authenticateEvent({
    headers: {}
  });
  const invalidResult = await authService.authenticateEvent({
    headers: {
      "x-api-key": "wrong-key"
    }
  });

  assert.equal(missingResult.authenticated, false);
  assert.equal(invalidResult.authenticated, false);
});

test("issues and verifies admin JWT bearer tokens", async () => {
  const authService = createAuthService({
    getJwtSecret: () => "a-test-secret-that-is-long-enough-for-hs256"
  });

  const token = await authService.issueAdminToken({
    subject: "gustavo"
  });
  const result = await authService.authenticateEvent({
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(result.authenticated, true);
  assert.equal(result.principal.type, "jwt");
  assert.equal(result.principal.subject, "gustavo");
});
