import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { JOB_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { normalizeSkills } from "./skillAliases.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const PROFESSIONAL_SKILLS_MIGRATION_ID = "professional-skills-2026-10-16-v1";
export const PROFESSIONAL_JOB_IDS = Object.freeze([
  "job-linkedin-boscasports-2025-09", "job-linkedin-invertase-2024-10", "job-linkedin-xerotech-2024-01",
  "job-598ecb6377d96d3e95c9adbf", "job-2fd5cc4b22e6e527a835b835", "job-linkedin-covalen-2019-09",
  "job-07971db6dcd4575142c128f3", "job-036963ac120af57f22fcf614", "job-8a8a1640190a0ce47953978c",
  "job-b103e2ba7ee07cf79497e9d1", "job-636bd8253182ac041a72f4c2", "job-2a379fbf30b14b23f81c9998"
]);
const UNCHANGED_IDS = new Set(["job-linkedin-invertase-2024-10", "job-linkedin-covalen-2019-09"]);
const XEROTECH_STORAGE = "Integrated AWS storage for remote access and optimised MongoDB for time-series data.";
const VERTU_INFRASTRUCTURE = "Managed AWS infrastructure for mobile applications and implemented CI/CD pipelines.";
const SUMMARY_RULES = {
  "job-linkedin-boscasports-2025-09": {
    "Cloud Computing": { sourceSkills: ["AWS"], sourceDuties: [
      "Improved production reliability through Jest tests, AWS EC2 support, PM2, cron automation, nginx routing and logging."
    ] }
  },
  "job-linkedin-xerotech-2024-01": {
    "Cloud Computing": { sourceSkills: ["AWS"], sourceDuties: [XEROTECH_STORAGE] },
    "Database Management": { sourceSkills: ["MongoDB"], sourceDuties: [XEROTECH_STORAGE] },
    "DevOps": { sourceSkills: ["Docker", "CI/CD"], sourceDuties: [
      "Deployed and managed containerised applications using Docker.",
      "Automated CI/CD workflows with Jenkins and tested backend APIs using Jest and Supertest."
    ] }
  },
  "job-598ecb6377d96d3e95c9adbf": {
    "Web Development": { sourceSkills: ["React", "HTML", "CSS", "Bootstrap", "JavaScript"], sourceDuties: [
      "Helped migrate the Portal website to React and built reusable components for the DattoUI Storybook."
    ] }
  },
  "job-2fd5cc4b22e6e527a835b835": {
    "Statistics": { sourceSkills: ["Data Analysis", "Python", "SQL"], sourceDuties: [
      "Used Python (NumPy and SciPy) and SQL for hypothesis testing, regression and ANOVA to investigate content-quality errors."
    ] }
  },
  "job-8a8a1640190a0ce47953978c": {
    "Cloud Computing": { sourceSkills: ["AWS"], sourceDuties: [VERTU_INFRASTRUCTURE] },
    "API Development": { sourceSkills: [], sourceDuties: ["Developed REST APIs and internal tools."] },
    "DevOps": { sourceSkills: ["AWS"], sourceDuties: [VERTU_INFRASTRUCTURE] },
    "Automation": { sourceSkills: [], sourceDuties: ["Automated routine tasks with shell scripts."] }
  }
};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");
const scoped = rows => rows.filter(row => PROFESSIONAL_JOB_IDS.includes(row.id) && ["industry", "teaching"].includes(row.category));

/**
 * @typedef {object} ProfessionalSkillEvidence
 * @property {string} skill Reviewed role-specific summary label.
 * @property {string[]} sourceSkills Exact canonical source witnesses; [] denotes explicitly duty-only evidence.
 * @property {string[]} sourceDuties Exact reviewed sentences already recorded on this same role.
 *
 * @typedef {object} ProfessionalSkillPatch
 * @property {{id:string,category:string,title:string,company:string}} match Persisted allow-listed non-research identity.
 * @property {string[]} expectedSkills Complete original raw skill array and order.
 * @property {string[]} expectedDuties Complete original raw duty array and order.
 * @property {string[]} skills At most six reviewed canonical labels; protected concise/empty lists stay exact.
 * @property {ProfessionalSkillEvidence[]} evidence Every new summary, with no extra or inferred witnesses.
 *
 * @typedef {object} ProfessionalSkillsPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal PROFESSIONAL_SKILLS_MIGRATION_ID.
 * @property {ProfessionalSkillPatch[]} patches Exactly the twelve reviewed role IDs, each once.
 */

/**
 * Previews only the reviewed professional jobs' skill reductions, without writes.
 *
 * All research rows and every non-skills field remain exact, including role
 * category/identity/order, duties, ranks, dates, media tuples/maps, collections,
 * education/project/research skills and blank residence. Both raw and canonical
 * counts are checked: a reduction cannot secretly increase normalized tags.
 * Invertase and Covalen remain byte-equivalent JSON records; empty Covalen tags
 * never generate claims. New broad labels require pinned record-local skills
 * and exact already-recorded duty sentences; Vertu API/automation evidence is
 * explicitly duty-only, without inferring a language or proficiency level.
 * A completed independent ledger preserves later edits/deletions on repeats.
 *
 * @param {object} current Complete raw Redis snapshot, never public JSON or a seed.
 * @param {ProfessionalSkillsPlan} plan Separately reviewed twelve-role mapping.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent migration ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Raw candidate, count-only review report and compact JSON SHA-256.
 * @throws {Error} Scope, source arrays, identity, evidence or preservation fails.
 */
export function planProfessionalSkillsMigration(current, plan, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Professional skill review requires a complete raw snapshot.");
  }
  const originalRows = scoped(current.jobs);
  if (originalRows.some(row => !strings(row.skills) || !strings(row.duties))) {
    throw new Error("Professional skill review requires explicit raw skills and duties.");
  }
  const data = structuredClone(current);
  const report = { migrationId: PROFESSIONAL_SKILLS_MIGRATION_ID, alreadyApplied, changed: false, roles: [], changes: [],
    rawBeforeOccurrences: originalRows.reduce((sum, row) => sum + row.skills.length, 0),
    normalizedBeforeOccurrences: originalRows.reduce((sum, row) => sum + normalizeSkills(row.skills).length, 0) };
  const finish = () => ({ data, report: { ...report,
    rawAfterOccurrences: scoped(data.jobs).reduce((sum, row) => sum + row.skills.length, 0),
    normalizedAfterOccurrences: scoped(data.jobs).reduce((sum, row) => sum + normalizeSkills(row.skills).length, 0)
  }, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "patches"]) || plan.version !== 1 ||
      plan.migrationId !== PROFESSIONAL_SKILLS_MIGRATION_ID || !Array.isArray(plan.patches) ||
      plan.patches.length !== PROFESSIONAL_JOB_IDS.length) throw new Error("Professional plan requires exactly the twelve reviewed roles.");
  const seenIds = new Set();
  const changedIndexes = new Set();
  for (const patch of plan.patches) {
    if (!keysEqual(patch, ["match", "expectedSkills", "expectedDuties", "skills", "evidence"]) ||
        !keysEqual(patch.match, ["id", "category", "title", "company"]) ||
        !Object.values(patch.match).every(value => typeof value === "string") ||
        !PROFESSIONAL_JOB_IDS.includes(patch.match.id) || !["industry", "teaching"].includes(patch.match.category) ||
        !strings(patch.expectedSkills) || !strings(patch.expectedDuties) || !strings(patch.skills) || !Array.isArray(patch.evidence)) {
      throw new Error("Professional plan accepts only reviewed persisted non-research IDs, skill arrays and local evidence.");
    }
    const matches = current.jobs.flatMap((row, index) => row.id === patch.match.id ? [index] : []);
    if (matches.length !== 1) throw new Error("Professional target is missing or ambiguous.");
    const [index] = matches;
    const row = current.jobs[index];
    if (seenIds.has(row.id) || !Object.entries(patch.match).every(([key, value]) => row[key] === value) ||
        !isDeepStrictEqual(row.skills, patch.expectedSkills) || !isDeepStrictEqual(row.duties, patch.expectedDuties)) {
      throw new Error("Stale or duplicate professional skill operation.");
    }
    seenIds.add(row.id);
    const canonical = normalizeSkills(row.skills);
    const unchanged = UNCHANGED_IDS.has(row.id);
    if (!isDeepStrictEqual(normalizeSkills(patch.skills), patch.skills) || patch.skills.length > 6 ||
        (unchanged ? !isDeepStrictEqual(row.skills, patch.skills) : !patch.skills.length || patch.skills.length >= canonical.length) ||
        (row.id === "job-linkedin-covalen-2019-09" && row.skills.length !== 0)) {
      throw new Error("Professional curation requires canonical reductions; protected concise/empty skills stay exact.");
    }
    const summaries = patch.skills.filter(skill => !canonical.includes(skill));
    const evidence = new Map();
    for (const witness of patch.evidence) {
      if (!keysEqual(witness, ["skill", "sourceSkills", "sourceDuties"]) || typeof witness.skill !== "string" ||
          !summaries.includes(witness.skill) || evidence.has(witness.skill) || !strings(witness.sourceSkills) ||
          !strings(witness.sourceDuties) || !witness.sourceDuties.length) throw new Error("New professional labels require unique local evidence.");
      const rules = Object.hasOwn(SUMMARY_RULES, row.id) ? SUMMARY_RULES[row.id] : {};
      const rule = Object.hasOwn(rules, witness.skill) ? rules[witness.skill] : null;
      if (!rule || !isDeepStrictEqual(witness.sourceSkills, rule.sourceSkills) ||
          !isDeepStrictEqual(witness.sourceDuties, rule.sourceDuties) ||
          witness.sourceSkills.some(skill => !canonical.includes(skill)) ||
          witness.sourceDuties.some(duty => !row.duties.includes(duty))) {
        throw new Error("Professional summary lacks its reviewed record-local skill/duty evidence.");
      }
      evidence.set(witness.skill, witness);
    }
    if (summaries.some(skill => !evidence.has(skill))) throw new Error("New professional labels require reviewed evidence.");
    const role = { index, id: row.id, rawBeforeCount: row.skills.length, normalizedBeforeCount: canonical.length,
      afterCount: patch.skills.length, changed: !unchanged, summaryLabels: summaries };
    report.roles.push(role);
    if (!unchanged) {
      data.jobs[index].skills = [...patch.skills];
      changedIndexes.add(index);
      report.changes.push({ index, id: row.id, field: "skills" });
    }
  }
  if (seenIds.size !== PROFESSIONAL_JOB_IDS.length) throw new Error("Professional plan omitted a reviewed role.");
  const rawMask = value => {
    const copy = structuredClone(value);
    for (const index of changedIndexes) delete copy.jobs[index].skills;
    return copy;
  };
  const changedIds = new Set([...changedIndexes].map(index => current.jobs[index].id));
  const publicMask = value => {
    const copy = structuredClone(value);
    copy.jobs.forEach(row => { if (changedIds.has(row.id)) delete row.skills; });
    return copy;
  };
  const before = normalizePortfolioData(current);
  const after = normalizePortfolioData(data);
  if (!isDeepStrictEqual(rawMask(current), rawMask(data)) || !validateCompletePortfolioPayload(after).valid ||
      !isDeepStrictEqual(publicMask(before), publicMask(after))) throw new Error("Professional skill field-scope/preservation proof failed.");
  const rawOrder = normalizeRichArray(data.jobs, JOB_FIELDS);
  for (const index of changedIndexes) {
    if (!isDeepStrictEqual(rawOrder[index].skills, data.jobs[index].skills)) throw new Error("Professional skill labels would change during API normalization.");
  }
  report.changed = changedIndexes.size > 0;
  return finish();
}

/**
 * Previews by default; applies only a separately confirmed professional plan.
 *
 * Uses the existing raw-value CAS and a new independent ledger. Both exact
 * hashes, a byte-identical original backup and deployment verification are
 * mandatory for apply. Stale/concurrent edits, changed candidates and failed
 * backups cannot overwrite data. A ledger repeat never restores later edits.
 * Publishing this helper never changes skills or invokes older migrations.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:ProfessionalSkillsPlan,expectedCandidateHash?:string}} options Raw Redis, confirmed mapping and explicit safety guards.
 * @returns {Promise<object>} Preview or apply receipt, never credentials.
 * @throws {Error} An ambiguous mode, guard or field/evidence check fails.
 */
export async function migrateProfessionalSkillsRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Professional skill dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) {
    throw new Error("Professional skill apply requires the candidate SHA-256.");
  }
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: PROFESSIONAL_SKILLS_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Professional skill backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planProfessionalSkillsMigration(current, options.plan, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) {
        throw new Error("Professional skill candidate differs from the confirmed preview.");
      }
      return result;
    }
  });
}
