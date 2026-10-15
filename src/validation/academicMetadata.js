import { createHash } from "node:crypto";
import { normalizePublicUrl } from "./publicUrl.js";
import { normalizeResearchLabels } from "../content/skillAliases.js";

export const PROFILE_FIELDS = Object.freeze([
  "name", "headline", "summary", "location", "email", "cvUrl", "portraitUrl", "researchInterests"
]);
export const RESEARCH_FIELDS = Object.freeze([
  "title", "summary", "thesisTitle", "thesisSummary", "thesisStatus",
  "thesisInstitution", "thesisSupervisor", "thesisStart", "thesisEnd", "thesisQuestions", "thesisMethods"
]);
export const JOB_CATEGORIES = Object.freeze(["research", "industry", "teaching"]);
export const PROJECT_CATEGORIES = Object.freeze([
  "research", "software", "data", "coursework", "other"
]);
export const PROJECT_OUTPUT_TYPES = Object.freeze([
  "", "report", "preprint", "manuscript", "article", "dataset", "software", "other"
]);
export const PROJECT_STATUSES = Object.freeze([
  "", "in-progress", "in-preparation", "preprint", "published", "completed"
]);
export const THESIS_STATUSES = Object.freeze([
  "", "in-progress", "in-preparation", "completed"
]);
export const EDUCATION_STATUSES = Object.freeze([
  "", "in-progress", "completed", "not-completed"
]);

export const DEFAULT_PROFILE = Object.freeze({
  name: "Gustavo Pedro Ricou",
  headline: "Machine learning, statistics & scientific computing",
  summary: "My background combines physics, statistics and software engineering. My current thesis investigates when sharing a neural-network representation helps or hurts tasks trained together.",
  location: "",
  email: "",
  cvUrl: "",
  portraitUrl: "",
  researchInterests: Object.freeze([
    "Multi-task learning", "Transfer and gradient interference", "Statistics", "Scientific computing"
  ])
});

export const DEFAULT_RESEARCH = Object.freeze({
  title: "Research",
  summary: "Questions at the intersection of learning, statistics and scientific computing.",
  thesisTitle: "Gradient interference and transfer in multi-task learning",
  thesisSummary: "I study two tasks trained simultaneously on the same inputs, using a shared trunk and a separate output head for each task. Each task is compared with a matched single-task network. The aim is to understand when sharing helps or hurts and whether transfer can be predicted before training.",
  thesisStatus: "in-progress",
  thesisInstitution: "",
  thesisSupervisor: "",
  thesisStart: "",
  thesisEnd: "",
  thesisQuestions: Object.freeze([
    "When does sharing a trunk help or hurt each task?", "Can transfer be predicted before training?"
  ]),
  thesisMethods: Object.freeze([
    "Hard parameter sharing", "Matched single-task baselines", "Gradient interference"
  ])
});

const LEGACY_RESEARCH_PROJECTS = new Set([
  "Report on Reflectometry",
  "Disruption Studies on the COMPASS Tokamak",
  "Automatic Data Control and Acquisition for the Study of Electrical Susceptibility and Thermally Stimulated Currents in Ceramics and Polarizable Films"
]);
const METADATA_ARRAY_FIELDS = new Set([
  "researchInterests", "thesisQuestions", "thesisMethods"
]);

/**
 * @typedef {object} Profile
 * @property {string} name Public display name.
 * @property {string} headline Public academic headline.
 * @property {string} summary Background and current interests.
 * @property {string} location Explicit public location, or empty.
 * @property {string} email Explicit public contact address, or empty.
 * @property {string} cvUrl HTTP(S) or relative CV asset URL, or empty.
 * @property {string} portraitUrl Explicit HTTP(S) or relative portrait asset URL, or empty.
 * @property {string[]} researchInterests Ordered research interests.
 */

/**
 * @typedef {object} Research
 * @property {string} title Research section heading.
 * @property {string} summary Research overview.
 * @property {string} thesisTitle Working thesis title.
 * @property {string} thesisSummary Early-stage aims without claims of results.
 * @property {'' | 'in-progress' | 'in-preparation' | 'completed'} thesisStatus Explicit thesis status, or unspecified.
 * @property {string} thesisInstitution Explicit institution, or empty.
 * @property {string} thesisSupervisor Explicit public supervisor name, or empty.
 * @property {string} thesisStart Official thesis start date, or empty.
 * @property {string} thesisEnd Explicit end/submission deadline, not proof of completion, or empty.
 * @property {string[]} thesisQuestions Ordered research questions.
 * @property {string[]} thesisMethods Ordered methods under study.
 */

function normalizeMetadata(value, fields) {
  const source = value !== null && typeof value === "object" && !Array.isArray(value)
    ? value : {};

  return Object.fromEntries(fields.map((field) => [
    field,
    METADATA_ARRAY_FIELDS.has(field)
      ? (Array.isArray(source[field]) ? source[field].filter((item) => typeof item === "string") : [])
      : (typeof source[field] === "string" ? source[field] : "")
  ]));
}

/**
 * Normalizes an explicitly supplied profile. Defaults apply only when absent.
 * Public email is content, never a fallback from login credentials or env vars.
 *
 * @param {unknown} value Candidate profile; undefined means a legacy omission,
 * while an explicitly supplied null normalizes to empty fields.
 * @returns {Profile} Allowed profile fields with fresh arrays and safe links.
 */
export function normalizeProfile(value) {
  const profile = normalizeMetadata(value === undefined ? DEFAULT_PROFILE : value, PROFILE_FIELDS);
  profile.cvUrl = normalizePublicUrl(profile.cvUrl);
  profile.portraitUrl = normalizePublicUrl(profile.portraitUrl);
  profile.researchInterests = normalizeResearchLabels(profile.researchInterests);
  profile.email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email)
    ? profile.email : "";

  return profile;
}

/**
 * Normalizes an explicitly supplied research overview, preserving empties.
 *
 * @param {unknown} value Candidate research object; undefined uses legacy defaults,
 * while null normalizes to empty fields and unsupported thesis status becomes empty.
 * @returns {Research} Allowed research fields, with fresh metadata arrays.
 */
export function normalizeResearch(value) {
  const research = normalizeMetadata(value === undefined ? DEFAULT_RESEARCH : value, RESEARCH_FIELDS);
  research.thesisStatus = supportedValue(research.thesisStatus, THESIS_STATUSES, "");
  research.thesisMethods = normalizeResearchLabels(research.thesisMethods);

  return research;
}

function supportedValue(value, values, fallback) {
  return values.includes(value) ? value : fallback;
}

/**
 * Adds stable IDs, persisted placement and academic output metadata.
 *
 * Legacy IDs hash the initial title/company/dates (jobs) or name/date (projects).
 * Clients must retain the returned ID on rename/save; no random IDs or writes
 * occur during a read. Only the approved legacy names/titles infer categories.
 * Optional output type/status remain empty unless explicitly set or omitted
 * from an approved legacy report; explicit empty strings override that migration.
 *
 * @param {Record<string, unknown>} source Original rich item.
 * @param {Record<string, string | string[]>} item Normalized item to enrich.
 * @returns {Record<string, string | string[]>} Enriched item, modified in place.
 */
export function normalizeAcademicItem(source, item) {
  if (Object.hasOwn(item, "id")) {
    const isJob = Object.hasOwn(item, "company");
    const identity = isJob
      ? [item.title, item.company, item.start, item.end]
      : [item.name, item.dateOfCompletion];
    const digest = createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24);
    item.id = item.id.trim() || `${isJob ? "job" : "project"}-${digest}`;

    if (isJob) {
      const legacyCategory = /\bresearch\b/i.test(item.title) ? "research"
        : /\b(tutor|teaching)\b/i.test(item.title) ? "teaching" : "industry";
      item.category = supportedValue(source.category, JOB_CATEGORIES,
        Object.hasOwn(source, "category") ? "industry" : legacyCategory);
    } else {
      const knownReport = LEGACY_RESEARCH_PROJECTS.has(item.name);
      item.category = supportedValue(source.category, PROJECT_CATEGORIES,
        !Object.hasOwn(source, "category") && knownReport ? "research" : "other");
      item.outputType = supportedValue(source.outputType, PROJECT_OUTPUT_TYPES,
        !Object.hasOwn(source, "outputType") && knownReport ? "report" : "");
      item.status = supportedValue(source.status, PROJECT_STATUSES,
        !Object.hasOwn(source, "status") && knownReport ? "completed" : "");
      item.relatedRoleIds = [...new Set(item.relatedRoleIds.filter((id) => id.trim()))];
    }
  } else if (Object.hasOwn(item, "status")) {
    item.status = supportedValue(source.status, EDUCATION_STATUSES, "");
  }

  return item;
}
