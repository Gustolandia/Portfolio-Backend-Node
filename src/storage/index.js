import { JsonPortfolioStore } from "./jsonPortfolioStore.js";
import { RedisPortfolioStore } from "./redisPortfolioStore.js";

export function createPortfolioStore(options = {}) {
  const storeType = options.storeType || process.env.PORTFOLIO_STORE || "json";

  if (storeType === "redis") {
    return new RedisPortfolioStore(options);
  }

  return new JsonPortfolioStore(options);
}

export { JsonPortfolioStore };
export { RedisPortfolioStore };
