import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { JOB_FIELDS, PROJECT_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { normalizeSkills } from "./skillAliases.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const RESEARCH_PROJECT_SKILLS_MIGRATION_ID = "research-project-skills-2026-10-16-v1";
export const RESEARCH_SKILL_JOB_IDS = Object.freeze([
  "job-44a10c8d45ae3eaaa582ac9c", "job-f690ecbeb2d0b20497aba63b", "job-dd51274e5e20da7c1715b4fe",
  "job-9f528b7842a0aa7ab1d817da", "job-e3dab59ed6334e53ad5302c2"
]);
export const SKILL_PROJECT_IDS = Object.freeze([
  "research-eartharxiv-15189", "research-arxiv-2608-27736", "research-arxiv-2609-05584", "research-arxiv-2608-11228",
  "project-1930afed6e1b31fc8e95b24e", "project-e5a9d2ac9375ff84851016ad", "project-829a53079026e22c418fda42",
  "project-20e3c4c3fa44a48fd5ff553d", "project-739137b5bba481267f708c82", "project-6f2264d4a653de434559ad0d",
  "project-38981053924e2c7d93a437c8", "project-c2307a8588da6647db62d7b3", "project-c1f062a755abff4388000db1",
  "project-701dc8ee8551735c9de9d27d", "research-zenodo-22044877"
]);
export const PROTECTED_SKILL_PROJECT_IDS = Object.freeze([
  "research-arxiv-2608-27736", "research-arxiv-2609-05584", "research-arxiv-2608-11228", "research-zenodo-22044877"
]);
const PROJECT_CATEGORIES = ["research", "research", "research", "research", "software", "software", "software", "software",
  "data", "coursework", "software", "research", "research", "research", "research"];
const SCOPE = [
  ...RESEARCH_SKILL_JOB_IDS.map(id => ({ collection: "jobs", id, category: "research" })),
  ...SKILL_PROJECT_IDS.map((id, index) => ({ collection: "projects", id, category: PROJECT_CATEGORIES[index] }))
];
const CAR_DESCRIPTION = "A carpooling application with Spring Boot microservices for users, rides and reviews, backed by MySQL and Docker. Gillian Middleton developed the Vue.js frontend; a recorded demonstration and project reports document the work.";
const CAR_CONTRIBUTION = "Developed most of the Spring Boot backend for CarSurfing, a microservices-based carpooling service.";
const LINKEDIN_DESCRIPTION = "A professional-networking application built with an Express.js/MongoDB backend and a React/Bootstrap frontend. Includes authentication, profiles, experience records and posts.";
const SUMMARY_RULES = {
  "project-1930afed6e1b31fc8e95b24e": {
    "Database Management": { sourceSkills: ["MySQL"], sourceNarrative: [] }
  },
  "project-e5a9d2ac9375ff84851016ad": {
    "Database Management": { sourceSkills: ["MySQL"], sourceNarrative: [{ field: "description", value: CAR_DESCRIPTION }] },
    "API Development": { sourceSkills: ["REST APIs"], sourceNarrative: [
      { field: "description", value: CAR_DESCRIPTION }, { field: "contribution", value: CAR_CONTRIBUTION }
    ] }
  },
  "project-38981053924e2c7d93a437c8": {
    "Database Management": { sourceSkills: ["MongoDB"], sourceNarrative: [{ field: "description", value: LINKEDIN_DESCRIPTION }] },
    "API Development": { sourceSkills: ["REST APIs"], sourceNarrative: [{ field: "description", value: LINKEDIN_DESCRIPTION }] }
  }
};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");
const totals = value => Object.fromEntries(["jobs", "projects"].map(collection => {
  const rows = value[collection].filter(row => SCOPE.some(spec => spec.collection === collection && spec.id === row.id));
  return [collection, { raw: rows.reduce((sum, row) => sum + row.skills.length, 0),
    normalized: rows.reduce((sum, row) => sum + normalizeSkills(row.skills).length, 0) }];
}));

/**
 * @typedef {object} ResearchProjectSkillEvidence
 * @property {string} skill New reviewed broad project label, never a new role claim.
 * @property {string[]} sourceSkills Exact same-record canonical source tags.
 * @property {{field:string,value:string}[]} sourceNarrative Exact recorded narrative witnesses; Filebox database evidence is honestly skills-only ([]).
 *
 * @typedef {object} ResearchProjectSkillPatch
 * @property {'jobs'|'projects'} collection Exact allow-listed collection.
 * @property {object} match Exact id/category/title/company for jobs, id/category/name for projects.
 * @property {string[]} expectedSkills Complete original raw array and order.
 * @property {{duties:string[]}|{description:string,contribution:string}} expectedNarrative Complete existing duty or project narrative fields, unchanged.
 * @property {string[]} skills Reviewed canonical reduction, or exact protected original.
 * @property {ResearchProjectSkillEvidence[]} evidence Every newly introduced broad label, without inferred witnesses.
 *
 * @typedef {object} ResearchProjectSkillsPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal RESEARCH_PROJECT_SKILLS_MIGRATION_ID.
 * @property {ResearchProjectSkillPatch[]} patches Exactly five research jobs and fifteen projects, each once.
 */

/**
 * Builds the separately reviewed research/job and project skill-only candidate.
 *
 * Only the exact five research-role IDs and eleven reducible project IDs may
 * change. Four already-concise project records remain entire and exact; twelve
 * professional/teaching roles, seven education periods, all narrative/scientific
 * wording, thesis/profile, bylines, statuses, collections, dates, relationships,
 * maps, raw order and ordered media tuples are preserved. No global aliases,
 * runtime schema, ordinary admin caps or startup/GET behavior change.
 * Roles retain existing canonical skills only. Five reviewed broad project
 * labels require per-ID evidence: exact source tags and, where specified, exact
 * recorded narrative. Filebox's MySQL tag suffices for its database summary;
 * its description is not falsely claimed to mention MySQL. No cross-record
 * inference, new tool, proficiency or original-research claim is allowed.
 *
 * @param {object} current Complete raw Redis snapshot, never a seed/public projection.
 * @param {ResearchProjectSkillsPlan} plan Exact identity/source/narrative mapping confirmed separately.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent Redis ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Raw candidate, safe count/ID report and compact raw JSON SHA-256.
 * @throws {Error} Scope, stale source, evidence, normalized counts or full preservation fails.
 */
export function planResearchProjectSkillsMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Research/project skills require a complete raw snapshot.");
  }
  for (const spec of SCOPE) {
    if (current[spec.collection].some(row => row.id === spec.id && !strings(row.skills))) {
      throw new Error("Research/project skills require explicit raw skill arrays.");
    }
  }
  const data = structuredClone(current);
  const report = { migrationId: RESEARCH_PROJECT_SKILLS_MIGRATION_ID, alreadyApplied, changed: false,
    before: totals(current), records: [], changes: [] };
  const finish = () => ({ data, report: { ...report, after: totals(data) }, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "patches"]) || plan.version !== 1 ||
      plan.migrationId !== RESEARCH_PROJECT_SKILLS_MIGRATION_ID || !Array.isArray(plan.patches) || plan.patches.length !== SCOPE.length) {
    throw new Error("Research/project plan requires exactly the twenty reviewed records.");
  }
  const seen = new Set();
  for (const patch of plan.patches) {
    if (!keysEqual(patch, ["collection", "match", "expectedSkills", "expectedNarrative", "skills", "evidence"]) ||
        !["jobs", "projects"].includes(patch.collection) || !strings(patch.expectedSkills) || !strings(patch.skills) ||
        !Array.isArray(patch.evidence) || !keysEqual(patch.match, patch.collection === "jobs" ? ["id", "category", "title", "company"] : ["id", "category", "name"]) ||
        !Object.values(patch.match).every(value => typeof value === "string")) throw new Error("Invalid research/project skill operation.");
    const { collection } = patch;
    const spec = SCOPE.find(spec => spec.collection === collection && spec.id === patch.match.id && spec.category === patch.match.category);
    if (!spec || seen.has(spec.id)) throw new Error("Research/project target is out of scope or duplicate.");
    const matches = current[collection].flatMap((row, index) => row.id === spec.id ? [index] : []);
    if (matches.length !== 1) throw new Error("Research/project target is missing or ambiguous.");
    const [index] = matches; const row = current[collection][index];
    const narrativeKeys = collection === "jobs" ? ["duties"] : ["description", "contribution"];
    if (!keysEqual(patch.expectedNarrative, narrativeKeys) ||
        (collection === "jobs" ? !strings(row.duties) || !strings(patch.expectedNarrative.duties)
          : narrativeKeys.some(key => typeof row[key] !== "string" || typeof patch.expectedNarrative[key] !== "string")) ||
        !Object.entries(patch.match).every(([key, value]) => row[key] === value) ||
        !isDeepStrictEqual(row.skills, patch.expectedSkills) ||
        !isDeepStrictEqual(Object.fromEntries(narrativeKeys.map(key => [key, row[key]])), patch.expectedNarrative)) {
      throw new Error("Stale research/project identity, skills or narrative.");
    }
    seen.add(spec.id);
    const canonical = normalizeSkills(row.skills);
    const protectedRecord = collection === "projects" && PROTECTED_SKILL_PROJECT_IDS.includes(row.id);
    if (!isDeepStrictEqual(normalizeSkills(patch.skills), patch.skills) || patch.skills.length > 6 ||
        (protectedRecord ? !isDeepStrictEqual(row.skills, patch.skills) : !patch.skills.length || patch.skills.length >= canonical.length)) {
      throw new Error("Research/project skills require canonical reductions; protected lists stay exact.");
    }
    const summaries = patch.skills.filter(skill => !canonical.includes(skill));
    const evidence = new Set();
    for (const witness of patch.evidence) {
      if (!keysEqual(witness, ["skill", "sourceSkills", "sourceNarrative"]) || !summaries.includes(witness.skill) ||
          evidence.has(witness.skill) || !strings(witness.sourceSkills) || !Array.isArray(witness.sourceNarrative)) {
        throw new Error("New project labels require unique reviewed evidence.");
      }
      const rules = Object.hasOwn(SUMMARY_RULES, row.id) ? SUMMARY_RULES[row.id] : {};
      const rule = collection === "projects" && Object.hasOwn(rules, witness.skill) ? rules[witness.skill] : null;
      if (!rule || !isDeepStrictEqual(witness.sourceSkills, rule.sourceSkills) || !isDeepStrictEqual(witness.sourceNarrative, rule.sourceNarrative) ||
          witness.sourceSkills.some(skill => !canonical.includes(skill)) ||
          witness.sourceNarrative.some(item => row[item.field] !== item.value)) throw new Error("Project summary lacks exact record-local evidence.");
      evidence.add(witness.skill);
    }
    if (summaries.some(skill => !evidence.has(skill))) throw new Error("New research/project labels require reviewed evidence.");
    report.records.push({ collection, index, id: row.id, rawBeforeCount: row.skills.length,
      normalizedBeforeCount: canonical.length, afterCount: patch.skills.length, changed: !protectedRecord, summaryLabels: summaries });
    if (!protectedRecord) {
      data[collection][index].skills = [...patch.skills];
      report.changes.push({ collection, index, id: row.id, field: "skills" });
    }
  }
  const changed = new Set(report.changes.map(item => item.collection + ":" + item.id));
  const mask = value => {
    const copy = structuredClone(value);
    for (const collection of ["jobs", "projects"]) copy[collection].forEach(row => { if (changed.has(collection + ":" + row.id)) delete row.skills; });
    return copy;
  };
  const normalized = normalizePortfolioData(data);
  if (!isDeepStrictEqual(mask(current), mask(data)) || !validateCompletePortfolioPayload(normalized).valid ||
      !isDeepStrictEqual(mask(normalizePortfolioData(current)), mask(normalized))) throw new Error("Research/project full field-scope preservation failed.");
  for (const [collection, fields] of [["jobs", JOB_FIELDS], ["projects", PROJECT_FIELDS]]) {
    const rawOrder = normalizeRichArray(data[collection], fields);
    for (const item of report.changes.filter(item => item.collection === collection)) {
      if (!isDeepStrictEqual(rawOrder[item.index].skills, data[collection][item.index].skills)) {
        throw new Error("Research/project target labels would change during API normalization.");
      }
    }
  }
  report.changed = report.changes.length > 0;
  return finish();
}

/**
 * Previews by default; applies only a separately confirmed skills-only candidate.
 *
 * Uses existing atomic raw-value CAS/backup logic with its own independent
 * ledger. Apply requires both exact source/candidate hashes, deployment check
 * and a complete original backup; prepared backups must match every source byte.
 * Concurrent/stale edits abort. Ledger repeats never restore later edits or
 * deletions. Publishing this tool never runs it or replays any older migration.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:ResearchProjectSkillsPlan,expectedCandidateHash?:string}} [options={}] Raw Redis, reviewed plan and explicit apply guards.
 * @returns {Promise<object>} Safe preview/application receipt, never credentials.
 * @throws {Error} Ambiguous mode, scope/evidence or backup/hash/deployment/CAS checks fail.
 */
export async function migrateResearchProjectSkillsRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Research/project skill dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) {
    throw new Error("Research/project skill apply requires the candidate SHA-256.");
  }
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: RESEARCH_PROJECT_SKILLS_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Research/project skill backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planResearchProjectSkillsMigration(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Research/project skill candidate differs from the confirmed preview.");
      }
      return result;
    }
  });
}
