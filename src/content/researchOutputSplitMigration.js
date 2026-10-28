import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData, normalizeRichItem, PROJECT_FIELDS, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const RESEARCH_OUTPUT_SPLIT_MIGRATION_ID = "research-output-split-2026-10-28-v1";
const REPLACEMENT_IDS = new Set(["research-arxiv-2608-11228", "research-arxiv-2609-05584"]);
const ADDED_ID = "research-football-paper-c";
const REPLACEMENT_VALUE_KEYS = [
  "name", "dateOfCompletion", "outputType", "status", "contribution", "authors",
  "description", "skills", "links", "linksTitles", "linksDescriptions",
  "linksBackupDescriptions", "imageTitles", "imageDescriptions", "imageBackupDescriptions",
];
const EXPECTED_KEYS = [
  "dateOfCompletion", "contribution", "authors", "description", "skills", "links",
  "linksTitles", "linksDescriptions", "linksBackupDescriptions", "imageTitles",
  "imageDescriptions", "imageBackupDescriptions",
];
const EXPECTED_TEXT_KEYS = ["dateOfCompletion", "contribution", "description"];
const EXPECTED_ARRAY_KEYS = EXPECTED_KEYS.filter((key) => !EXPECTED_TEXT_KEYS.includes(key));

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");
const sameKeys = (value, keys) => isObject(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = (value) => createHash("sha256").update(value).digest("hex");

function validLinkMetadata(values) {
  return ["links", "linksTitles", "linksDescriptions", "linksBackupDescriptions"].every((key) => isStringArray(values[key])) &&
    values.links.length === values.linksTitles.length &&
    values.links.length === values.linksDescriptions.length &&
    values.links.length === values.linksBackupDescriptions.length &&
    isDeepStrictEqual(values.linksTitles, values.linksDescriptions);
}

function validImageMetadata(values, expectedImageCount) {
  return ["imageTitles", "imageDescriptions", "imageBackupDescriptions"].every((key) => isStringArray(values[key])) &&
    values.imageTitles.length === expectedImageCount &&
    values.imageDescriptions.length === expectedImageCount &&
    values.imageBackupDescriptions.length === expectedImageCount &&
    isDeepStrictEqual(values.imageTitles, values.imageDescriptions);
}

function masked(data) {
  const copy = structuredClone(data);
  copy.projects = copy.projects
    .filter((project) => project.id !== ADDED_ID)
    .map((project) => {
      if (!REPLACEMENT_IDS.has(project.id)) return project;
      for (const key of REPLACEMENT_VALUE_KEYS) delete project[key];
      return project;
    });
  return copy;
}

function normalizedMasked(data) {
  const copy = masked(normalizePortfolioData(data));
  copy.projects.sort((left, right) => left.id.localeCompare(right.id));
  return copy;
}

/**
 * @typedef {object} ResearchOutputReplacement
 * @property {{id:string,name:string,category:string,outputType:string,status:string}} match Exact stale record identity.
 * @property {object} expected Complete source values for every field this migration may replace.
 * @property {object} values Reviewed replacement values. Existing image URLs, IDs, ranks and relationships are retained.
 * @property {string} rationale Private source-grounded justification; never emitted by reports.
 */

/**
 * @typedef {object} ResearchOutputSplitPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal RESEARCH_OUTPUT_SPLIT_MIGRATION_ID.
 * @property {ResearchOutputReplacement[]} replacements Exactly Articles A and B, replacing superseded records.
 * @property {{afterId:string,record:object,rationale:string}} addition The new Article C record and precise insertion point.
 */

/**
 * Replaces two superseded football-paper records and inserts Article C without
 * treating older preprints as current manuscripts. The plan pins all edited
 * source fields, keeps existing media URLs/ranks/relationships intact, and
 * checks that every other raw and normalized value survives unchanged.
 *
 * @param {object} current Complete fresh raw Redis portfolio.
 * @param {ResearchOutputSplitPlan} plan Independently reviewed content plan.
 * @param {{alreadyApplied?:boolean}} [options={}] Existing migration-ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Candidate portfolio and safe report.
 * @throws {Error} Invalid, stale, ambiguous or over-broad updates.
 */
export function planResearchOutputSplit(current, plan, { alreadyApplied = false } = {}) {
  if (!isObject(current) || !isObject(current.pages) || !isObject(current.profile) || !isObject(current.research) ||
      ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key]) || current[key].some((row) => !isObject(row)))) {
    throw new Error("Research-output split requires the complete raw portfolio.");
  }
  const data = structuredClone(current);
  const report = { migrationId: RESEARCH_OUTPUT_SPLIT_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();

  if (!sameKeys(plan, ["version", "migrationId", "replacements", "addition"]) || plan.version !== 1 ||
      plan.migrationId !== RESEARCH_OUTPUT_SPLIT_MIGRATION_ID || !Array.isArray(plan.replacements) || plan.replacements.length !== 2 ||
      !sameKeys(plan.addition, ["afterId", "record", "rationale"]) || typeof plan.addition.afterId !== "string" ||
      typeof plan.addition.rationale !== "string" || !plan.addition.rationale.trim() || !isObject(plan.addition.record)) {
    throw new Error("Research-output split requires two reviewed replacements and one reviewed addition.");
  }

  const seen = new Set();
  for (const patch of plan.replacements) {
    if (!sameKeys(patch, ["match", "expected", "values", "rationale"]) ||
        !sameKeys(patch.match, ["id", "name", "category", "outputType", "status"]) ||
        !sameKeys(patch.expected, EXPECTED_KEYS) || !sameKeys(patch.values, REPLACEMENT_VALUE_KEYS) ||
        !Object.values(patch.match).every((value) => typeof value === "string" && value.trim()) ||
        !EXPECTED_TEXT_KEYS.every((key) => typeof patch.expected[key] === "string") ||
        !EXPECTED_ARRAY_KEYS.every((key) => isStringArray(patch.expected[key])) ||
        typeof patch.rationale !== "string" || !patch.rationale.trim() ||
        !REPLACEMENT_IDS.has(patch.match.id) || seen.has(patch.match.id) ||
        !Object.values(patch.values).every((value) => typeof value === "string" || isStringArray(value)) ||
        !validLinkMetadata(patch.values)) {
      throw new Error("Invalid reviewed research-output replacement.");
    }
    const indexes = current.projects.flatMap((row, index) => row.id === patch.match.id ? [index] : []);
    if (indexes.length !== 1) throw new Error("Research-output replacement is missing or ambiguous.");
    const [index] = indexes;
    const existing = current.projects[index];
    if (!Object.entries(patch.match).every(([key, value]) => existing[key] === value) ||
        !Object.entries(patch.expected).every(([key, value]) => isDeepStrictEqual(existing[key], value)) ||
        !validImageMetadata(patch.values, existing.imageUrls?.length || 0)) {
      throw new Error("Research-output source changed; review a fresh raw snapshot.");
    }
    Object.assign(data.projects[index], structuredClone(patch.values));
    report.changes.push({ collection: "projects", id: patch.match.id, fields: [...REPLACEMENT_VALUE_KEYS] });
    seen.add(patch.match.id);
  }
  if (seen.size !== REPLACEMENT_IDS.size || plan.addition.afterId !== "research-arxiv-2608-11228" ||
      plan.addition.record.id !== ADDED_ID || data.projects.some((project) => project.id === ADDED_ID)) {
    throw new Error("Research-output split targets do not match the approved three-paper change.");
  }
  const newRecord = normalizeRichItem(plan.addition.record, PROJECT_FIELDS);
  if (newRecord.category !== "research" || newRecord.outputType !== "manuscript" || newRecord.status !== "in-preparation" ||
      newRecord.dateOfCompletion || !validLinkMetadata(newRecord) || newRecord.imageUrls.length || newRecord.imageTitles.length ||
      newRecord.imageDescriptions.length || newRecord.imageBackupDescriptions.length) {
    throw new Error("Article C must remain an in-preparation research manuscript with aligned links and no inferred media.");
  }
  const insertionIndex = data.projects.findIndex((project) => project.id === plan.addition.afterId);
  data.projects.splice(insertionIndex + 1, 0, newRecord);
  report.changes.push({ collection: "projects", id: ADDED_ID, fields: ["added"] });

  const after = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(after).valid || !isDeepStrictEqual(masked(current), masked(data)) ||
      !isDeepStrictEqual(normalizedMasked(current), normalizedMasked(data))) {
    throw new Error("Research-output split failed its full raw/public preservation proof.");
  }
  report.changed = true;
  return finish();
}

/**
 * Previews by default and applies the split only after fresh source/candidate
 * hash review, a byte-identical local backup and a deployed-schema check.
 *
 * @param {object} [options={}] Raw Redis settings and a reviewed split plan.
 * @returns {Promise<object>} Safe report, hashes and backup references.
 */
export async function migrateResearchOutputSplitRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
    throw new Error("Research-output split dryRun must be a boolean.");
  }
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) {
    throw new Error("Research-output split apply requires the candidate SHA-256.");
  }
  const backupReader = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({
    ...options,
    migrationId: RESEARCH_OUTPUT_SPLIT_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await backupReader(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) {
        throw new Error("Research-output split backup must match exact raw source bytes.");
      }
      return raw;
    },
    planMigration: (current, state) => {
      const result = planResearchOutputSplit(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Research-output split candidate differs from the confirmed preview.");
      }
      return result;
    },
  });
}
