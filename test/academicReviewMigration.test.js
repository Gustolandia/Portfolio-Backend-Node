import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { ACADEMIC_REVIEW_MIGRATION_ID, migrateAcademicReviewRedis, planAcademicReviewMigration } from "../src/content/academicReviewMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runAcademicReview } from "../scripts/migrate-academic-review.js";
import { ACADEMIC_REVIEW_PROJECT_COPY } from "../src/content/academicReviewContent.js";

const sha = (value) => createHash("sha256").update(value).digest("hex");

test("reviewed copy covers eight existing outputs without seeding status, dates, categories, skills or media", () => {
  assert.equal(Object.keys(ACADEMIC_REVIEW_PROJECT_COPY).length, 8);
  for (const values of Object.values(ACADEMIC_REVIEW_PROJECT_COPY)) {
    assert.equal(typeof values.contribution, "string");
    assert.ok(values.contribution.length > 20);
    assert.ok(values.description.length > 20);
    assert.ok(Object.keys(values).every((field) => ["name", "authors", "description", "contribution"].includes(field)));
  }
  assert.match(ACADEMIC_REVIEW_PROJECT_COPY["research-arxiv-2608-27736"].contribution, /^Lead author/);
  assert.match(ACADEMIC_REVIEW_PROJECT_COPY["research-arxiv-2608-11228"].contribution, /^Lead author/);
  assert.match(ACADEMIC_REVIEW_PROJECT_COPY["project-c2307a8588da6647db62d7b3"].description, /not a live-plasma/);
  assert.match(ACADEMIC_REVIEW_PROJECT_COPY["project-c1f062a755abff4388000db1"].description, /inconclusive/);
  assert.match(ACADEMIC_REVIEW_PROJECT_COPY["project-701dc8ee8551735c9de9d27d"].description, /undergraduate/);
  const latency = ACADEMIC_REVIEW_PROJECT_COPY["research-zenodo-22044877"];
  assert.deepEqual(latency.authors, ["Gustavo Pedro Ricou", "Romaric Duvignau"]);
  assert.match(latency.description, /in preparation/);
  assert.match(latency.contribution, /does not specify/);
});

function fixture() {
  const current = normalizePortfolioData({ profile: { email: "" }, research: { thesisStatus: "in-progress", thesisSummary: "An aim, not an established result." },
    jobs: [{ id: "role-1", category: "research", title: "Intern", skills: ["Python"] }],
    education: [{ degree: "Fusion studies", institution: "University", start: "2013", end: "2014", courses: ["Language", "Numerical Physics", "Language"], activities: ["Basketball"] }],
    projects: [{ id: "paper-1", category: "research", name: "Old title", outputType: "manuscript", status: "in-preparation", relatedRoleIds: ["role-1"],
      authors: ["Author"], collaborators: ["Contributor"], skills: ["Python"], imageUrls: ["/a.gif", "/b.jpg"], imageDescriptions: ["A", "B"],
      imageBackupDescriptions: ["Alt A", "Alt B"], links: ["https://example.org/archive"], linksTitles: ["Archive"], linksDescriptions: ["Archive"], linksBackupDescriptions: ["Old artifact"] }]
  });
  current.futureTopLevel = { preserved: true };
  current.projects[0].futureMetadata = ["preserved"];
  delete current.research.thesisSupervisor;
  const patch = (collection, values, extra = {}) => {
    const source = collection === "education" || collection === "projects" ? current[collection][0] : current[collection];
    return { collection, ...extra, expected: Object.fromEntries(Object.keys(values).map((key) => [key, source[key] ?? ""])), values, evidence: ["Reviewed primary source / explicit owner confirmation"] };
  };
  const match = Object.fromEntries(["degree", "institution", "start", "end"].map((key) => [key, current.education[0][key]]));
  const plan = { version: 1, migrationId: ACADEMIC_REVIEW_MIGRATION_ID, patches: [
    patch("profile", { email: "public@example.org" }),
    patch("research", { thesisSupervisor: "Confirmed Supervisor", thesisInstitution: "Confirmed Institution", thesisStart: "2026-09-25", thesisEnd: "2027-04-19" }),
    patch("education", { degree: "Postgraduate coursework (taught component completed)", status: "not-completed",
      courses: ["Numerical Physics", "Language", "Language"], activities: ["Basketball", "Thesis not submitted; degree not awarded."] }, { match }),
    patch("projects", { name: "Current title", contribution: "Supported contribution", description: "First-version manuscript, not peer reviewed.",
      authors: ["Author", "Second author"], links: ["https://example.org/archive", "https://example.org/code"],
      linksTitles: ["Restricted archive", "Public code"], linksDescriptions: ["Restricted archive", "Public code"],
      linksBackupDescriptions: ["Restricted files", "Browse code"] }, { id: "paper-1" })
  ] };
  return { current, plan };
}

test("academic preview changes only reviewed fields; preserves identities, order, media, skills and unknown raw metadata", () => {
  const { current, plan } = fixture();
  const original = structuredClone(current);
  const result = planAcademicReviewMigration(current, plan);
  const expected = structuredClone(current);
  for (const patch of plan.patches) Object.assign(Array.isArray(expected[patch.collection]) ? expected[patch.collection][0] : expected[patch.collection], patch.values);
  assert.deepEqual(result.data, expected);
  assert.deepEqual(current, original);
  assert.equal(result.candidateHash, sha(JSON.stringify(expected)));
  assert.equal(result.report.changes.length, 4);
  assert.equal(JSON.stringify(result.report).includes("public@example.org"), false);
  assert.deepEqual(result.data.jobs, current.jobs);
  for (const field of ["id", "category", "status", "dateOfCompletion", "outputType", "relatedRoleIds", "collaborators", "skills", "imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"]) {
    assert.deepEqual(result.data.projects[0][field], current.projects[0][field]);
  }
});

test("academic plans reject stale fields, unknown targets and out-of-scope metadata", () => {
  for (const change of [
    (f) => { f.plan.patches[0].expected.email = "stale@example.org"; },
    (f) => { f.plan.patches[0].collection = "jobs"; },
    (f) => { f.plan.patches[0].values.adminSecret = "forbidden"; },
    (f) => { f.plan.patches[1].values.thesisSupervisor = 3; },
    (f) => { f.plan.patches[2].match = { institution: "University" }; },
    (f) => { f.plan.patches[3].id = "missing"; },
    (f) => { f.plan.patches[3].evidence = []; },
    (f) => { f.plan.patches.push(f.plan.patches[0]); },
    (f) => { f.current.projects[0].category = "coursework"; },
    (f) => { f.current.education.push(structuredClone(f.current.education[0])); }
  ]) {
    const f = fixture(); change(f);
    const original = structuredClone(f.current);
    assert.throws(() => planAcademicReviewMigration(f.current, f.plan));
    assert.deepEqual(f.current, original);
  }
});

test("course reordering preserves duplicates and activities may only append", () => {
  for (const change of [
    (f) => { f.plan.patches[2].values.courses = ["Numerical Physics", "Language"]; },
    (f) => { f.plan.patches[2].values.courses.push("Invented module"); },
    (f) => { f.plan.patches[2].values.activities = ["Degree not awarded."]; }
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => planAcademicReviewMigration(f.current, f.plan), /course multiset|activities/);
  }
});

test("academic links require safe aligned tuples and cannot remove/reorder original URLs", () => {
  for (const change of [
    (f) => { delete f.plan.patches[3].values.linksTitles; delete f.plan.patches[3].expected.linksTitles; },
    (f) => { f.plan.patches[3].values.linksBackupDescriptions.pop(); },
    (f) => { f.plan.patches[3].values.links.reverse(); },
    (f) => { f.plan.patches[3].values.links[1] = "javascript:alert(1)"; },
    (f) => { f.plan.patches[0].values.email = "invalid address"; },
    (f) => { f.plan.patches[2].values.status = "awarded"; }
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => planAcademicReviewMigration(f.current, f.plan), /aligned|discarded|validation/);
  }
});

test("legacy project metadata edits preserve computed identity; renames require a persisted ID", () => {
  const f = fixture();
  delete f.current.projects[0].id;
  f.plan.patches[3].id = normalizePortfolioData(f.current).projects[0].id;
  assert.throws(() => planAcademicReviewMigration(f.current, f.plan), /Persist project identity/);
  delete f.plan.patches[3].values.name; delete f.plan.patches[3].expected.name;
  const result = planAcademicReviewMigration(f.current, f.plan);
  assert.equal(Object.hasOwn(result.data.projects[0], "id"), false);
  assert.deepEqual(normalizePortfolioData(result.data).projects.map(p => p.id), normalizePortfolioData(f.current).projects.map(p => p.id));
});

function redisFixture() {
  const f = fixture();
  const key = "portfolio:test";
  const values = new Map([[key, JSON.stringify(f.current)], [key + ":migrations:previous", "preserved"]]);
  const backups = [];
  let writes = 0;
  const redis = { get: async (key) => values.get(key) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2;
    if (values.get(keys[0]) !== args[0]) return 0;
    writes++; values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); return 1;
  } };
  const options = { redis, key, plan: f.plan, dryRun: false, expectedHash: sha(values.get(key)),
    expectedCandidateHash: planAcademicReviewMigration(f.current, f.plan).candidateHash, verifyDeployment: async () => {},
    backupDirectory: "private-content/test-review", backupWriter: async (path, raw) => backups.push(raw) };
  return { ...f, options, values, key, backups, writes: () => writes };
}

test("academic Redis preview is read-only and apply backs up exact raw bytes with an independent ledger", async () => {
  const f = redisFixture();
  const original = f.values.get(f.key);
  assert.equal((await migrateAcademicReviewRedis({ ...f.options, dryRun: undefined })).applied, false);
  assert.equal(f.writes(), 0); assert.deepEqual(f.backups, []);
  const result = await migrateAcademicReviewRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.writes(), 1);
  assert.equal(f.values.get(result.backupKey), original);
  assert.deepEqual(f.backups, [original]);
  assert.equal(f.values.get(f.key + ":migrations:previous"), "preserved");
  assert.equal(result.ledgerKey, `${f.key}:migrations:${ACADEMIC_REVIEW_MIGRATION_ID}`);
  const later = JSON.parse(f.values.get(f.key)); later.projects = []; later.profile.email = "";
  f.values.set(f.key, JSON.stringify(later));
  const repeat = await migrateAcademicReviewRedis(f.options);
  assert.equal(repeat.applied, false); assert.deepEqual(repeat.data, later); assert.equal(f.writes(), 1);
});

test("academic apply aborts on mismatched hashes/backups, deployment failures and concurrent admin edits", async () => {
  const f = redisFixture();
  for (const overrides of [
    { expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupFile: "private-content/source.json", backupReader: async () => "{}" },
    { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } }
  ]) await assert.rejects(migrateAcademicReviewRedis({ ...f.options, ...overrides }));
  await assert.rejects(migrateAcademicReviewRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, JSON.stringify({ ...f.current, concurrent: true })); } }), /admin changed/);
  assert.equal(f.writes(), 0);
});

test("academic review rejects ambiguous modes and unsafe CLI combinations before access", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateAcademicReviewRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--apply", "--plan", "not-read.json"], ["--plan", "not-read.json", "--apply", "--input", "not-read.json"]]) {
    await assert.rejects(runAcademicReview(args), /option|Supply/);
  }
});
