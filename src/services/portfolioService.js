import { createPortfolioStore } from "../storage/index.js";
import { normalizePortfolioData } from "../validation/portfolioData.js";

export class PortfolioService {
  constructor({ store = createPortfolioStore() } = {}) {
    this.store = store;
  }

  /**
   * Reads the configured store and returns the API-safe portfolio payload.
   *
   * Normalization is applied on every read so legacy stored values, including
   * deprecated `duration` fields, never leak back through public or admin APIs.
   *
   * @returns {Promise<ReturnType<typeof normalizePortfolioData>>} Normalized portfolio data.
   */
  async getPortfolioData() {
    const rawPortfolioData = await this.store.getPortfolioData();

    return normalizePortfolioData(rawPortfolioData);
  }

  /**
   * Normalizes, sorts, and persists a complete portfolio payload.
   *
   * The normalized value is what gets written to JSON or Redis, so saves remove
   * deprecated fields and keep the most recently ended entries first.
   *
   * @param {unknown} portfolioData Candidate portfolio payload from admin PUT.
   * @returns {Promise<ReturnType<typeof normalizePortfolioData>>} Saved payload.
   */
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
