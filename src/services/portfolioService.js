import { createPortfolioStore } from "../storage/index.js";
import { normalizePortfolioData } from "../validation/portfolioData.js";

/** Raised when a legacy save could silently discard an existing project byline. */
export class PortfolioPayloadCompatibilityError extends Error {}

export class PortfolioService {
  constructor({ store = createPortfolioStore() } = {}) {
    this.store = store;
  }

  /**
   * Reads the configured store and returns the API-safe portfolio payload.
   *
   * Normalization is applied on every read so legacy stored values, including
   * deprecated `duration` fields and unsafe links, never leak back through the
   * APIs. Legacy academic defaults and deterministic IDs are computed without
   * persisting anything on GET.
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
   * deprecated fields and keep the most recently ended entries first. Older
   * clients may omit profile/research; those omissions retain existing objects.
   * Explicit objects (including empty strings) replace the existing values.
   * Omitted existing project authors are retained by stable ID during rollout;
   * unsupported ID-less legacy saves are rejected rather than erasing bylines.
   *
   * @param {unknown} portfolioData Candidate portfolio payload from admin PUT.
   * @returns {Promise<ReturnType<typeof normalizePortfolioData>>} Saved payload.
   */
  async updatePortfolioData(portfolioData) {
    if (typeof this.store.setPortfolioData !== "function") {
      throw new Error("The configured portfolio store does not support writes.");
    }

    const source = portfolioData && typeof portfolioData === "object" && !Array.isArray(portfolioData)
      ? { ...portfolioData } : {};
    const omittedMetadata = ["profile", "research"].filter((key) => !Object.hasOwn(source, key));

    const omittedAuthors = Array.isArray(source.projects) && source.projects.some(
      (project) => project && typeof project === "object" && !Object.hasOwn(project, "authors")
    );
    if (omittedMetadata.length > 0 || omittedAuthors) {
      const current = await this.getPortfolioData();

      for (const key of omittedMetadata) {
        source[key] = current[key];
      }
      if (omittedAuthors) {
        const authorsById = new Map(current.projects.map((project) => [project.id, project.authors]));
        const hasBylines = current.projects.some((project) => project.authors.length > 0);
        source.projects = source.projects.map((project) => {
          if (!project || typeof project !== "object" || Object.hasOwn(project, "authors")) return project;
          if (authorsById.has(project.id)) return { ...project, authors: [...authorsById.get(project.id)] };
          if (hasBylines) {
            throw new PortfolioPayloadCompatibilityError("Existing project bylines require stable IDs when authors are omitted. Reload with the updated admin editor.");
          }
          return project;
        });
      }
    }

    const normalizedPortfolioData = normalizePortfolioData(source);

    await this.store.setPortfolioData(normalizedPortfolioData);

    return normalizedPortfolioData;
  }
}

export function createPortfolioService(options = {}) {
  return new PortfolioService(options);
}
