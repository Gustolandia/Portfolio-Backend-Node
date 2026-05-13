import { Redis } from "@upstash/redis";
import { getHeader } from "../http/headers.js";

const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_SECONDS = 15 * 60;

function hasRedisEnvironment() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function getClientIp(event = {}) {
  return (
    getHeader(event.headers, "x-nf-client-connection-ip") ||
    getHeader(event.headers, "x-forwarded-for")?.split(",")[0]?.trim() ||
    getHeader(event.headers, "client-ip") ||
    "unknown"
  );
}

export function loginRateLimitKey(event = {}, email = "") {
  return `admin-login:${getClientIp(event)}:${email.toLowerCase()}`;
}

export class InMemoryLoginRateLimiter {
  constructor({ limit = DEFAULT_LIMIT, windowSeconds = DEFAULT_WINDOW_SECONDS } = {}) {
    this.limit = limit;
    this.windowSeconds = windowSeconds;
    this.attempts = new Map();
  }

  async consume(key) {
    const now = Date.now();
    const current = this.attempts.get(key);

    if (!current || current.expiresAt <= now) {
      const expiresAt = now + this.windowSeconds * 1000;
      this.attempts.set(key, {
        count: 1,
        expiresAt
      });

      return {
        allowed: true,
        remaining: this.limit - 1,
        retryAfterSeconds: this.windowSeconds
      };
    }

    current.count += 1;

    return {
      allowed: current.count <= this.limit,
      remaining: Math.max(this.limit - current.count, 0),
      retryAfterSeconds: Math.ceil((current.expiresAt - now) / 1000)
    };
  }
}

export class RedisLoginRateLimiter {
  constructor({
    limit = DEFAULT_LIMIT,
    redis = Redis.fromEnv(),
    windowSeconds = DEFAULT_WINDOW_SECONDS
  } = {}) {
    this.limit = limit;
    this.redis = redis;
    this.windowSeconds = windowSeconds;
  }

  async consume(key) {
    const namespacedKey = `rate-limit:${key}`;
    const count = await this.redis.incr(namespacedKey);

    if (count === 1) {
      await this.redis.expire(namespacedKey, this.windowSeconds);
    }

    return {
      allowed: count <= this.limit,
      remaining: Math.max(this.limit - count, 0),
      retryAfterSeconds: this.windowSeconds
    };
  }
}

export function createLoginRateLimiter(options = {}) {
  if (options.redis || hasRedisEnvironment()) {
    return new RedisLoginRateLimiter(options);
  }

  return new InMemoryLoginRateLimiter(options);
}
