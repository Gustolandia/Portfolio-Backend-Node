import assert from "node:assert/strict";
import { test } from "node:test";
import {
  InMemoryLoginRateLimiter,
  RedisLoginRateLimiter,
  loginRateLimitKey
} from "../src/admin/loginRateLimiter.js";

test("login rate limit key uses client IP and email", () => {
  assert.equal(
    loginRateLimitKey(
      {
        headers: {
          "x-forwarded-for": "203.0.113.1, 10.0.0.1"
        }
      },
      "ADMIN@example.com"
    ),
    "admin-login:203.0.113.1:admin@example.com"
  );
});

test("in-memory login rate limiter blocks after the limit", async () => {
  const limiter = new InMemoryLoginRateLimiter({
    limit: 2,
    windowSeconds: 60
  });

  assert.equal((await limiter.consume("key")).allowed, true);
  assert.equal((await limiter.consume("key")).allowed, true);
  assert.equal((await limiter.consume("key")).allowed, false);
});

test("Redis login rate limiter increments and expires the rate limit key", async () => {
  const calls = [];
  const limiter = new RedisLoginRateLimiter({
    limit: 1,
    redis: {
      expire: async (key, seconds) => calls.push(["expire", key, seconds]),
      incr: async (key) => {
        calls.push(["incr", key]);
        return calls.filter(([name]) => name === "incr").length;
      }
    },
    windowSeconds: 30
  });

  assert.equal((await limiter.consume("login")).allowed, true);
  assert.equal((await limiter.consume("login")).allowed, false);
  assert.deepEqual(calls, [
    ["incr", "rate-limit:login"],
    ["expire", "rate-limit:login", 30],
    ["incr", "rate-limit:login"]
  ]);
});
