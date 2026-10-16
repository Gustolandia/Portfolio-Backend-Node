import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const PROJECT_COLLECTIONS_MIGRATION_ID = "project-collections-2026-10-16-v1";
const D = "Data Analysis & Statistics", R = "Research Methods", W = "Web Development", B = "Backend & APIs";
const S = "Scientific Computing", I = "Instrumentation & Control", P = "Project Management";
export const PROJECT_COLLECTION_ASSIGNMENTS = Object.freeze([
  ["research-eartharxiv-15189", "research", [D, R]],
  ["research-arxiv-2608-27736", "research", [D, R]],
  ["research-arxiv-2609-05584", "research", [D, R]],
  ["research-arxiv-2608-11228", "research", [D, R]],
  ["project-1930afed6e1b31fc8e95b24e", "software", [W, B]],
  ["project-e5a9d2ac9375ff84851016ad", "software", [W, B]],
  ["project-829a53079026e22c418fda42", "software", [W]],
  ["project-20e3c4c3fa44a48fd5ff553d", "software", [W, B]],
  ["project-739137b5bba481267f708c82", "data", [D]],
  ["project-6f2264d4a653de434559ad0d", "coursework", [P]],
  ["project-38981053924e2c7d93a437c8", "software", [W, B]],
  ["project-c2307a8588da6647db62d7b3", "research", [D, S, I]],
  ["project-c1f062a755abff4388000db1", "research", [D, S, I]],
  ["project-701dc8ee8551735c9de9d27d", "research", [I]],
  ["research-zenodo-22044877", "research", [S, R]]
].map(([id, category, collections]) => Object.freeze({ id, category, collections: Object.freeze(collections) })));
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");

/**
 * @typedef {object} ProjectCollectionPatch
 * @property {{id:string,category:string,name:string}} match Exact existing identity; no name-based inference.
 * @property {{exists:boolean,collections:string[]}} expected Raw property presence and complete old labels; absence is not persisted [].
 * @property {{description:string,contribution:string}} expectedNarrative Exact reviewed existing copy, checked but never rewritten.
 * @property {string[]} collections Exact approved ordered labels for this stable ID.
 * @property {string} rationale Private source-grounded review explanation, omitted from reports.
 *
 * @typedef {object} ProjectCollectionsPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal PROJECT_COLLECTIONS_MIGRATION_ID.
 * @property {ProjectCollectionPatch[]} patches One independently reviewed patch for each of the fifteen pinned IDs.
 */

/**
 * Previews only the approved fifteen projects' collection assignments offline.
 * Preserves all raw fields/order outside collections, and independently checks
 * the normalized public projection. Labels describe whole projects, not personal
 * authorship, publication status or original scientific discovery. No categories,
 * narrative, selection ranks, relationships, media tuples, skills, maps or CV
 * fields change. The fixed mapping limits this one-off maintenance plan only;
 * ordinary API collections remain user-defined. No GET/startup hook invokes it.
 * Completed ledger repeats preserve later edits, clears and deleted projects.
 *
 * @param {object} current Complete fresh raw Redis portfolio, never an old seed/public projection.
 * @param {ProjectCollectionsPlan} plan Independently approved exact old values and new assignments.
 * @param {{alreadyApplied?:boolean}} [options={}] This migration's independent ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Full raw candidate, safe IDs/counts and compact JSON SHA-256.
 * @throws {Error} Scope, raw presence, identity/category, narrative, assignment or preservation proof fails.
 */
export function planProjectCollectionAssignments(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Project collections require the complete raw portfolio.");
  }
  const data = structuredClone(current);
  const report = { migrationId: PROJECT_COLLECTIONS_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "patches"]) || plan.version !== 1 || plan.migrationId !== PROJECT_COLLECTIONS_MIGRATION_ID ||
      !Array.isArray(plan.patches) || plan.patches.length !== PROJECT_COLLECTION_ASSIGNMENTS.length) {
    throw new Error("Project collections require exactly fifteen reviewed patches.");
  }
  const seen = new Set();
  for (const patch of plan.patches) {
    if (!keysEqual(patch, ["match", "expected", "expectedNarrative", "collections", "rationale"]) ||
        !keysEqual(patch.match, ["id", "category", "name"]) || !Object.values(patch.match).every(value => typeof value === "string" && value.trim()) ||
        !keysEqual(patch.expected, ["exists", "collections"]) || typeof patch.expected.exists !== "boolean" || !strings(patch.expected.collections) ||
        (!patch.expected.exists && patch.expected.collections.length !== 0) ||
        !keysEqual(patch.expectedNarrative, ["description", "contribution"]) || !Object.values(patch.expectedNarrative).every(value => typeof value === "string") ||
        typeof patch.rationale !== "string" || !patch.rationale.trim()) throw new Error("Invalid reviewed project collections patch.");
    const approved = PROJECT_COLLECTION_ASSIGNMENTS.find(target => target.id === patch.match.id);
    if (!approved || seen.has(approved.id) || patch.match.category !== approved.category ||
        !isDeepStrictEqual(patch.collections, approved.collections)) throw new Error("Project collections differ from the approved identity/category/ordered mapping.");
    const indexes = current.projects.flatMap((row, index) => row.id === approved.id ? [index] : []);
    if (indexes.length !== 1) throw new Error("Project collection target is missing or ambiguous.");
    const [index] = indexes; const row = current.projects[index];
    if (!Object.entries(patch.match).every(([key, value]) => row[key] === value) ||
        Object.hasOwn(row, "collections") !== patch.expected.exists ||
        (patch.expected.exists && (!strings(row.collections) || !isDeepStrictEqual(row.collections, patch.expected.collections))) ||
        !Object.entries(patch.expectedNarrative).every(([key, value]) => row[key] === value)) {
      throw new Error("Stale raw project presence, labels, identity or narrative; review a fresh snapshot.");
    }
    data.projects[index].collections = [...patch.collections];
    seen.add(approved.id);
    report.changes.push({ collection: "projects", id: approved.id, fields: ["collections"],
      previouslyPresent: patch.expected.exists, oldCount: patch.expected.collections.length, newCount: patch.collections.length });
  }
  const mask = value => { const copy = structuredClone(value);
    for (const row of copy.projects) if (seen.has(row.id)) delete row.collections;
    return copy;
  };
  const before = normalizePortfolioData(current); const after = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(after).valid || !isDeepStrictEqual(mask(current), mask(data)) ||
      !isDeepStrictEqual(mask(before), mask(after)) || PROJECT_COLLECTION_ASSIGNMENTS.some(target =>
        !isDeepStrictEqual(after.projects.find(row => row.id === target.id)?.collections, target.collections))) {
    throw new Error("Project collections full raw/public preservation proof failed.");
  }
  report.changed = true;
  return finish();
}

/**
 * Previews by default; applies only a separately approved collections candidate.
 * Exact source/candidate hashes, a byte-identical complete prepared backup and
 * deployment check guard the shared raw CAS, original Redis backup and new
 * independent ledger. Stale/concurrent sources abort; repeats never restore
 * later edited/cleared labels or deleted records. No asset operation occurs.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:ProjectCollectionsPlan,expectedCandidateHash?:string}} [options={}] Raw Redis, reviewed plan and explicit apply guards.
 * @returns {Promise<object>} Proposed data, safe field/count/hash report and backup references.
 * @throws {Error} Mode, scope, exact backup/hash/deployment or concurrent CAS guards fail.
 */
export async function migrateProjectCollectionsRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Project collections dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Project collections apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: PROJECT_COLLECTIONS_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Project collections backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planProjectCollectionAssignments(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) throw new Error("Project collections candidate differs from the confirmed preview.");
      return result;
    }
  });
}
