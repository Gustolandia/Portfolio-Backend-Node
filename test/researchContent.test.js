import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { SKILL_ALIASES, normalizeSkills, normalizeResearchLabels } from "../src/content/skillAliases.js";
import { RESEARCH_PROJECTS, researchIdentity } from "../src/content/researchProjects.js";
import { planResearchContentMigration } from "../src/content/researchContentMigration.js";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";
import { DEFAULT_PORTFOLIO_DATA_PATH } from "../src/storage/jsonPortfolioStore.js";

function source() {
  return {
    pages: Object.fromEntries(["home", "experience", "education", "projects", "contact"].map((key) => [key, { title: key, description: "Keep narrative", imageUrl: "/a.jpg" }])),
    jobs: [{ id: "role-stable", title: "Research role", company: "Example lab", category: "research", skills: ["React.js", "React", "Java", "JavaScript", "NodeJS"], duties: ["Keep duties"], imageUrls: ["/a.jpg"], imageDescriptions: ["A"], imageBackupDescriptions: ["Alt A"] }],
    education: [{ degree: "Explicit degree", status: "not-completed", skills: ["Advanced Data Analysis", "Statistics"], courses: ["Keep course names"], grade: "" }],
    projects: [{ id: "report-stable", name: "Report on Reflectometry", category: "research", outputType: "report", status: "completed", collaborators: ["Example colleague"], authors: [], affiliations: ["Explicit affiliation"], description: "Keep older report", skills: ["Fourier Transform", "Signal Processing"], links: ["/older-report.pdf"], linksDescriptions: ["Older report"], linksBackupDescriptions: ["Older report fallback"], relatedRoleIds: ["role-stable"] }],
    profile: { name: "Edited researcher", email: "", researchInterests: ["Statistics", "Scientific computing"], cvUrl: "", portraitUrl: "" },
    research: { thesisTitle: "User-edited thesis", thesisSummary: "Prediction is an aim.", thesisStatus: "in-progress", thesisMethods: ["Hard parameter sharing", "Matched single-task baselines", "Gradient interference"] },
    unrelated: { keep: true }
  };
}

test("skills consolidate reviewed subtopics while preserving languages, disciplines and arbitrary labels", () => {
  assert.deepEqual(normalizeSkills([
    "React.js", "React Hooks", "React", "Vue Router", "NodeJS", "Java", "JavaScript",
    "Physics", "Machine Learning", "Statistics", "French", "Custom Valid Skill",
    "Advanced Data Analysis", "Exploratory Data Analysis", "Fourier Transform", "Fast Fourier Transform (FFT)"
  ]), ["React", "Vue.js", "Node.js", "Java", "JavaScript", "Physics", "Machine Learning", "Statistics", "French", "Custom Valid Skill", "Data Analysis", "Signal Processing"]);
});

test("all reviewed aliases converge in one pass and maintain stable deduplication", () => {
  const labels = Object.keys(SKILL_ALIASES);
  const normalized = normalizeSkills(labels);
  assert.deepEqual(normalizeSkills(normalized), normalized);
  assert.deepEqual(normalizeSkills(["React.js (Hooks, Redux)", "React Router"]), ["React"]);
  assert.deepEqual(normalizeSkills(["G", "G Programming Language (LabVIEW)", "NI LabVIEW"]), ["LabVIEW"]);
  assert.deepEqual(normalizeSkills([" Unknown new skill ", "Unknown new skill", "Another skill"]), ["Unknown new skill", "Another skill"]);
});

test("generic shell skills do not imply Bash and application review features do not imply moderation", () => {
  assert.deepEqual(normalizeSkills(["Shell Scripting", "Shell Scripting (Bash)"]), ["Shell Scripting", "Bash"]);
  assert.deepEqual(normalizeSkills(["Review Management", "Content Review"]), ["Web Development", "Content Review"]);
});

test("thesis labels use synonyms only and retain meaningful distinctions", () => {
  const methods = ["Hard parameter sharing", "Matched single-task baselines", "Gradient interference", "Advanced Data Analysis"];
  assert.deepEqual(normalizeResearchLabels(methods), methods);
  assert.deepEqual(normalizeResearchLabels(["Multitask learning", "Multi-task learning", "Statistics", "Scientific computing"]), ["Multi-task learning", "Statistics", "Scientific computing"]);
});

test("content migration adds exactly four preprints and one manuscript with ordered credit and aligned links", () => {
  const current = source();
  const copy = structuredClone(current);
  const { data, report } = planResearchContentMigration(current);
  assert.deepEqual(current, copy);
  assert.equal(report.added.length, 5);
  assert.equal(data.projects.filter((p) => p.status === "preprint").length, 4);
  assert.equal(data.projects.filter((p) => p.outputType === "manuscript" && p.status === "in-preparation").length, 1);
  const newItems = data.projects.filter((p) => RESEARCH_PROJECTS.some((seed) => seed.id === p.id));
  for (const project of newItems) {
    assert.equal(project.category, "research");
    assert.deepEqual(project.imageUrls, []);
    assert.deepEqual(project.collaborators, []);
    assert.deepEqual(project.affiliations, []);
    assert.equal(project.contribution, "");
    for (const field of ["linksTitles", "linksDescriptions", "linksBackupDescriptions"]) assert.equal(project[field].length, project.links.length);
  }
  assert.deepEqual(data.projects.find((p) => p.id === "research-arxiv-2608-11228").authors, ["Gustavo Pedro Ricou", "Nicholas Mahony"]);
  assert.deepEqual(data.projects.find((p) => p.id === "research-arxiv-2608-27736").authors, ["Gustavo Pedro Ricou", "Kristin C. Epstein"]);
  assert.equal(data.projects.find((p) => p.id === "research-arxiv-2608-11228").dateOfCompletion, "2026-08-22");
  assert.ok(!data.projects.find((p) => p.id === "research-arxiv-2608-11228").skills.includes("Experimental Design"));
  assert.equal(data.projects.find((p) => p.id === "research-zenodo-22044877").dateOfCompletion, "");
  assert.equal(validateCompletePortfolioPayload(normalizePortfolioData(data)).valid, true);
});

test("existing content, thesis, IDs and media tuples are unchanged apart from skills", () => {
  const current = source();
  const { data } = planResearchContentMigration(current);
  assert.deepEqual(data.profile, current.profile);
  assert.deepEqual(data.research, current.research);
  assert.deepEqual(data.pages, current.pages);
  assert.deepEqual(data.unrelated, current.unrelated);
  for (const key of ["jobs", "education", "projects"]) {
    const existing = key === "projects" ? data.projects.filter((p) => p.id === "report-stable") : data[key];
    existing.forEach((record, index) => {
      const { skills, ...other } = record;
      const { skills: oldSkills, ...oldOther } = current[key][index];
      assert.deepEqual(other, oldOther);
      assert.deepEqual(skills, normalizeSkills(oldSkills));
    });
  }
});

test("version URLs and verified earlier titles identify the same football paper", () => {
  for (const link of ["https://arxiv.org/abs/2608.11228v1", "https://arxiv.org/pdf/2608.11228v2.pdf", "https://arxiv.org/html/2608.11228v3", "https://doi.org/10.48550/arXiv.2608.11228"]) {
    assert.equal(researchIdentity({ name: "Edited title", links: [link] }), "research-arxiv-2608-11228");
    const current = source();
    current.projects.push({ id: "user-paper-id", name: "Edited title", authors: ["Explicit Author"], links: [link], skills: ["Unknown Method"] });
    const { data, report } = planResearchContentMigration(current);
    assert.equal(report.added.length, 4);
    assert.deepEqual(data.projects.find((p) => p.id === "user-paper-id"), current.projects[1]);
  }
  assert.equal(researchIdentity({ name: "What public football injury reports can and cannot show about short-term match exposure: an English Premier League analysis" }), "research-arxiv-2608-11228");
});

test("repeats preserve edited or deleted seeded papers once the ledger marks application", () => {
  const first = planResearchContentMigration(source()).data;
  const repeat = planResearchContentMigration(first, { alreadyApplied: true });
  assert.equal(repeat.report.added.length, 0);
  assert.deepEqual(repeat.data, first);
  const deleted = structuredClone(first);
  deleted.projects = deleted.projects.filter((p) => p.id !== "research-arxiv-2608-11228");
  const edited = deleted.projects.find((p) => p.id === "research-arxiv-2609-05584");
  edited.name = "User-edited title";
  edited.description = "User-edited description";
  const later = planResearchContentMigration(deleted, { alreadyApplied: true });
  assert.deepEqual(later.data, deleted);
  assert.equal(later.report.added.length, 0);
});

test("multiple existing versions cause a review error rather than destructive deduplication", () => {
  const current = source();
  current.projects.push({ links: ["https://arxiv.org/abs/2608.11228v1"] }, { links: ["https://arxiv.org/abs/2608.11228v2"] });
  assert.throws(() => planResearchContentMigration(current), /Multiple existing versions/);
});

test("authors round-trip independently from collaborators and reject malformed writes", () => {
  const current = source();
  current.projects[0].authors = ["First Author", "Second Author"];
  const normalized = normalizePortfolioData(current);
  assert.deepEqual(normalized.projects[0].authors, ["First Author", "Second Author"]);
  assert.deepEqual(normalized.projects[0].collaborators, ["Example colleague"]);
  assert.equal(validateCompletePortfolioPayload(normalized).valid, true);
  for (const authors of ["First Author", [1], null]) {
    normalized.projects[0].authors = authors;
    assert.equal(validateCompletePortfolioPayload(normalized).valid, false);
  }
});

test("API normalization never re-adds papers omitted by an admin", () => {
  const data = normalizePortfolioData(source());
  assert.equal(data.projects.length, 1);
  assert.deepEqual(normalizePortfolioData({ ...data, projects: [] }).projects, []);
});

test("local content seed contains one record per research identity and preserves older reports", async () => {
  const data = JSON.parse(await readFile(DEFAULT_PORTFOLIO_DATA_PATH, "utf8"));
  const identities = data.projects.map(researchIdentity).filter(Boolean);
  assert.equal(identities.length, 5);
  assert.equal(new Set(identities).size, 5);
  assert.ok(data.projects.some((p) => p.name === "Report on Reflectometry"));
  assert.ok(data.projects.some((p) => p.name === "Disruption Studies on the COMPASS Tokamak"));
});
