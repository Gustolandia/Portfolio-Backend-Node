import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { EDUCATION_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { normalizeSkills } from "./skillAliases.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const EDUCATION_SKILLS_MIGRATION_ID = "education-skills-2026-10-16-v1";
const IDENTITY_FIELDS = ["degree", "institution", "start", "end"];
const SUMMARY_RULES = {
  "Cloud Computing": { skills: ["AWS", "Microsoft Azure", "Cloud Native Computing"], course: /\b(AWS|Azure|Cloud)\b/i },
  "Database Management": { skills: ["SQL", "MySQL", "PostgreSQL", "MongoDB", "NoSQL"], course: /\b(databases?|SQL|MySQL|PostgreSQL|MongoDB|Spring Data)\b/i },
  "API Development": { skills: ["REST APIs"], course: /\b(REST|Express|HTTP)\b/i }
};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, fields) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...fields].sort());
const sha = value => createHash("sha256").update(value).digest("hex");

/**
 * @typedef {object} EducationSkillEvidence
 * @property {string} skill One of the three explicitly supported broad summaries.
 * @property {string[]} sourceSkills Existing canonical skills supporting this summary.
 * @property {string[]} sourceCourses Exact existing course strings supporting it.
 *
 * @typedef {object} EducationSkillPatch
 * @property {{degree:string,institution:string,start:string,end:string}} match Exact original period, never fuzzy matched.
 * @property {string[]} expectedSkills Complete original raw array, including its order.
 * @property {string[]} skills One to seven reviewed canonical labels, fewer than before.
 * @property {EducationSkillEvidence[]} evidence Witnesses for every new broad label, and no others.
 *
 * @typedef {object} EducationSkillsPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal EDUCATION_SKILLS_MIGRATION_ID.
 * @property {EducationSkillPatch[]} patches Explicit per-record reductions.
 */

/**
 * Plans education-only skill reduction without modifying its input or storage.
 *
 * The candidate changes only matched education.skills arrays. All records/order,
 * unknown raw fields, courses, grades, dates, maps, media tuples, collections,
 * profile/thesis copy and other sections' skills remain exact. Existing skills
 * may be retained; only Cloud Computing, Database Management and API Development
 * can summarize explicit source skills AND exact matching course witnesses.
 * This does not add achievements or change global skill aliases. Stale arrays,
 * ambiguous periods, unsupported summaries and out-of-scope plan fields fail.
 * A completed independent ledger makes repeats no-ops, preserving later edits.
 *
 * @param {object} current Complete raw Redis snapshot, not public normalized JSON.
 * @param {EducationSkillsPlan} plan Separately reviewed operations.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent migration ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Raw candidate, count-only report and compact JSON SHA-256.
 * @throws {Error} Scope, identity, source evidence or candidate validation fails.
 */
export function planEducationSkillsMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row))) ||
      current.education.some(row => !strings(row.skills))) {
    throw new Error("Education skill review requires a complete raw snapshot with explicit skill arrays.");
  }
  const data = structuredClone(current);
  const report = { migrationId: EDUCATION_SKILLS_MIGRATION_ID, alreadyApplied, changed: false, changes: [],
    beforeOccurrences: current.education.reduce((sum, row) => sum + row.skills.length, 0) };
  const finish = () => ({ data, report: { ...report,
    afterOccurrences: data.education.reduce((sum, row) => sum + row.skills.length, 0) }, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "patches"]) || plan.version !== 1 ||
      plan.migrationId !== EDUCATION_SKILLS_MIGRATION_ID || !Array.isArray(plan.patches) || !plan.patches.length) {
    throw new Error("Invalid education skill review plan.");
  }
  const touched = new Set();
  for (const patch of plan.patches) {
    if (!keysEqual(patch, ["match", "expectedSkills", "skills", "evidence"]) ||
        !keysEqual(patch.match, IDENTITY_FIELDS) || !Object.values(patch.match).every(value => typeof value === "string") ||
        !strings(patch.expectedSkills) || !strings(patch.skills) || !Array.isArray(patch.evidence)) {
      throw new Error("Education skill review accepts only exact periods, skill arrays and evidence.");
    }
    const matches = current.education.flatMap((row, index) =>
      IDENTITY_FIELDS.every(field => row[field] === patch.match[field]) ? [index] : []);
    if (matches.length !== 1) throw new Error("Education skill target is missing or ambiguous.");
    const [index] = matches;
    const original = current.education[index];
    if (touched.has(index) || !isDeepStrictEqual(original.skills, patch.expectedSkills)) {
      throw new Error("Stale or duplicate education skill operation.");
    }
    touched.add(index);
    if (!patch.skills.length || patch.skills.length > 7 || patch.skills.length >= original.skills.length ||
        patch.skills.some(skill => !skill.trim()) || !isDeepStrictEqual(normalizeSkills(patch.skills), patch.skills)) {
      throw new Error("Education skill curation requires one to seven distinct canonical labels and a strict reduction.");
    }
    const existing = normalizeSkills(original.skills);
    const summaries = patch.skills.filter(skill => !existing.includes(skill));
    const evidenceBySkill = new Map();
    for (const witness of patch.evidence) {
      if (!keysEqual(witness, ["skill", "sourceSkills", "sourceCourses"]) || typeof witness.skill !== "string" ||
          !summaries.includes(witness.skill) || evidenceBySkill.has(witness.skill) ||
          !strings(witness.sourceSkills) || !witness.sourceSkills.length ||
          !strings(witness.sourceCourses) || !witness.sourceCourses.length) {
        throw new Error("Each new education summary requires unique explicit source evidence.");
      }
      const rule = Object.hasOwn(SUMMARY_RULES, witness.skill) ? SUMMARY_RULES[witness.skill] : null;
      if (!rule || !strings(original.courses) || witness.sourceSkills.some(skill => !existing.includes(skill) || !rule.skills.includes(skill)) ||
          witness.sourceCourses.some(course => !original.courses?.includes(course) || !rule.course.test(course))) {
        throw new Error("Education summary is unsupported by this record's existing skills and courses.");
      }
      evidenceBySkill.set(witness.skill, witness);
    }
    if (summaries.some(skill => !evidenceBySkill.has(skill))) throw new Error("New education labels require reviewed summary evidence.");
    data.education[index].skills = [...patch.skills];
    report.changes.push({ index, field: "skills", beforeCount: original.skills.length, afterCount: patch.skills.length, summaryLabels: summaries });
  }
  const mask = value => {
    const copy = structuredClone(value);
    for (const index of touched) delete copy.education[index].skills;
    return copy;
  };
  if (!isDeepStrictEqual(mask(current), mask(data))) throw new Error("Education skill field-scope proof failed.");
  const before = normalizePortfolioData(current);
  const after = normalizePortfolioData(data);
  const publicMask = value => {
    const copy = structuredClone(value);
    copy.education.forEach(row => delete row.skills);
    return copy;
  };
  if (!validateCompletePortfolioPayload(after).valid || !isDeepStrictEqual(publicMask(before), publicMask(after))) {
    throw new Error("Education skill candidate changed unrelated public content or failed validation.");
  }
  const rawOrder = normalizeRichArray(data.education, EDUCATION_FIELDS);
  for (const index of touched) {
    if (!isDeepStrictEqual(rawOrder[index].skills, data.education[index].skills)) {
      throw new Error("Education skill labels would change during API normalization.");
    }
  }
  report.changed = true;
  return finish();
}

/**
 * Previews by default; explicitly applies one reviewed education-only candidate.
 *
 * Reuses the shared atomic raw-value CAS, exact original backup and separate
 * ledger. Apply requires both SHA-256 hashes, a byte-identical private backup
 * and deployment verification. Stale sources, changed candidates, concurrent
 * writes or uncertain modes cannot write Redis. Repeats do not restore edits.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:EducationSkillsPlan,expectedCandidateHash?:string}} options Raw Redis, reviewed plan and safety guards.
 * @returns {Promise<object>} Preview or apply receipt; never credentials.
 * @throws {Error} Guard or planner verification fails before an authorized write.
 */
export async function migrateEducationSkillsRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Education skill dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) {
    throw new Error("Education skill apply requires the candidate SHA-256.");
  }
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: EDUCATION_SKILLS_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Education skill backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planEducationSkillsMigration(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Education skill candidate differs from the reviewed preview.");
      }
      return result;
    }
  });
}
