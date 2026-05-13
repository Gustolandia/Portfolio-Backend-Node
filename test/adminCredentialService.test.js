import assert from "node:assert/strict";
import { test } from "node:test";
import { createAdminCredentialService } from "../src/admin/adminCredentialService.js";

test("admin credential service accepts configured email and password hash", async () => {
  const service = createAdminCredentialService({
    comparePassword: async (password, hash) => password === "secret" && hash === "hash",
    getAdminEmail: () => "admin@example.com",
    getAdminPasswordHash: () => "hash"
  });

  const result = await service.validateCredentials({
    email: "ADMIN@example.com",
    password: "secret"
  });

  assert.equal(result.authenticated, true);
  assert.deepEqual(result.user, {
    email: "admin@example.com"
  });
});

test("admin credential service rejects invalid credentials", async () => {
  const service = createAdminCredentialService({
    comparePassword: async () => false,
    getAdminEmail: () => "admin@example.com",
    getAdminPasswordHash: () => "hash"
  });

  const result = await service.validateCredentials({
    email: "admin@example.com",
    password: "wrong"
  });

  assert.equal(result.authenticated, false);
});
