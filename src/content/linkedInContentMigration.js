import {
  JOB_FIELDS, normalizePortfolioData, normalizeRichArray,
  normalizeRichItem, validateCompletePortfolioPayload
} from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const LINKEDIN_CONTENT_MIGRATION_ID = "linkedin-content-2026-10-15-v1";

/**
 * Reviewed month-precision LinkedIn roles. First-of-month ISO dates are storage
 * conventions, not verified employment days. Explicit categories and IDs avoid
 * placement/name coupling. No media, coordinates, travel breaks or awards are
 * inferred. These additions are tooling only, never inserted by GET or PUT.
 */
export const LINKEDIN_JOB_ADDITIONS = Object.freeze([
  {
    id: "job-linkedin-boscasports-2025-09", category: "industry",
    title: "Software Engineer", company: "BoscaSports",
    location: "Dublin, Ireland (remote)", start: "2025-09-01", end: "Present",
    duties: [
      "Integrated external racing data providers with BoscaSports Podium for Racecourse Media Group.",
      "Built live data pipelines for race status, odds, pool totals, non-runners and results.",
      "Developed a Sorec JSON/XML push receiver and automated forwarding to Podium APIs.",
      "Integrated RaceIQ pre-race data into runner-specific prompts.",
      "Improved production reliability through Jest tests, AWS EC2 support, PM2, cron automation, nginx routing and logging."
    ],
    skills: ["Node.js", "AWS", "API Development", "System Integration", "Automation", "Software Testing"]
  },
  {
    id: "job-linkedin-invertase-2024-10", category: "industry",
    title: "Software Engineer", company: "Invertase (Client: Google)",
    location: "Manchester, UK (remote)", start: "2024-10-01", end: "2025-01-01",
    duties: [
      "Maintained Firebase Genkit and Extensions in the Google cloud team, addressing missing features, updates and stability.",
      "Developed Jest tests and mocks to validate fixes and features.",
      "Reproduced and resolved reported issues through debugging and Firebase project simulations."
    ],
    skills: ["Node.js", "TypeScript", "Software Testing", "Cloud Computing"]
  },
  {
    id: "job-linkedin-xerotech-2024-01", category: "industry",
    title: "Full-Stack Developer - Industrial Automation", company: "Xerotech",
    location: "Galway, Ireland (remote)", start: "2024-01-01", end: "2025-01-01",
    duties: [
      "Developed a React dashboard with an Express.js backend for real-time battery monitoring and automation.",
      "Integrated AWS storage for remote access and optimised MongoDB for time-series data.",
      "Deployed and managed containerised applications using Docker.",
      "Automated CI/CD workflows with Jenkins and tested backend APIs using Jest and Supertest."
    ],
    skills: ["Node.js", "React", "Express.js", "AWS", "MongoDB", "Docker", "CI/CD", "Software Testing"]
  },
  {
    id: "job-linkedin-covalen-2019-09", category: "industry",
    title: "Community Operations Analyst", company: "Covalen (Client: Meta)",
    location: "Dublin, Ireland", start: "2019-09-01", end: "2020-04-01",
    duties: ["Worked on trust and safety operations for Meta."], skills: []
  }
]);

/** Reviewed corrections matched by pre-edit stable ID, never by the new title. */
export const LINKEDIN_JOB_CORRECTIONS = Object.freeze([
  { id: "job-598ecb6377d96d3e95c9adbf", fields: { title: "React Developer" } },
  { id: "job-44a10c8d45ae3eaaa582ac9c", fields: { title: "Software Engineering Research Collaborator" } },
  { id: "job-2fd5cc4b22e6e527a835b835", fields: { title: "Sampling Quality Analyst" } },
  { id: "job-07971db6dcd4575142c128f3", fields: { title: "JavaScript Automation Engineer & Content Assurance Specialist" } },
  { id: "job-036963ac120af57f22fcf614", fields: { title: "Senior JavaScript Automation Engineer & Content Assurance Specialist", start: "2017-06-01" } },
  { id: "job-f690ecbeb2d0b20497aba63b", fields: { title: "Computational Physics Intern (Synthetic Diagnostic in Fusion Plasmas)" } },
  { id: "job-dd51274e5e20da7c1715b4fe", fields: { title: "Fusion Energy Research Intern" } },
  { id: "job-9f528b7842a0aa7ab1d817da", fields: { title: "Research Intern, Tokamak Diagnostics" } },
  { id: "job-2a379fbf30b14b23f81c9998", fields: { title: "Tutor - Mathematics, Physics and Python Programming" } },
  { id: "job-e3dab59ed6334e53ad5302c2", fields: { title: "Instrumentation Intern" } }
]);

/** Only the reviewed introductions change; page titles and image URLs survive. */
export const LINKEDIN_PAGE_DESCRIPTIONS = Object.freeze({
  experience: "I work as a Software Engineer at BoscaSports, integrating live racing data and supporting production services. My earlier software roles include Firebase Genkit and Extensions work at Invertase for Google, industrial automation at Xerotech, and React development at Datto. My background also includes data analysis and quality assurance at TikTok, trust and safety operations at Covalen, and JavaScript automation at Accenture and Arvato for Google.",
  education: "I am currently studying for an MSc in Statistics and Data Science at Trinity College Dublin (2024-2027). My earlier education includes software design with cloud native computing at the Technological University of the Shannon and computing at Atlantic Technological University. My background also includes physics at Universidade do Porto and nuclear fusion studies at the University of Stuttgart and Universite de Lorraine."
});

function counts(data) {
  return Object.fromEntries(["jobs", "education", "projects"].map((key) => [key, data[key].length]));
}

function changeFields(record, fields) {
  return Object.fromEntries(Object.entries(fields)
    .filter(([key, value]) => record[key] !== value)
    .map(([key, value]) => [key, { from: record[key] ?? "", to: value }]));
}

function requireObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Plans only the reviewed LinkedIn factual update on a complete raw snapshot.
 *
 * Existing jobs are matched uniquely by their pre-edit normalized IDs. Their
 * IDs AND categories are pinned before renaming, preserving research placement
 * even when a new title omits "Research". Only listed fields are changed; old
 * skills, papers, thesis, media tuples and unrelated raw fields survive intact.
 * New roles have empty aligned media arrays. Overlapping employment dates stay
 * as documented, and Present sorts first. TCD's mark is explicitly provisional.
 * The pre-migration inventory must be exactly 13 jobs, 7 education entries and
 * 15 projects; a materially different source is not silently patched.
 * An applied ledger makes this planner a complete no-op, including after edits
 * or deletion. Ambiguous or missing source identities require a new review.
 *
 * @param {object} current Complete original raw portfolio object.
 * @param {{alreadyApplied?: boolean}} [options={}] Separate LinkedIn ledger state.
 * @returns {{data: object, report: object}} Fresh scoped candidate and safe field diff.
 */
export function planLinkedInContentMigration(current, { alreadyApplied = false } = {}) {
  if (!requireObject(current) || !requireObject(current.pages) ||
      ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key]))) {
    throw new Error("LinkedIn migration requires a complete portfolio snapshot.");
  }
  const data = structuredClone(current);
  const report = {
    migrationId: LINKEDIN_CONTENT_MIGRATION_ID, alreadyApplied,
    changed: false, added: [], updates: [], counts: { before: counts(current), after: counts(current) }
  };
  if (alreadyApplied) return { data, report };

  if (data.jobs.length !== 13 || data.education.length !== 7 || data.projects.length !== 15 ||
      !requireObject(data.profile) ||
      ["experience", "education"].some((page) => !requireObject(data.pages[page])) ||
      ["jobs", "education", "projects"].some((section) => data[section].some((row) => !requireObject(row))) ||
      data.jobs.some((job) => Object.hasOwn(job, "duration"))) {
    throw new Error("LinkedIn source contract requires review before changing content.");
  }
  // Normalize in source order to map computed legacy IDs back to exact raw rows.
  const jobsBefore = normalizeRichArray(data.jobs, JOB_FIELDS);
  for (const { id, fields } of LINKEDIN_JOB_CORRECTIONS) {
    const matches = jobsBefore.map((job, index) => ({ job, index })).filter(({ job }) => job.id === id);
    if (matches.length !== 1) throw new Error(`Missing or ambiguous LinkedIn correction target ${id}.`);
    const { job, index } = matches[0];
    const raw = data.jobs[index];
    const changes = changeFields(raw, fields);
    report.updates.push({ collection: "jobs", id, fields: changes,
      pinnedId: raw.id !== id, pinnedCategory: raw.category !== job.category });
    Object.assign(raw, fields, { id, category: job.category });
  }

  for (const seed of LINKEDIN_JOB_ADDITIONS) {
    const employer = seed.company.split(" (Client:")[0].toLowerCase();
    if (data.jobs.some((job) => job.id === seed.id ||
        (typeof job.company === "string" && job.company.split(" (Client:")[0].toLowerCase() === employer))) {
      throw new Error(`Existing LinkedIn role for ${employer} requires review instead of duplication.`);
    }
    const added = normalizeRichItem(seed, JOB_FIELDS);
    data.jobs.push(added);
    report.added.push(structuredClone(added));
  }

  const educationMatches = data.education.filter((entry) =>
    entry?.institution === "Trinity College, Dublin" &&
    entry.start === "2024-09-01" && entry.end === "2027-10-01");
  if (educationMatches.length !== 1) throw new Error("Missing or ambiguous TCD education record requires review.");
  const education = educationMatches[0];
  const educationFields = {
    institution: "Trinity College Dublin", degree: "MSc in Statistics and Data Science",
    grade: "80% (current mark as of June 2026; not a final degree result)", status: "in-progress"
  };
  report.updates.push({ collection: "education", match: {
    institution: education.institution, start: education.start, end: education.end
  }, fields: changeFields(education, educationFields) });
  Object.assign(education, educationFields);

  report.updates.push({ collection: "profile", fields: changeFields(data.profile, { location: "Galway, Ireland" }) });
  data.profile.location = "Galway, Ireland";
  for (const [page, description] of Object.entries(LINKEDIN_PAGE_DESCRIPTIONS)) {
    report.updates.push({ collection: "pages", page, fields: changeFields(data.pages[page], { description }) });
    data.pages[page].description = description;
  }

  // Apply normal endpoint ordering without replacing untouched raw record fields.
  const identityRows = normalizeRichArray(data.jobs, JOB_FIELDS);
  const rawById = new Map(identityRows.map((job, index) => [job.id, data.jobs[index]]));
  data.jobs = normalizeRichArray(data.jobs, JOB_FIELDS, ["end", "start"]).map((job) => rawById.get(job.id));
  const validation = validateCompletePortfolioPayload(normalizePortfolioData(data));
  if (!validation.valid) throw new Error(`LinkedIn candidate requires review: ${validation.errors.join(" ")}`);
  report.changed = JSON.stringify(data) !== JSON.stringify(current);
  report.counts.after = counts(data);
  return { data, report };
}

/**
 * Previews or explicitly applies the separate reviewed LinkedIn migration.
 * Uses the shared complete-backup/hash/CAS guard, never the research ledger.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId' | 'planMigration'>} options Raw Redis, review hash, backup and deployment settings.
 * @returns {Promise<object>} Candidate/report and verified migration receipt fields.
 */
export async function migrateLinkedInContentRedis(options) {
  return migratePortfolioContentRedis({
    ...options, migrationId: LINKEDIN_CONTENT_MIGRATION_ID,
    planMigration: planLinkedInContentMigration
  });
}
