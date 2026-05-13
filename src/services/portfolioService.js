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
}

export function createPortfolioService(options = {}) {
  return new PortfolioService(options);
}
