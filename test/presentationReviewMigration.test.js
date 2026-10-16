import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PRESENTATION_REVIEW_MIGRATION_ID, migratePresentationReviewRedis, planPresentationReviewMigration } from "../src/content/presentationReviewMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runPresentationReview } from "../scripts/migrate-presentation-review.js";

const sha = value => createHash("sha256").update(value).digest("hex");

/** Builds approved narrative targets and rich protected content without network/private data. */
function fixture() {
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", headline: "Original headline", summary: "Original summary", academicStatus: "Original status",
      availability: "Original availability", location: "", cvUrl: "/original-cv.pdf", portraitUrl: "/original-portrait.jpg", researchInterests: ["Original interest"] },
    research: { title: "Research", summary: "Original research overview", thesisSummary: "Original same-input simultaneous two-task comparison",
      thesisTitle: "Original thesis title", thesisQuestions: ["Original question"], thesisMethods: ["Hard parameter sharing"],
      thesisStatus: "in-progress", thesisSupervisor: "Original supervisor", thesisStart: "2026-09-25", thesisEnd: "2027-04-19" },
    pages: { home: { title: "Original page title", description: "Original page copy", imageUrl: "/original-home.gif" } },
    jobs: [{ id: "job-one", title: "Original role", category: "industry", duties: ["Original duty"], skills: ["Cloud Computing"], mapLocation: "Original map" },
      { id: "job-two", title: "Original research role", category: "research", duties: ["Original research duty"], skills: ["Plasma Diagnostics"] }],
    education: [{ degree: "Original degree", grade: "Provisional, not a final result", status: "in-progress", courses: ["Original course"], skills: ["Statistics"] }],
    projects: [
      { id: "research-arxiv-2608-27736", name: "Original lead-pipe preprint", category: "research", status: "preprint", outputType: "preprint",
        description: "Original discovery penalty within the model, not field-tested", contribution: "Original role; coauthor validation credited",
        authors: ["Author One", "Coauthor Two"], collaborators: ["Collaborator"], relatedRoleIds: ["job-two"], featuredOrder: 1,
        skills: ["Statistics", "Mathematical Modeling"], collections: ["Owner collection"], dateOfCompletion: "2025",
        imageUrls: ["/original.gif", "/second.jpg"], imageTitles: ["Original credit", "Other credit"],
        imageDescriptions: ["Original caption", "Other caption"], imageBackupDescriptions: ["Original backup", "Other backup"] },
      { id: "research-zenodo-22044877", name: "Original latency manuscript", category: "research", outputType: "manuscript", status: "in-preparation",
        description: "Original controlled scheduler intervention", contribution: "Individual division of responsibilities unspecified",
        authors: ["Author One", "Coauthor Three"], skills: ["Performance Testing", "Statistics"], dateOfCompletion: "2026",
        links: ["/paper.pdf", "/older.zip"], linksDescriptions: ["Current manuscript", "Older restricted archive"], linksBackupDescriptions: ["Current manuscript", "Older restricted archive"] },
      { id: "project-1930afed6e1b31fc8e95b24e", name: "Filebox", category: "software", description: "Original file-storage description", skills: ["Database Management"] }
    ]
  });
  current.projects.reverse(); current.privateMetadata = { preserve: ["Original", "order"] };
  current.projects[0].legacyRawField = "Original raw field";
  const plan = { version: 1, migrationId: PRESENTATION_REVIEW_MIGRATION_ID, patches: [] };
  const add = (collection, values, selector = {}) => {
    const row = collection === "projects" ? current.projects.find(row => row.id === selector.id) : collection === "pages" ? current.pages[selector.page] : current[collection];
    plan.patches.push({ collection, ...(collection === "projects" ? { match: { id: row.id, category: row.category, name: row.name } }
      : collection === "pages" ? { page: selector.page } : {}), expected: Object.fromEntries(Object.keys(values).map(key => [key, row[key]])),
      values, evidence: ["Reviewed existing source facts and owner-approved copy"] });
  };
  add("profile", { headline: "Reviewed headline", summary: "Existing research and production backend work", academicStatus: "MSc (in progress)" });
  add("pages", { description: "Reviewed home description" }, { page: "home" });
  add("research", { summary: "Reviewed research overview", thesisSummary: "Investigates two tasks simultaneously on the same inputs with a shared trunk and separate heads versus matched single-task networks; prediction is an aim.",
    thesisQuestions: ["When does sharing help relative to a matched baseline?", "Can transfer be predicted before training?"] });
  add("projects", { description: "Reviewed discovery penalty within the model, not a field-tested intervention", contribution: "Lead author; coauthor validation remains credited" }, { id: "research-arxiv-2608-27736" });
  add("projects", { description: "Reviewed scheduler-sensitive measurement question", contribution: "Coauthored the manuscript; no invented individual responsibilities" }, { id: "research-zenodo-22044877" });
  add("projects", { description: "Reviewed file-storage description" }, { id: "project-1930afed6e1b31fc8e95b24e" });
  const mask = value => { const copy = structuredClone(value); for (const patch of plan.patches) {
    const row = patch.collection === "projects" ? copy.projects.find(row => row.id === patch.match.id)
      : patch.collection === "pages" ? copy.pages[patch.page] : copy[patch.collection];
    Object.keys(patch.values).forEach(field => delete row[field]);
  } return copy; };
  return { current, plan, mask };
}

/** Models the existing atomic raw CAS without network or actual Redis writes. */
function redisFixture() {
  const f = fixture(); const raw = JSON.stringify(f.current, null, 2); const key = "portfolio:presentation-test";
  const values = new Map([[key, raw], [key + ":migrations:research-project-skills-2026-10-16-v1", "Retain prior ledger"]]);
  const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2; if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan: f.plan, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planPresentationReviewMigration(f.current, f.plan).candidateHash,
    backupDirectory: "private-content/presentation-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { ...f, raw, key, values, backups, redis, options, writes: () => writes };
}

test("presentation preview changes only approved narrative fields with raw/public preservation and input immutability", () => {
  const f = fixture(); const original = structuredClone(f.current); const result = planPresentationReviewMigration(f.current, f.plan);
  assert.deepEqual(f.current, original); assert.deepEqual(f.mask(result.data), f.mask(original));
  assert.deepEqual(f.mask(normalizePortfolioData(result.data)), f.mask(normalizePortfolioData(original)));
  assert.equal(result.report.changes.length, 6); assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  assert.deepEqual(result.data.jobs, original.jobs); assert.deepEqual(result.data.education, original.education);
  assert.deepEqual(result.data.projects.map(row => row.id), original.projects.map(row => row.id));
  assert.equal(result.data.profile.cvUrl, original.profile.cvUrl); assert.equal(result.data.profile.location, "");
});

test("narrative polish preserves manuscript status, restricted archive warning, attribution/media order and thesis methods", () => {
  const f = fixture(); const { data } = planPresentationReviewMigration(f.current, f.plan);
  const latency = data.projects.find(row => row.id === "research-zenodo-22044877");
  assert.equal(latency.status, "in-preparation"); assert.deepEqual(latency.linksDescriptions, ["Current manuscript", "Older restricted archive"]);
  assert.deepEqual(latency.authors, ["Author One", "Coauthor Three"]);
  const lead = data.projects.find(row => row.id === "research-arxiv-2608-27736");
  assert.match(lead.description, /within the model, not a field-tested/); assert.match(lead.contribution, /coauthor validation/);
  assert.deepEqual(lead.imageUrls, ["/original.gif", "/second.jpg"]); assert.deepEqual(lead.imageBackupDescriptions, ["Original backup", "Other backup"]);
  assert.deepEqual(data.research.thesisMethods, f.current.research.thesisMethods); assert.equal(data.research.thesisSupervisor, "Original supervisor");
  assert.equal(data.research.thesisStatus, "in-progress"); assert.match(data.research.thesisSummary, /prediction is an aim/);
  assert.equal(data.profile.availability, "Original availability");
});

test("presentation plan rejects facts, skills, captions, URLs, rankings, categories, CV, courses and unapproved records", () => {
  const modifications = [
    f => { f.plan.extra = []; }, f => { f.plan.patches[0].evidence = []; },
    f => { f.plan.patches[0].values.location = "Invented location"; f.plan.patches[0].expected.location = ""; },
    f => { f.plan.patches[0].values.cvUrl = "/new.pdf"; f.plan.patches[0].expected.cvUrl = "/original-cv.pdf"; },
    f => { f.plan.patches[1].values.title = "New title"; f.plan.patches[1].expected.title = "Original page title"; },
    f => { f.plan.patches[1].page = "unknown"; },
    f => { f.plan.patches[2].values.thesisMethods = []; f.plan.patches[2].expected.thesisMethods = ["Hard parameter sharing"]; },
    ...["status", "authors", "skills", "imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions", "collections", "featuredOrder", "relatedRoleIds"].map(field =>
      f => { f.plan.patches[3].values[field] = []; f.plan.patches[3].expected[field] = []; }),
    f => { f.plan.patches[3].match.id = "unreviewed-project"; }, f => { f.plan.patches[3].match.category = "software"; },
    f => { f.plan.patches[0].collection = "jobs"; }, f => { f.plan.patches[0].collection = "education"; },
    f => { f.plan.patches[5].values.contribution = "Invented ownership"; f.plan.patches[5].expected.contribution = ""; }
  ];
  for (const change of modifications) { const f = fixture(); change(f); const original = structuredClone(f.current);
    assert.throws(() => planPresentationReviewMigration(f.current, f.plan)); assert.deepEqual(f.current, original); }
});

test("presentation source identities, old values and complete field types must match exactly", () => {
  for (const change of [
    f => { f.plan.patches[0].expected.summary = "Stale summary"; },
    f => { f.plan.patches[0].expected = {}; }, f => { f.plan.patches[0].values.summary = null; },
    f => { f.plan.patches[0].values.summary = " "; }, f => { f.plan.patches[2].values.thesisQuestions = ["Question", 1]; },
    f => { f.plan.patches[2].values.thesisQuestions = []; }, f => { f.plan.patches.push(structuredClone(f.plan.patches[0])); },
    f => { f.plan.patches[3].match.name = "Different project"; },
    f => { f.current.projects.push(structuredClone(f.current.projects.find(row => row.id === f.plan.patches[3].match.id))); },
    f => { f.current.projects = f.current.projects.filter(row => row.id !== f.plan.patches[3].match.id); },
    f => { f.current.profile = null; }, f => { f.current.education = {}; }
  ]) { const f = fixture(); change(f); assert.throws(() => planPresentationReviewMigration(f.current, f.plan)); }
});

test("completed presentation ledger repeats preserve later narrative edits, deleted records and curated skills", () => {
  const f = fixture(); const later = planPresentationReviewMigration(f.current, f.plan).data;
  later.projects.pop(); later.profile.summary = "Later owner wording"; later.jobs[0].skills = ["Later owner label"];
  const repeat = planPresentationReviewMigration(later, null, { alreadyApplied: true });
  assert.deepEqual(repeat.data, later); assert.equal(repeat.report.changed, false); assert.equal(repeat.report.alreadyApplied, true);
});

test("presentation Redis previews/defaults are read-only with their own independent ledger", async () => {
  const f = redisFixture();
  for (const dryRun of [undefined, true]) { const result = await migratePresentationReviewRedis({ ...f.options, dryRun });
    assert.equal(result.applied, false); assert.equal(result.snapshotHash, sha(f.raw));
    assert.equal(result.ledgerKey, f.key + ":migrations:" + PRESENTATION_REVIEW_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0); }
});

test("presentation apply atomically preserves exact originals and ledger repeats never restore later edits", async () => {
  const f = redisFixture(); const result = await migratePresentationReviewRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw); assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data)); assert.deepEqual(f.mask(result.data), f.mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:research-project-skills-2026-10-16-v1"), "Retain prior ledger");
  const later = JSON.parse(f.values.get(f.key)); later.projects.pop(); later.profile.summary = "Later wording";
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw);
  const repeat = await migratePresentationReviewRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.changed, false); assert.equal(repeat.report.alreadyApplied, true);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("presentation source/candidate/deployment/backup failures abort before Redis writes", async () => {
  for (const overrides of [{ expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined }, { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/presentation-test/source.json", backupReader: async () => "{}" }]) {
    const f = redisFixture(); await assert.rejects(migratePresentationReviewRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.writes(), 0);
  }
});

test("presentation prepared backups must match every original byte rather than parsed equality", async () => {
  const f = redisFixture();
  await assert.rejects(migratePresentationReviewRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/); assert.equal(f.writes(), 0);
  const result = await migratePresentationReviewRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("a concurrent admin edit aborts presentation CAS without overwrite or Redis backup creation", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migratePresentationReviewRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
});

test("presentation CLI rejects ambiguous modes before accessing files or Redis", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migratePresentationReviewRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "unread.json", "--apply"],
    ["--plan", "unread.json", "--apply", "--input", "unread.json"], ["--plan", "unread.json", "--apply", "--dry-run"],
    ["--plan", "unread.json", "--apply", "--expected-hash", "0".repeat(64), "--expected-candidate-hash", "0".repeat(64)]]) {
    await assert.rejects(runPresentationReview(args), /option|Supply/);
  }
});

test("offline presentation CLI emits counts/fields/hashes, not private source or approved copy", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-presentation-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-presentation-preview-")); await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-presentation-review.js", "--input", input, "--plan", plan, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false); assert.equal(report.changes.length, 6); assert.match(report.candidateHash, /^[a-f0-9]{64}$/);
  for (const text of ["PRIVATE_PAYLOAD_SENTINEL", "Reviewed headline", "Original degree", "prediction is an aim"]) assert.equal(result.stdout.includes(text), false);
});
