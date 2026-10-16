import { createPortfolioStore } from "../storage/index.js";
import { normalizePortfolioData } from "../validation/portfolioData.js";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const EDITORIAL_PROFILE_FIELDS = Object.freeze(["academicStatus", "availability"]);

/**
 * Matches an education period without inventing a new public identifier.
 * Changed identity fields require the editor to send programme explicitly.
 *
 * @param {Record<string, unknown>} row Incoming or stored education period.
 * @returns {string} Exact degree/institution/start/end identity.
 */
function educationIdentity(row) {
  return JSON.stringify([row.degree, row.institution, row.start, row.end]);
}

/** Raised when a legacy save could silently discard existing editorial metadata. */
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
   * Explicit objects replace fields except for the compatibility omissions below.
   * Omitted existing project authors are retained by stable ID during rollout;
   * unsupported ID-less legacy saves are rejected rather than erasing bylines.
   * Older clients omitting research.thesisSupervisor retain the stored name;
   * an explicit empty string clears it. Direct service null input normalizes an
   * object to empty fields; HTTP PUT rejects non-object singleton metadata.
   * Omitted academicStatus/availability retain their stored strings. Omitted
   * featuredOrder retains a stored position by stable job/project ID; explicit
   * null clears it. Omitted education programme retains a unique exact original
   * degree/institution/start/end match; explicit empty string clears it.
   * Editorial positions never change the main chronological array order.
   * Omitted project collections retain stored labels by stable ID; explicit []
   * clears them. If stored labels exist, an unmatched omission is rejected rather
   * than silently discarding assignments. New records should send collections: [].
   *
   * @param {unknown} portfolioData Candidate portfolio payload from admin PUT.
   * @returns {Promise<ReturnType<typeof normalizePortfolioData>>} Saved payload.
   * @throws {PortfolioPayloadCompatibilityError} An omission cannot safely retain existing metadata.
   */
  async updatePortfolioData(portfolioData) {
    if (typeof this.store.setPortfolioData !== "function") {
      throw new Error("The configured portfolio store does not support writes.");
    }

    const source = isObject(portfolioData) ? { ...portfolioData } : {};
    const omittedMetadata = ["profile", "research"].filter((key) => !Object.hasOwn(source, key));

    const omittedAuthors = Array.isArray(source.projects) && source.projects.some(
      (project) => project && typeof project === "object" && !Object.hasOwn(project, "authors")
    );
    const omittedCollections = Array.isArray(source.projects) && source.projects.some(
      (project) => isObject(project) && !Object.hasOwn(project, "collections")
    );
    const omittedSupervisor = isObject(source.research) && !Object.hasOwn(source.research, "thesisSupervisor");
    const omittedProfileFields = isObject(source.profile)
      ? EDITORIAL_PROFILE_FIELDS.filter((field) => !Object.hasOwn(source.profile, field)) : [];
    const omittedFeaturedOrder = ["jobs", "projects"].some((section) => Array.isArray(source[section]) &&
      source[section].some((row) => isObject(row) && !Object.hasOwn(row, "featuredOrder")));
    const omittedProgramme = Array.isArray(source.education) &&
      source.education.some((row) => isObject(row) && !Object.hasOwn(row, "programme"));
    const needsStoredMetadata = omittedMetadata.length > 0 || omittedAuthors || omittedCollections || omittedSupervisor ||
      omittedProfileFields.length > 0 || omittedFeaturedOrder || omittedProgramme;
    if (needsStoredMetadata) {
      const current = await this.getPortfolioData();

      for (const key of omittedMetadata) {
        source[key] = current[key];
      }
      if (omittedSupervisor) {
        source.research = { ...source.research, thesisSupervisor: current.research.thesisSupervisor };
      }
      if (omittedProfileFields.length) {
        source.profile = {
          ...source.profile,
          ...Object.fromEntries(omittedProfileFields.map((field) => [field, current.profile[field]]))
        };
      }
      if (omittedFeaturedOrder) {
        for (const section of ["jobs", "projects"]) {
          if (!Array.isArray(source[section])) continue;
          const positions = new Map(current[section].filter((row) => Object.hasOwn(row, "featuredOrder"))
            .map((row) => [row.id, row.featuredOrder]));
          source[section] = source[section].map((row) => {
            if (!isObject(row) || Object.hasOwn(row, "featuredOrder")) return row;
            if (positions.has(row.id)) return { ...row, featuredOrder: positions.get(row.id) };
            if (positions.size && !row.id) {
              throw new PortfolioPayloadCompatibilityError("Featured records require stable IDs when featuredOrder is omitted. Reload with the updated admin editor.");
            }
            return row;
          });
        }
      }
      if (omittedProgramme) {
        const grouped = new Map();
        for (const row of current.education.filter((entry) => entry.programme)) {
          const key = educationIdentity(row);
          grouped.set(key, [...(grouped.get(key) || []), row.programme]);
        }
        source.education = source.education.map((row) => {
          if (!isObject(row) || Object.hasOwn(row, "programme")) return row;
          const matches = grouped.get(educationIdentity(row)) || [];
          if (matches.length > 1) {
            throw new PortfolioPayloadCompatibilityError("Ambiguous education programme identity. Reload with the updated admin editor.");
          }
          return matches.length ? { ...row, programme: matches[0] } : row;
        });
      }
      if (omittedCollections) {
        const collectionsById = new Map(current.projects.map((project) => [project.id, project.collections]));
        const hasCollections = current.projects.some((project) => project.collections.length > 0);
        source.projects = source.projects.map((project) => {
          if (!isObject(project) || Object.hasOwn(project, "collections")) return project;
          if (collectionsById.has(project.id)) {
            return { ...project, collections: [...collectionsById.get(project.id)] };
          }
          if (hasCollections) {
            throw new PortfolioPayloadCompatibilityError("Existing project collections require stable IDs when collections are omitted. Reload with the updated admin editor, or send collections explicitly.");
          }
          return project;
        });
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
