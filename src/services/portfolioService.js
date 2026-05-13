import { createPortfolioStore } from "../storage/index.js";
import { normalizePortfolioData } from "../validation/portfolioData.js";

export class PortfolioService {
  constructor({ store = createPortfolioStore() } = {}) {
    this.store = store;
  }

  async getPortfolioData() {
    const rawPortfolioData = await this.store.getPortfolioData();

    return normalizePortfolioData(rawPortfolioData);
  }

  async updatePortfolioData(portfolioData) {
    if (typeof this.store.setPortfolioData !== "function") {
      throw new Error("The configured portfolio store does not support writes.");
    }

    const normalizedPortfolioData = normalizePortfolioData(portfolioData);

    await this.store.setPortfolioData(normalizedPortfolioData);

    return normalizedPortfolioData;
  }
}

export function createPortfolioService(options = {}) {
  return new PortfolioService(options);
}
