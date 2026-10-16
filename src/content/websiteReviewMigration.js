import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { EDUCATION_FIELDS, JOB_FIELDS, PAGE_KEYS, PROJECT_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const WEBSITE_REVIEW_MIGRATION_ID = "website-review-2026-10-16-v1";
const FIELDS = Object.freeze({
  profile: ["headline", "summary", "academicStatus", "availability"],
  research: ["summary", "thesisSummary"],
  pages: ["title", "description"],
  jobs: ["featuredOrder", "duties", "skills", "imageDescriptions", "imageBackupDescriptions"],
  education: ["grade", "end", "programme", "activities", "skills", "imageDescriptions", "imageBackupDescriptions"],
  projects: ["name", "description", "contribution", "category", "featuredOrder", "relatedRoleIds", "skills",
    "imageTitles", "imageDescriptions", "imageBackupDescriptions", "links", "linksTitles", "linksDescriptions", "linksBackupDescriptions"]
});
const LATENCY_ID = "research-zenodo-22044877";
const CARSURFING_ID = "project-e5a9d2ac9375ff84851016ad";
const LINK_FIELDS = ["links", "linksTitles", "linksDescriptions", "linksBackupDescriptions"];
const COLLECTION_FIELDS = { jobs: JOB_FIELDS, education: EDUCATION_FIELDS, projects: PROJECT_FIELDS };
const optional = new Set(["featuredOrder", "programme"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const sha = value => createHash("sha256").update(value).digest("hex");
const valueAt = (row, field) => row[field] ?? (optional.has(field) ? null : undefined);

function containsMultiset(values, original) {
  const remaining = [...values];
  for (const value of original) {
    const index = remaining.indexOf(value);
    if (index < 0) return false;
    remaining.splice(index, 1);
  }
  return true;
}

/**
 * @typedef {object} WebsiteReviewPatch
 * @property {'profile'|'research'|'pages'|'jobs'|'education'|'projects'} collection Reviewed section.
 * @property {string} [id] Stable job/project ID, including pre-edit deterministic IDs.
 * @property {string} [page] Fixed page key for page copy only.
 * @property {{degree:string,institution:string,start:string,end:string}} [match] Exact original education period.
 * @property {Record<string,string|string[]|number|null>} expected Every old normalized field; null denotes absent optional metadata.
 * @property {Record<string,string|string[]|number|null>} values Reviewed replacements for exactly those fields.
 * @property {string[]} evidence Public evidence references or explicit owner confirmations.
 * @property {number[]} [linkOrder] Only the latency record may use the exact complete-tuple permutation [2,1,0].
 */

/**
 * Prepares an evidence-scoped website editorial candidate without writes.
 *
 * Preserves raw records/order, unknown fields, all primary URLs, populated image titles,
 * maps, bylines, publication states, dates outside the explicit education end
 * field and all courses. Changed media text must remain same-index/aligned.
 * Activities retain their full multiset; skills can only select existing labels;
 * role links may only append. A legacy project rename pins its pre-edit ID.
 * The one approved latency-link permutation moves all four arrays together;
 * every other record retains primary URL order exactly.
 * Only previously blank CarSurfing titles may receive the visually verified caption.
 * Every changed field must match its reviewed old value. No content is seeded
 * by GET/PUT or automatically at startup. A completed independent ledger makes
 * repeats read-only, including after later administrator edits/deletions.
 *
 * @param {object} current Complete raw Redis snapshot, not a public GET result.
 * @param {{version:number,migrationId:string,patches:WebsiteReviewPatch[]}} plan Reviewed operations.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Raw candidate, field-only report and exact compact JSON hash.
 */
export function planWebsiteReviewMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      Object.keys(COLLECTION_FIELDS).some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Website review requires a complete raw snapshot.");
  }
  const data = structuredClone(current);
  const report = { migrationId: WEBSITE_REVIEW_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!object(plan) || plan.version !== 1 || plan.migrationId !== WEBSITE_REVIEW_MIGRATION_ID || !Array.isArray(plan.patches)) {
    throw new Error("Invalid website review plan.");
  }
  const normalized = normalizePortfolioData(current);
  for (const [key, fields] of Object.entries(COLLECTION_FIELDS)) normalized[key] = normalizeRichArray(current[key], fields);
  const touched = new Set();
  const targets = [];

  for (const patch of plan.patches) {
    if (!object(patch) || !Object.hasOwn(FIELDS, patch.collection) || !object(patch.expected) || !object(patch.values) ||
        !strings(patch.evidence) || !patch.evidence.length || patch.evidence.some(value => !value.trim())) {
      throw new Error("Website review requires allowed fields and explicit evidence.");
    }
    const { collection } = patch;
    const fields = Object.keys(patch.values);
    if (!fields.length || !isDeepStrictEqual([...fields].sort(), Object.keys(patch.expected).sort()) ||
        fields.some(field => !FIELDS[collection].includes(field))) throw new Error("Website review field scope rejected.");
    let index;
    if (collection === "pages") {
      if (!PAGE_KEYS.includes(patch.page) || !object(current.pages[patch.page])) throw new Error("Website review requires a fixed page.");
      index = patch.page;
    } else if (Object.hasOwn(COLLECTION_FIELDS, collection)) {
      if (collection === "education") {
        if (!object(patch.match) || !isDeepStrictEqual(Object.keys(patch.match).sort(), ["degree", "end", "institution", "start"]) ||
            Object.values(patch.match).some(value => typeof value !== "string")) throw new Error("Education requires exact identity.");
      } else if (typeof patch.id !== "string" || !patch.id) throw new Error("Website review requires stable IDs.");
      const matches = normalized[collection].flatMap((row, i) =>
        (collection === "education" ? Object.entries(patch.match).every(([key, value]) => row[key] === value) : row.id === patch.id) ? [i] : []);
      if (matches.length !== 1) throw new Error("Website review target is missing or ambiguous.");
      [index] = matches;
    }
    const original = index === undefined ? normalized[collection] : normalized[collection][index];
    const target = index === undefined ? data[collection] : data[collection][index];
    for (const field of fields) {
      const path = `${collection}:${index ?? "object"}:${field}`;
      if (touched.has(path) || !isDeepStrictEqual(valueAt(original, field), patch.expected[field])) {
        throw new Error("Stale or duplicate website review operation.");
      }
      touched.add(path);
      const value = patch.values[field];
      const valid = field === "featuredOrder" ? value === null || (Number.isSafeInteger(value) && value > 0)
        : Array.isArray(original[field]) ? strings(value) : typeof value === "string";
      if (!valid) throw new Error("Website review values must match the contract types.");
      if (/^(image|links)/.test(field)) {
        const urls = original[field.startsWith("image") ? "imageUrls" : "links"];
        if (value.length !== urls.length) throw new Error("Media text requires complete aligned arrays.");
      }
    }
    if (fields.includes("activities") && !containsMultiset(patch.values.activities, original.activities)) {
      throw new Error("All original activities must be retained.");
    }
    if (fields.includes("links") || patch.linkOrder !== undefined) {
      if (collection !== "projects" || patch.id !== LATENCY_ID || !isDeepStrictEqual(patch.linkOrder, [2, 1, 0]) ||
          original.links.length !== 3 || !LINK_FIELDS.every(field => fields.includes(field)) ||
          !isDeepStrictEqual(patch.values.links, patch.linkOrder.map(index => original.links[index]))) {
        throw new Error("Only the exact approved latency four-array tuple permutation is allowed.");
      }
    }
    if (fields.includes("imageTitles") && (collection !== "projects" || patch.id !== CARSURFING_ID ||
        patch.values.imageTitles.some((text, i) => original.imageTitles[i] && text !== original.imageTitles[i]))) {
      throw new Error("Only blank CarSurfing image titles may be filled; original credits are protected.");
    }
    if (fields.includes("skills") && patch.values.skills.some(skill => !original.skills.includes(skill))) {
      throw new Error("Skill curation may only select existing canonical labels.");
    }
    if (fields.includes("relatedRoleIds") && !isDeepStrictEqual(patch.values.relatedRoleIds.slice(0, original.relatedRoleIds.length), original.relatedRoleIds)) {
      throw new Error("Existing role relationships must be retained in order.");
    }
    const changedFields = [...fields];
    if (collection === "projects" && fields.includes("name") && !current.projects[index].id) {
      target.id = original.id;
      changedFields.push("id");
    }
    for (const field of fields) {
      if ((field === "featuredOrder" && patch.values[field] === null) || (field === "programme" && patch.values[field] === "")) delete target[field];
      else target[field] = structuredClone(patch.values[field]);
    }
    targets.push({ collection, index, fields: changedFields, values: patch.values });
    report.changes.push({ collection, ...(index === undefined ? {} : { index }), fields: changedFields, evidence: patch.evidence });
  }
  const mask = value => {
    const copy = structuredClone(value);
    for (const { collection, index, fields } of targets) {
      const row = index === undefined ? copy[collection] : copy[collection][index];
      for (const field of fields) delete row[field];
    }
    return copy;
  };
  if (!isDeepStrictEqual(mask(current), mask(data))) throw new Error("Website review scope proof failed.");
  const after = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(after).valid) throw new Error("Website review candidate failed portfolio validation.");
  const rawOrder = { ...after };
  for (const [key, fields] of Object.entries(COLLECTION_FIELDS)) rawOrder[key] = normalizeRichArray(data[key], fields);
  for (const { collection, index, values } of targets) {
    const row = index === undefined ? rawOrder[collection] : rawOrder[collection][index];
    for (const [field, value] of Object.entries(values)) {
      const expected = (field === "featuredOrder" && value === null) || (field === "programme" && value === "") ? null : value;
      if (!isDeepStrictEqual(valueAt(row, field), expected)) throw new Error("Website review value would be discarded or normalized; review the plan.");
    }
  }
  for (const section of ["jobs", "projects"]) {
    if (!isDeepStrictEqual(normalized[section].map(row => row.id), rawOrder[section].map(row => row.id))) throw new Error("Website review changed stable identity.");
  }
  report.changed = !isDeepStrictEqual(current, data);
  return finish();
}

/**
 * Previews by default; applies only with exact source/candidate hashes, a complete
 * byte-identical local backup and deployment verification. The shared Lua CAS
 * atomically stores the raw original, candidate and separate ledger. Stale input,
 * failed backups or concurrent admin edits cannot overwrite live data. Ledger
 * repeats never restore later deletions. No credentials enter reports.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:object,expectedCandidateHash?:string}} options Raw Redis, reviewed operations and safety guards.
 * @returns {Promise<object>} Preview or application receipt with backup/ledger paths.
 */
export async function migrateWebsiteReviewRedis(options) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Website review dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Website review apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: WEBSITE_REVIEW_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Website review backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planWebsiteReviewMigration(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Website review candidate differs from the reviewed preview.");
      }
      return result;
    }
  });
}
