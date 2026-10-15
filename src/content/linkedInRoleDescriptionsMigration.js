import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { JOB_FIELDS, PAGE_KEYS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { LINKEDIN_JOB_ADDITIONS } from "./linkedInContentMigration.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const LINKEDIN_ROLE_DESCRIPTIONS_MIGRATION_ID = "linkedin-role-descriptions-2026-10-15-v1";

const REVIEWED_DUTIES = {
  "job-598ecb6377d96d3e95c9adbf": [
    "Helped migrate the Portal website to React and built reusable components for the DattoUI Storybook.",
    "Wrote Jest unit tests for Portal and DattoUI components.",
    "Investigated and resolved Portal issues in React/TypeScript and Symfony/PHP.",
    "Participated in Scrum stand-ups and demos."
  ],
  "job-44a10c8d45ae3eaaa582ac9c": [
    "Worked on CarSurfing, a cloud-based carpooling service with a microservices architecture focused on scalability and accessibility."
  ],
  "job-2fd5cc4b22e6e527a835b835": [
    "Used Python (NumPy and SciPy) and SQL for hypothesis testing, regression and ANOVA to investigate content-quality errors.",
    "Prepared analysis datasets using ETL tools and contributed insights to video and search-autofill projects.",
    "Led the English Hashtag Analysis Team and organised calibration meetings with vendor quality analysts.",
    "Reviewed vendor moderation samples, handled appeals and arbitrations, and contributed to vendor evaluation reports.",
    "Maintained team tracking systems and dashboards and acted as a weekend contact for high-importance accounts."
  ],
  "job-07971db6dcd4575142c128f3": [
    "Built JavaScript automation scripts to analyse page DOM structures and simulate in-browser events for Google's content-assurance work.",
    "Developed Chrome extensions to automate content verification.",
    "Identified workflow inefficiencies and implemented process improvements.",
    "Reviewed Google search results for relevance and policy compliance."
  ],
  "job-036963ac120af57f22fcf614": [
    "Created JavaScript scripts and Chrome extensions to detect and remove hidden scripts in websites and mobile applications.",
    "Collaborated with designers, backend developers and project managers to integrate JavaScript functionality with Google APIs.",
    "Conducted code reviews and onboarded and mentored colleagues.",
    "Identified process bottlenecks and implemented workflow improvements.",
    "Reviewed pages displaying Google Ads for policy compliance and quality."
  ],
  "job-8a8a1640190a0ce47953978c": [
    "Analysed customer and product data to inform service improvements.",
    "Managed AWS infrastructure for mobile applications and implemented CI/CD pipelines.",
    "Developed REST APIs and internal tools.",
    "Automated routine tasks with shell scripts.",
    "Created system diagrams and user manuals for knowledge transfer."
  ],
  "job-b103e2ba7ee07cf79497e9d1": [
    "Resolved Microsoft product issues using SQL queries to investigate root causes.",
    "Supported Linux and Windows server operations and configuration troubleshooting.",
    "Provided remote technical support in English and French.",
    "Developed JavaScript scripts to automate repetitive support tasks.",
    "Created Microsoft Office-based support processes and mentored junior support engineers."
  ],
  "job-f690ecbeb2d0b20497aba63b": [
    "Worked on a Python-based synthetic reflectometry diagnostic for studying plasma turbulence in magnetic fusion devices."
  ],
  "job-dd51274e5e20da7c1715b4fe": [
    "Studied reflectometry on the Tore Supra tokamak using MATLAB.",
    "Carried out numerical studies of the bump-on-tail instability using Python and Fortran."
  ],
  "job-9f528b7842a0aa7ab1d817da": [
    "Studied disruptions in the COMPASS tokamak using Python for data analysis."
  ],
  "job-636bd8253182ac041a72f4c2": [
    "Assisted a professor with numerical physics and Python-related work."
  ],
  "job-2a379fbf30b14b23f81c9998": [
    "Tutored science and engineering students in mathematics, physics and Python programming."
  ],
  "job-e3dab59ed6334e53ad5302c2": [
    "Worked on automatic control and data acquisition for studies of electrical susceptibility and thermally stimulated currents in ceramics and polarisable films."
  ]
};

/**
 * Immutable, ordered descriptions reviewed from LinkedIn on 2026-10-15.
 * Only the thirteen original roles are targets; no metrics, publications or
 * conference claims are inferred. Other professional fields stay untouched.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const LINKEDIN_ROLE_DUTY_UPDATES = Object.freeze(Object.fromEntries(
  Object.entries(REVIEWED_DUTIES).map(([id, duties]) => [id, Object.freeze(duties)])
));

function finish(data, report) {
  return { data, report, candidateHash: createHash("sha256").update(JSON.stringify(data)).digest("hex") };
}

/**
 * Replaces only the reviewed duties arrays, preserving complete raw content.
 *
 * Source-order normalization maps computed legacy IDs back to exact raw rows.
 * Duties are not identity inputs, so no IDs/categories are persisted and jobs
 * are not reordered. The four newer roles, all other job fields and every other
 * collection remain exact semantic matches. Unexpected role identity sets or
 * collection counts fail closed. An applied ledger makes this a complete no-op
 * after later administrator edits or deletion, without restoring descriptions.
 *
 * @param {object} current Complete current raw portfolio after the role update.
 * @param {{alreadyApplied?: boolean}} [options={}] Separate descriptions ledger state.
 * @returns {{data: object, report: object, candidateHash: string}} Scoped candidate, duties-only diff and exact candidate SHA-256.
 */
export function planLinkedInRoleDescriptionsMigration(current, { alreadyApplied = false } = {}) {
  if (!current || typeof current !== "object" || Array.isArray(current) ||
      ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key]))) {
    throw new Error("Role descriptions require a complete portfolio snapshot.");
  }
  const data = structuredClone(current);
  const counts = { jobs: current.jobs.length, education: current.education.length, projects: current.projects.length };
  const report = { migrationId: LINKEDIN_ROLE_DESCRIPTIONS_MIGRATION_ID,
    alreadyApplied, changed: false, updates: [], counts };
  if (alreadyApplied) return finish(data, report);

  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  if (counts.jobs !== 17 || counts.education !== 7 || counts.projects !== 15 ||
      ["pages", "profile", "research"].some((key) => !isObject(data[key])) ||
      PAGE_KEYS.some((key) => !isObject(data.pages[key])) ||
      data.jobs.some((job) => !job || typeof job !== "object" || Array.isArray(job))) {
    throw new Error("Unexpected role-description source scope; review a fresh snapshot.");
  }
  const sourceRows = normalizeRichArray(data.jobs, JOB_FIELDS);
  const expectedIds = new Set([...Object.keys(LINKEDIN_ROLE_DUTY_UPDATES), ...LINKEDIN_JOB_ADDITIONS.map(({ id }) => id)]);
  if (new Set(sourceRows.map(({ id }) => id)).size !== 17 ||
      sourceRows.some(({ id }) => !expectedIds.has(id))) {
    throw new Error("Missing or ambiguous role-description target requires review.");
  }
  for (const [id, duties] of Object.entries(LINKEDIN_ROLE_DUTY_UPDATES)) {
    const index = sourceRows.findIndex((job) => job.id === id);
    if (index === -1) throw new Error(`Missing role-description target ${id}.`);
    const before = data.jobs[index].duties;
    const after = [...duties];
    if (!isDeepStrictEqual(before, after)) {
      report.updates.push({ id, title: sourceRows[index].title, before: before ?? [], after });
      data.jobs[index].duties = after;
    }
  }
  const normalized = normalizePortfolioData(data);
  const validation = validateCompletePortfolioPayload(normalized);
  if (!validation.valid) throw new Error(`Role-description candidate requires review: ${validation.errors.join(" ")}`);
  report.changed = report.updates.length > 0;
  return finish(data, report);
}

/**
 * Previews or applies duties with a separate ledger and both reviewed hashes.
 * Existing full-file/Redis backup, deployment and atomic source-CAS guards are
 * reused unchanged. Candidate verification precedes backup/application, so a
 * changed planner or description cannot silently replace the reviewed wording.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId' | 'planMigration'> & {expectedCandidateHash?: string}} options Raw Redis, source/candidate review hashes and backup/deployment settings.
 * @returns {Promise<object>} Data/report, both hashes and guarded receipt fields.
 */
export async function migrateLinkedInRoleDescriptionsRedis(options) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") {
    throw new Error("Role-description dryRun must be a boolean.");
  }
  if (options.dryRun === false && (typeof options.expectedCandidateHash !== "string" || !/^[a-f\d]{64}$/.test(options.expectedCandidateHash))) {
    throw new Error("Role-description apply requires the reviewed candidate SHA-256.");
  }
  return migratePortfolioContentRedis({
    ...options, migrationId: LINKEDIN_ROLE_DESCRIPTIONS_MIGRATION_ID,
    planMigration: (current, ledgerState) => {
      const result = planLinkedInRoleDescriptionsMigration(current, ledgerState);
      if (options.dryRun === false && !ledgerState.alreadyApplied && options.expectedCandidateHash !== result.candidateHash) {
        throw new Error("Role-description candidate differs from the reviewed preview; no Redis write occurred.");
      }
      return result;
    }
  });
}
