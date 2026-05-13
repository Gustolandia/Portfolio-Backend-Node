import { Redis } from "@upstash/redis";

export const DEFAULT_PORTFOLIO_REDIS_KEY =
  process.env.PORTFOLIO_REDIS_KEY || "portfolio:data";

function createRedisClient() {
  return Redis.fromEnv();
}

export class RedisPortfolioStore {
  constructor({
    key = DEFAULT_PORTFOLIO_REDIS_KEY,
    redis = createRedisClient()
  } = {}) {
    this.key = key;
    this.redis = redis;
  }

  async getPortfolioData() {
    const data = await this.redis.get(this.key);

    if (!data) {
      return {};
    }

    return data;
  }

  async setPortfolioData(data) {
    await this.redis.set(this.key, data);

    return data;
  }
}
