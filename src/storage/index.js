import { JsonPortfolioStore } from "./jsonPortfolioStore.js";

export function createPortfolioStore(options = {}) {
  return new JsonPortfolioStore(options);
}

export { JsonPortfolioStore };
