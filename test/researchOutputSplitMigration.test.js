import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { migrateResearchOutputSplitRedis, planResearchOutputSplit, RESEARCH_OUTPUT_SPLIT_MIGRATION_ID } from "../src/content/researchOutputSplitMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const ID_A = "research-arxiv-2608-11228";
const ID_B = "research-arxiv-2609-05584";
const ID_C = "research-football-paper-c";

function historicalProject({ id, name, author, images }) {
  const imageUrls = Array.from({ length: images }, (_, index) => `https://example.test/${id}-${index}.png`);
  return {
    id, category: "research", collections: ["Data Analysis & Statistics", "Research Methods"],
    featuredOrder: id === ID_A ? 2 : 3, outputType: "preprint", status: "preprint",
    contribution: `Original contribution for ${id}.`, authors: [author], name,
    dateOfCompletion: "2026-09-01", description: `Original description for ${id}.`,
    imageUrls, imageTitles: imageUrls.map(() => "Original image"),
    imageDescriptions: imageUrls.map(() => "Original image"),
    imageBackupDescriptions: imageUrls.map(() => "Original backup"),
    affiliations: [], collaborators: [], skills: ["Statistics", "Data Analysis"],
    links: [`https://arxiv.org/abs/${id === ID_A ? "2608.11228" : "2609.05584"}`],
    linksTitles: ["arXiv preprint"], linksDescriptions: ["arXiv preprint"],
    linksBackupDescriptions: ["Open original preprint"], relatedRoleIds: [],
  };
}

function values({ name, author, description, imageCount, links }) {
  const linkTitles = links.map(([, title]) => title);
  return {
    name, dateOfCompletion: "", outputType: "manuscript", status: "in-preparation",
    contribution: `Current contribution for ${name}.`, authors: [author], description,
    skills: ["Statistics", "Data Analysis"], links: links.map(([url]) => url),
    linksTitles: linkTitles, linksDescriptions: linkTitles,
    linksBackupDescriptions: links.map(([, , backup]) => backup),
    imageTitles: Array.from({ length: imageCount }, () => "Earlier preprint figure; current manuscript in preparation."),
    imageDescriptions: Array.from({ length: imageCount }, () => "Earlier preprint figure; current manuscript in preparation."),
    imageBackupDescriptions: Array.from({ length: imageCount }, () => "Earlier preprint figure retained for context."),
  };
}

function fixture() {
  const b = historicalProject({ id: ID_B, name: "Old allocation manuscript", author: "Gustavo Pedro Ricou", images: 1 });
  const a = historicalProject({ id: ID_A, name: "Old denominator manuscript", author: "Gustavo Pedro Ricou", images: 2 });
  const untouched = {
    id: "research-unchanged", category: "research", outputType: "report", status: "completed",
    name: "Untouched research report", description: "Original report description.", contribution: "Original report credit.",
    dateOfCompletion: "2015", authors: [], skills: ["Signal Processing"], imageUrls: [], imageTitles: [],
    imageDescriptions: [], imageBackupDescriptions: [], links: [], linksTitles: [], linksDescriptions: [],
    linksBackupDescriptions: [], affiliations: [], collaborators: [], relatedRoleIds: [],
  };
  const current = normalizePortfolioData({
    pages: { home: { title: "Home", description: "Original", imageUrl: "" } },
    profile: { name: "PRIVATE_PROFILE", location: "" },
    research: { thesisSummary: "Original thesis context" },
    jobs: [{ id: "job", title: "Original role", category: "professional", duties: ["Original duty"], skills: ["Node.js"] }],
    education: [{ id: "education", degree: "Original degree", institution: "Original institution", skills: ["Physics"] }],
    projects: [b, a, untouched],
  });
  current.privateMetadata = "PRIVATE_RAW_SENTINEL";
  const replacement = (row, next) => ({
    match: { id: row.id, name: row.name, category: row.category, outputType: row.outputType, status: row.status },
    expected: Object.fromEntries([
      "dateOfCompletion", "contribution", "authors", "description", "skills", "links", "linksTitles",
      "linksDescriptions", "linksBackupDescriptions", "imageTitles", "imageDescriptions", "imageBackupDescriptions",
    ].map((key) => [key, structuredClone(row[key])])),
    values: next,
    rationale: "Current manuscript replaces a superseded public preprint entry.",
  });
  const plan = {
    version: 1,
    migrationId: RESEARCH_OUTPUT_SPLIT_MIGRATION_ID,
    replacements: [
      replacement(a, values({
        name: "Who is who: what matters in injuries in professional team sports",
        author: "Gustavo Pedro Ricou", imageCount: 2,
        description: "Working manuscript on how comparisons between players can alter measured injury rates in professional team sports.",
        links: [["https://arxiv.org/abs/2608.11228", "ArXiv record (earlier version)", "Earlier version currently public; record will host the revised Article A." ]],
      })),
      replacement(b, values({
        name: "New rules, old habits: across seven team sports, each league keeps its own way of using the rules",
        author: "Gustavo Pedro Ricou", imageCount: 1,
        description: "Working manuscript on how leagues use rule changes differently across team sports.",
        links: [["https://arxiv.org/abs/2609.05584", "ArXiv record (earlier version)", "Earlier version currently public; record will host the revised Article B." ]],
      })),
    ],
    addition: {
      afterId: ID_A,
      rationale: "Article C is a separate current manuscript, not a duplicate of the earlier preprint.",
      record: {
        id: ID_C, category: "research", collections: ["Data Analysis & Statistics", "Research Methods"],
        outputType: "manuscript", status: "in-preparation", authors: ["Gustavo Pedro Ricou"],
        name: "Close to cap: who plays the whole match across nine sports", dateOfCompletion: "",
        description: "Working manuscript on whole-match participation across nine sports and the role of substitution limits and player position.",
        contribution: "Sole author: developed the cross-sport analysis, built the reproducible workflow and wrote the manuscript.",
        skills: ["Statistics", "Mathematical Modeling", "Data Analysis"],
        imageUrls: [], imageTitles: [], imageDescriptions: [], imageBackupDescriptions: [], affiliations: [], collaborators: [], relatedRoleIds: [],
        links: ["https://arxiv.org/abs/2609.05584v1"],
        linksTitles: ["Related earlier arXiv preprint (partial results)"],
        linksDescriptions: ["Related earlier arXiv preprint (partial results)"],
        linksBackupDescriptions: ["The earlier preprint contains partial results; Article C is a separate manuscript in preparation."],
      },
    },
  };
  return { current, plan, a, b, untouched };
}

test("research-output split replaces only the two superseded entries, adds Article C, and preserves all other raw data", () => {
  const f = fixture(); const before = structuredClone(f.current);
  const result = planResearchOutputSplit(f.current, f.plan);
  assert.deepEqual(f.current, before);
  assert.equal(result.report.changed, true); assert.equal(result.report.changes.length, 3);
  assert.match(result.candidateHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.data.projects.map((project) => project.id), [ID_B, ID_A, ID_C, f.untouched.id]);
  const a = result.data.projects.find((project) => project.id === ID_A);
  const b = result.data.projects.find((project) => project.id === ID_B);
  const c = result.data.projects.find((project) => project.id === ID_C);
  assert.equal(a.outputType, "manuscript"); assert.equal(a.status, "in-preparation");
  assert.equal(b.outputType, "manuscript"); assert.equal(b.status, "in-preparation");
  assert.equal(c.status, "in-preparation"); assert.equal(c.dateOfCompletion, "");
  assert.deepEqual(a.imageUrls, f.a.imageUrls); assert.deepEqual(b.imageUrls, f.b.imageUrls);
  assert.equal(a.featuredOrder, 2); assert.equal(b.featuredOrder, 3);
  assert.deepEqual(result.data.projects.find((project) => project.id === f.untouched.id),
    before.projects.find((project) => project.id === f.untouched.id));
  assert.deepEqual(result.data.jobs, before.jobs); assert.deepEqual(result.data.education, before.education);
  assert.equal(result.data.privateMetadata, "PRIVATE_RAW_SENTINEL");
});

test("stale source details, altered targets and invalid metadata abort before mutating the portfolio", () => {
  for (const change of [
    (f) => { f.current.projects[0].description = "Later admin edit"; },
    (f) => { f.plan.replacements[0].match.id = "research-other"; },
    (f) => { f.plan.replacements[0].values.linksTitles = ["Different title"]; },
    (f) => { f.plan.replacements[0].values.imageTitles.pop(); },
    (f) => { f.plan.addition.record.id = "other-id"; },
    (f) => { f.plan.addition.record.status = "preprint"; },
    (f) => { f.plan.addition.afterId = ID_B; },
  ]) {
    const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planResearchOutputSplit(f.current, f.plan)); assert.deepEqual(f.current, before);
  }
});

test("completed split ledger makes a true no-op and preserves later owner edits", () => {
  const f = fixture(); const applied = planResearchOutputSplit(f.current, f.plan).data;
  applied.projects.find((project) => project.id === ID_A).name = "Later editorial title";
  const result = planResearchOutputSplit(applied, null, { alreadyApplied: true });
  assert.equal(result.report.changed, false); assert.equal(result.report.alreadyApplied, true); assert.deepEqual(result.data, applied);
});

test("one CAS write retains byte-identical local and Redis originals while stale hashes cannot write", async () => {
  const f = fixture(); const raw = JSON.stringify(f.current, null, 2); const key = "portfolio:research-output-split-test";
  const values = new Map([[key, raw]]); const backups = new Map(); let writes = 0;
  const redis = {
    get: async (target) => values.get(target) ?? null,
    eval: async (_script, keys, args) => {
      if (values.has(keys[1])) return 2;
      if (values.get(keys[0]) !== args[0]) return 0;
      values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
    },
  };
  const candidateHash = planResearchOutputSplit(f.current, f.plan).candidateHash;
  const options = {
    redis, key, plan: f.plan, dryRun: false, expectedHash: sha(raw), expectedCandidateHash: candidateHash,
    backupDirectory: "private-content/research-output-split-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async (path) => backups.get(path),
  };
  const result = await migrateResearchOutputSplitRedis(options);
  assert.equal(result.applied, true); assert.equal(values.get(result.backupKey), raw); assert.equal(backups.get(result.backupPath), raw);
  assert.equal(writes, 1); assert.equal(values.get(key), JSON.stringify(result.data));
  const repeat = await migrateResearchOutputSplitRedis(options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true); assert.equal(writes, 1);

  const stale = fixture(); const staleRaw = JSON.stringify(stale.current); const staleValues = new Map([[key, staleRaw]]);
  await assert.rejects(migrateResearchOutputSplitRedis({ ...options, redis: { ...redis, get: async (target) => staleValues.get(target) ?? null },
    expectedHash: "0".repeat(64) }));
});
