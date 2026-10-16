import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const PRESENTATION_REVIEW_MIGRATION_ID = "presentation-review-2026-10-16-v1";
const SINGLETON_FIELDS = { profile: ["headline", "summary", "academicStatus"], research: ["summary", "thesisSummary", "thesisQuestions"] };
const PROJECT_SCOPE = {
  "research-arxiv-2608-27736": "research", "research-arxiv-2608-11228": "research", "research-eartharxiv-15189": "research",
  "research-zenodo-22044877": "research", "project-1930afed6e1b31fc8e95b24e": "software",
  "project-e5a9d2ac9375ff84851016ad": "software", "project-739137b5bba481267f708c82": "data"
};
const PAGE_KEYS = ["home", "experience", "education", "projects", "contact"];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");

/**
 * @typedef {object} PresentationReviewPatch
 * @property {'profile'|'research'|'pages'|'projects'} collection Explicit reviewed narrative section only.
 * @property {string} [page] Fixed page key, required only for page descriptions.
 * @property {{id:string,category:string,name:string}} [match] Exact persisted project identity/category/name; no inferred IDs.
 * @property {Record<string,string|string[]>} expected Complete old raw values of every changed field.
 * @property {Record<string,string|string[]>} values Separately reviewed replacements for exactly those fields.
 * @property {string[]} evidence Existing source references or explicit owner/editorial confirmations, kept private.
 *
 * @typedef {object} PresentationReviewPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal PRESENTATION_REVIEW_MIGRATION_ID.
 * @property {PresentationReviewPatch[]} patches Reviewed narrow narrative operations.
 */

/**
 * Previews approved narrative polish without touching any other raw content.
 * Home reads profile.summary, not merely pages.home.description. A separate
 * thesis question edit remains a research aim, never an established result.
 * This planner does not authorize facts: exact copy/source evidence and full
 * scientific limitations must be independently reviewed before hash confirmation.
 * All jobs/education, skills, courses, IDs/categories/names/statuses/bylines,
 * dates, thesis methods/supervisor, availability/CV/profile media, maps, primary
 * URLs, media text/index associations, collections and raw order remain exact.
 * No caption/media edit, upload, seed or runtime API/schema/security change is
 * allowed. A completed independent ledger preserves later edits/deletions.
 *
 * @param {object} current Complete raw Redis source, never a public projection/old seed.
 * @param {PresentationReviewPlan} plan Exact reviewed copy, old values and evidence.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Raw candidate, field-only report and compact raw JSON SHA-256.
 * @throws {Error} Scope/identity/type/stale-source or raw/public preservation checks fail.
 */
export function planPresentationReviewMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Presentation review requires a complete raw snapshot.");
  }
  const data = structuredClone(current);
  const report = { migrationId: PRESENTATION_REVIEW_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "patches"]) || plan.version !== 1 ||
      plan.migrationId !== PRESENTATION_REVIEW_MIGRATION_ID || !Array.isArray(plan.patches) || !plan.patches.length) {
    throw new Error("Invalid presentation review plan.");
  }
  const touched = new Set(); const changes = [];
  for (const patch of plan.patches) {
    const section = patch?.collection;
    const identityKey = section === "pages" ? ["page"] : section === "projects" ? ["match"] : [];
    if (!keysEqual(patch, ["collection", ...identityKey, "expected", "values", "evidence"]) ||
        !["profile", "research", "pages", "projects"].includes(section) || !object(patch.expected) || !object(patch.values) ||
        !strings(patch.evidence) || !patch.evidence.length || patch.evidence.some(value => !value.trim())) {
      throw new Error("Presentation review requires narrow fields and explicit private evidence.");
    }
    let index; let allowed;
    if (Object.hasOwn(SINGLETON_FIELDS, section)) allowed = SINGLETON_FIELDS[section];
    else if (section === "pages") {
      if (!PAGE_KEYS.includes(patch.page) || !object(current.pages[patch.page])) throw new Error("Presentation review requires a fixed existing page.");
      index = patch.page; allowed = ["description"];
    } else {
      if (!keysEqual(patch.match, ["id", "category", "name"]) || !Object.values(patch.match).every(value => typeof value === "string") ||
          !Object.hasOwn(PROJECT_SCOPE, patch.match.id) || PROJECT_SCOPE[patch.match.id] !== patch.match.category) {
        throw new Error("Presentation review project is out of scope.");
      }
      const matches = current.projects.flatMap((row, i) => row.id === patch.match.id ? [i] : []);
      if (matches.length !== 1) throw new Error("Presentation review project is missing or ambiguous.");
      [index] = matches;
      if (!Object.entries(patch.match).every(([key, value]) => current.projects[index][key] === value)) throw new Error("Stale presentation project identity.");
      allowed = patch.match.category === "research" ? ["description", "contribution"] : ["description"];
    }
    const original = index === undefined ? current[section] : current[section][index];
    const target = index === undefined ? data[section] : data[section][index];
    const fields = Object.keys(patch.values);
    if (!fields.length || !keysEqual(patch.expected, fields) || fields.some(field => !allowed.includes(field))) throw new Error("Presentation narrative field scope rejected.");
    for (const field of fields) {
      const path = `${section}:${index ?? "object"}:${field}`; const value = patch.values[field];
      if (touched.has(path) || !isDeepStrictEqual(original[field], patch.expected[field])) throw new Error("Stale or duplicate presentation field.");
      const valid = section === "research" && field === "thesisQuestions" ? strings(value) && value.length > 0 && value.every(text => text.trim())
        : typeof value === "string" && Boolean(value.trim());
      if (!valid) throw new Error("Presentation replacements must be reviewed strings or thesis questions.");
      touched.add(path); target[field] = structuredClone(value);
    }
    changes.push({ collection: section, index, fields });
    report.changes.push({ collection: section, ...(section === "projects" ? { id: patch.match.id } : section === "pages" ? { page: index } : {}), fields });
  }
  const mask = value => {
    const copy = structuredClone(value);
    for (const { collection, index, fields } of changes) {
      const row = collection === "projects" ? copy.projects.find(item => item.id === current.projects[index].id)
        : index === undefined ? copy[collection] : copy[collection][index];
      for (const field of fields) delete row[field];
    }
    return copy;
  };
  const normalized = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(normalized).valid || !isDeepStrictEqual(mask(current), mask(data)) ||
      !isDeepStrictEqual(mask(normalizePortfolioData(current)), mask(normalized))) throw new Error("Presentation raw/public preservation proof failed.");
  for (const { collection, index, fields } of changes) {
    const row = collection === "projects" ? normalized.projects.find(item => item.id === current.projects[index].id)
      : index === undefined ? normalized[collection] : normalized[collection][index];
    const raw = index === undefined ? data[collection] : data[collection][index];
    if (fields.some(field => !isDeepStrictEqual(row[field], raw[field]))) throw new Error("Presentation copy would change during API normalization.");
  }
  report.changed = !isDeepStrictEqual(current, data);
  return finish();
}

/**
 * Previews by default; only a separately confirmed narrative candidate may apply.
 * Existing raw-value CAS atomically writes original backup/candidate/new ledger.
 * Both hashes, exact prepared backup and deployed API check guard application;
 * stale/concurrent changes abort. Ledger repeats retain later edits/deletions.
 * Publication never invokes the migration or uploads media.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:PresentationReviewPlan,expectedCandidateHash?:string}} [options={}] Raw Redis, reviewed copy and explicit guards.
 * @returns {Promise<object>} Safe field/hash/backup receipt without credentials or narrative.
 * @throws {Error} Mode, scope, evidence/type or backup/hash/deployment/CAS checks fail.
 */
export async function migratePresentationReviewRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Presentation dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Presentation apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: PRESENTATION_REVIEW_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Presentation backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planPresentationReviewMigration(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) throw new Error("Presentation candidate differs from the confirmed preview.");
      return result;
    }
  });
}
