import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizeProfile, normalizeResearch } from "../validation/academicMetadata.js";
import { EDUCATION_FIELDS, PROJECT_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const ACADEMIC_REVIEW_MIGRATION_ID = "academic-review-2026-10-15-v1";
const FIELDS = {
  profile: ["email"],
  research: ["thesisInstitution", "thesisSupervisor", "thesisStart", "thesisEnd"],
  education: ["degree", "status", "courses", "activities"],
  projects: ["name", "description", "contribution", "authors", "links", "linksTitles", "linksDescriptions", "linksBackupDescriptions"]
};
const LINK_FIELDS = ["links", "linksTitles", "linksDescriptions", "linksBackupDescriptions"];
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const strings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * @typedef {object} AcademicReviewPatch
 * @property {'profile'|'research'|'education'|'projects'} collection Allowed content section.
 * @property {string} [id] Existing stable project ID, including deterministic legacy IDs.
 * @property {{degree:string,institution:string,start:string,end:string}} [match] Exact original education identity.
 * @property {Record<string, string|string[]>} expected Expected normalized values of every changed field.
 * @property {Record<string, string|string[]>} values Independently reviewed replacements of those same fields.
 * @property {string[]} evidence Primary-source references or explicit owner confirmations; never secrets.
 */

/**
 * Builds a strictly scoped academic-content preview without writes or seeding.
 *
 * Operations compare every old field, resolve projects by stable ID and education
 * by its complete four-field identity. Course changes must be exact permutations;
 * activities may only append. Links change as complete, aligned four-array tuples
 * and retain every existing URL in order. All images, jobs, IDs, categories,
 * skills, relationships, status/date claims and unknown raw fields outside the
 * explicit allow-list remain untouched. Missing legacy IDs are not persisted;
 * renaming such a project requires a separate identity migration first.
 *
 * @param {object} current Complete raw Redis snapshot, not the public normalized API response.
 * @param {{version:number,migrationId:string,patches:AcademicReviewPatch[]}} plan Evidence-reviewed field operations.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent persistent ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Candidate, field-only summary and exact JSON hash.
 */
export function planAcademicReviewMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key])) ||
      !object(current.profile) || !object(current.research)) throw new Error("Academic review requires a complete raw snapshot.");
  const data = structuredClone(current);
  const report = { migrationId: ACADEMIC_REVIEW_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!object(plan) || plan.version !== 1 || plan.migrationId !== ACADEMIC_REVIEW_MIGRATION_ID || !Array.isArray(plan.patches)) {
    throw new Error("Invalid academic review plan.");
  }
  const normalized = {
    profile: normalizeProfile(current.profile), research: normalizeResearch(current.research),
    education: normalizeRichArray(current.education, EDUCATION_FIELDS), projects: normalizeRichArray(current.projects, PROJECT_FIELDS)
  };
  const targets = [];
  const touched = new Set();
  for (const patch of plan.patches) {
    if (!object(patch) || !Object.hasOwn(FIELDS, patch.collection) || !object(patch.expected) || !object(patch.values) ||
        !strings(patch.evidence) || !patch.evidence.length || patch.evidence.some((value) => !value.trim())) {
      throw new Error("Academic review requires allowed fields and explicit evidence.");
    }
    const { collection } = patch;
    const fields = Object.keys(patch.values);
    if (!fields.length || !isDeepStrictEqual(fields.slice().sort(), Object.keys(patch.expected).sort()) ||
        fields.some((field) => !FIELDS[collection].includes(field))) throw new Error("Academic review field scope rejected.");
    let index;
    if (["projects", "education"].includes(collection)) {
      if (collection === "education" && (!object(patch.match) ||
          !isDeepStrictEqual(Object.keys(patch.match).sort(), ["degree", "end", "institution", "start"]) ||
          Object.values(patch.match).some((value) => typeof value !== "string"))) throw new Error("Education requires exact identity.");
      if (collection === "projects" && (typeof patch.id !== "string" || !patch.id)) throw new Error("Projects require a stable ID.");
      const matches = normalized[collection].flatMap((row, i) =>
        (collection === "projects" ? row.id === patch.id : Object.entries(patch.match).every(([key, value]) => row[key] === value)) ? [i] : []);
      if (matches.length !== 1) throw new Error("Academic review target is missing or ambiguous.");
      [index] = matches;
      if (collection === "projects" && normalized.projects[index].category !== "research") throw new Error("Only research projects may be edited.");
    }
    const original = index === undefined ? normalized[collection] : normalized[collection][index];
    const target = index === undefined ? data[collection] : data[collection][index];
    if (!object(target)) throw new Error("Academic review target must be an object.");
    for (const field of fields) {
      const path = `${collection}:${index ?? "object"}:${field}`;
      if (touched.has(path) || !isDeepStrictEqual(original[field], patch.expected[field])) throw new Error("Stale or duplicate academic review operation.");
      touched.add(path);
      if (Array.isArray(original[field]) ? !strings(patch.values[field]) : typeof patch.values[field] !== "string") {
        throw new Error("Academic review values must match the contract types.");
      }
    }
    if (fields.includes("name") && !current.projects[index].id) throw new Error("Persist project identity before renaming a legacy project.");
    if (fields.includes("courses") && !isDeepStrictEqual([...original.courses].sort(), [...patch.values.courses].sort())) {
      throw new Error("Course previews must preserve the entire course multiset.");
    }
    if (fields.includes("activities") && !isDeepStrictEqual(patch.values.activities.slice(0, original.activities.length), original.activities)) {
      throw new Error("Existing activities must remain in their original order.");
    }
    if (fields.some((field) => LINK_FIELDS.includes(field))) {
      if (!LINK_FIELDS.every((field) => fields.includes(field)) || !LINK_FIELDS.every((field) => patch.values[field].length === patch.values.links.length) ||
          !isDeepStrictEqual(patch.values.links.slice(0, original.links.length), original.links)) {
        throw new Error("Links require four aligned arrays and preservation of original URL order.");
      }
    }
    Object.assign(target, structuredClone(patch.values));
    targets.push({ collection, index, fields, values: patch.values });
    report.changes.push({ collection, ...(index === undefined ? {} : { index }), fields, evidence: patch.evidence });
  }
  const mask = (value) => {
    const copy = structuredClone(value);
    for (const { collection, index, fields } of targets) {
      const row = index === undefined ? copy[collection] : copy[collection][index];
      for (const field of fields) delete row[field];
    }
    return copy;
  };
  if (!isDeepStrictEqual(mask(current), mask(data))) throw new Error("Academic review scope proof failed.");
  const after = normalizePortfolioData(data);
  const validation = validateCompletePortfolioPayload(after);
  if (!validation.valid) throw new Error("Academic review candidate failed portfolio validation.");
  const rawOrder = {
    profile: after.profile, research: after.research,
    education: normalizeRichArray(data.education, EDUCATION_FIELDS), projects: normalizeRichArray(data.projects, PROJECT_FIELDS)
  };
  for (const { collection, index, fields, values } of targets) {
    const row = index === undefined ? rawOrder[collection] : rawOrder[collection][index];
    if (fields.some((field) => !isDeepStrictEqual(row[field], values[field]))) throw new Error("Academic review value would be discarded or normalized; review the plan.");
  }
  const before = normalizePortfolioData(current);
  for (const section of ["jobs", "projects"]) {
    if (!isDeepStrictEqual(before[section].map(({ id }) => id), after[section].map(({ id }) => id))) throw new Error("Academic review changed identity or ordering.");
  }
  report.changed = !isDeepStrictEqual(data, current);
  return finish();
}

/**
 * Previews by default; applies only after exact source/candidate review and backup.
 * The shared CAS atomically saves the complete original Redis value, candidate
 * and separate ledger. Prepared backups must match exact source bytes. A stale
 * admin edit, wrong hash or failed backup aborts before writes. Ledger repeats
 * are read-only and never restore subsequently deleted/edited content.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:object,expectedCandidateHash?:string}} options Raw Redis, reviewed plan, guards, backup and deployment verification.
 * @returns {Promise<object>} Candidate, safe report and application/backup receipt.
 */
export async function migrateAcademicReviewRedis(options) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Academic review dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Academic review apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: ACADEMIC_REVIEW_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Academic review backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, ledgerState) => {
      const result = planAcademicReviewMigration(current, options.plan, ledgerState);
      if (options.dryRun === false && !ledgerState.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Academic review candidate differs from the reviewed preview.");
      }
      return result;
    } });
}
