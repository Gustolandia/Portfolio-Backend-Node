import { normalizeProfile, normalizeResearch } from "../validation/academicMetadata.js";
import { normalizePortfolioData, normalizeRichItem, PROJECT_FIELDS, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { normalizeResearchLabels, normalizeSkills } from "./skillAliases.js";
import { RESEARCH_PROJECTS, researchIdentity } from "./researchProjects.js";

export const RESEARCH_CONTENT_MIGRATION_ID = "research-content-2026-10-15-v1";

/**
 * Counts actual skill occurrences and distinct labels without changing content.
 *
 * @param {object} data Portfolio snapshot.
 * @returns {{sections: object, occurrences: number, unique: number}} Inventory.
 */
export function skillInventory(data) {
  const all = [];
  const sections = {};
  for (const section of ["jobs", "education", "projects"]) {
    const records = Array.isArray(data[section]) ? data[section] : [];
    const labels = records.flatMap((record) => Array.isArray(record?.skills)
      ? record.skills.filter((label) => typeof label === "string") : []);
    all.push(...labels);
    sections[section] = { records: records.length, occurrences: labels.length, unique: new Set(labels).size };
  }
  return { sections, occurrences: all.length, unique: new Set(all).size };
}

function sortProjects(projects) {
  return projects.map((project, index) => ({ project, index, date: Date.parse(project.dateOfCompletion) }))
    .sort((left, right) => {
      const a = Number.isNaN(left.date) ? -Infinity : left.date;
      const b = Number.isNaN(right.date) ? -Infinity : right.date;
      return a === b ? left.index - right.index : b - a;
    }).map(({ project }) => project);
}

/**
 * Plans an additive content migration, retaining all existing record fields.
 *
 * Existing known papers are identified by source identity and never overwritten.
 * A persisted migration ledger flag suppresses later re-addition after deletion.
 * This plan is explicit tooling only; API reads/saves never insert these papers.
 * Approved profile/research defaults bootstrap only absent legacy objects.
 *
 * @param {object} current Complete original portfolio snapshot.
 * @param {{alreadyApplied?: boolean}} options Persisted migration ledger state.
 * @returns {{data: object, report: object}} Fresh proposed payload and safe summary.
 */
export function planResearchContentMigration(current, { alreadyApplied = false } = {}) {
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    throw new Error("Content migration requires a complete portfolio snapshot.");
  }
  const data = structuredClone(current);
  const before = skillInventory(current);
  const changes = new Map();
  const bootstrapped = [];
  for (const section of ["jobs", "education", "projects"]) {
    if (!Array.isArray(data[section])) throw new Error(`Content migration requires ${section}.`);
    for (const record of data[section]) {
      if (!record || typeof record !== "object" || !Array.isArray(record.skills)) continue;
      for (const label of record.skills) {
        if (typeof label !== "string") continue;
        const canonical = normalizeSkills([label]);
        if (canonical.length !== 1 || canonical[0] !== label) {
          const change = changes.get(label) || { from: label, to: canonical, occurrences: 0 };
          change.occurrences += 1;
          changes.set(label, change);
        }
      }
      record.skills = normalizeSkills(record.skills);
    }
  }
  const afterExisting = skillInventory(data);

  if (!Object.hasOwn(data, "profile")) {
    data.profile = normalizeProfile(undefined);
    bootstrapped.push("profile");
  } else if (data.profile && Array.isArray(data.profile.researchInterests)) {
    data.profile.researchInterests = normalizeResearchLabels(data.profile.researchInterests);
  }
  if (!Object.hasOwn(data, "research")) {
    data.research = normalizeResearch(undefined);
    bootstrapped.push("research");
  } else if (data.research && Array.isArray(data.research.thesisMethods)) {
    data.research.thesisMethods = normalizeResearchLabels(data.research.thesisMethods);
  }

  const existing = new Map();
  for (const project of data.projects) {
    if (!project || typeof project !== "object") continue;
    const identity = researchIdentity(project);
    if (!identity) continue;
    if (existing.has(identity)) {
      throw new Error(`Multiple existing versions of ${identity} require review before migration.`);
    }
    existing.set(identity, project);
  }
  const added = [];
  const preserved = [];
  for (const seed of RESEARCH_PROJECTS) {
    if (existing.has(seed.id)) {
      preserved.push(seed.id);
    } else if (!alreadyApplied) {
      data.projects.push(normalizeRichItem(seed, PROJECT_FIELDS));
      added.push({ id: seed.id, name: seed.name, authors: [...seed.authors], outputType: seed.outputType, status: seed.status, dateOfCompletion: seed.dateOfCompletion });
    }
  }
  if (added.length) data.projects = sortProjects(data.projects);
  const validation = validateCompletePortfolioPayload(normalizePortfolioData(data));
  if (!validation.valid) throw new Error(`Proposed content requires review: ${validation.errors.join(" ")}`);

  return {
    data,
    report: {
      migrationId: RESEARCH_CONTENT_MIGRATION_ID, alreadyApplied,
      changed: JSON.stringify(data) !== JSON.stringify(current),
      bootstrapped, added, preservedExistingPapers: preserved,
      skills: { before, afterExisting, afterWithAdditions: skillInventory(data), mappings: [...changes.values()].sort((a, b) => a.from.localeCompare(b.from)) }
    }
  };
}
