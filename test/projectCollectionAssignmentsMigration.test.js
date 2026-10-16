import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PROJECT_COLLECTIONS_MIGRATION_ID, PROJECT_COLLECTION_ASSIGNMENTS, planProjectCollectionAssignments,
  migrateProjectCollectionsRedis } from "../src/content/projectCollectionAssignmentsMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runProjectCollections } from "../scripts/migrate-project-collections.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const mask = value => { const copy = structuredClone(value); for (const row of copy.projects) delete row.collections; return copy; };

/** Builds all fifteen identities with protected narrative/credit/media and absent raw collections. */
function fixture() {
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", location: "", cvUrl: "/original-cv.pdf" },
    research: { thesisSummary: "Prediction is an aim, not an established result", thesisMethods: ["Matched single-task baselines"] },
    jobs: [{ id: "research-role", category: "research", title: "Original research role", duties: ["Original duty"], skills: ["Statistics"], mapLocation: "Original map" }],
    education: [{ degree: "Original degree", institution: "Original institution", status: "not-completed", courses: ["Original course"], skills: ["Physics"] }],
    projects: PROJECT_COLLECTION_ASSIGNMENTS.map(({ id, category }, index) => ({ id, category, name: `Original project ${index}`,
      dateOfCompletion: String(2000 + index), status: index === 14 ? "in-preparation" : "completed", outputType: "report",
      description: "Original limitations: inconclusive controlled experiment; not causal prediction",
      contribution: "Original backend contribution; frontend credited to collaborator", collaborators: ["Original collaborator"], authors: ["Author One", "Author Two"],
      relatedRoleIds: ["research-role"], featuredOrder: index + 1, skills: ["Data Analysis", "Scientific Computing"],
      imageUrls: [`/figure-${index}.png`, `/original-${index}.gif`], imageTitles: ["Original figure", "Original credit"],
      imageDescriptions: ["Original caption", "Second caption"], imageBackupDescriptions: ["Original backup", "Second backup"],
      links: [`/report-${index}.pdf`], linksTitles: ["Original report"], linksDescriptions: ["Original file description"], linksBackupDescriptions: ["Original file backup"] }))
  });
  current.projects.reverse(); current.privateMetadata = "PRIVATE_RAW_SENTINEL";
  for (const row of current.projects) delete row.collections;
  const patches = PROJECT_COLLECTION_ASSIGNMENTS.map(({ id, collections }) => {
    const row = current.projects.find(row => row.id === id);
    return { match: { id, category: row.category, name: row.name }, expected: { exists: false, collections: [] },
      expectedNarrative: { description: row.description, contribution: row.contribution }, collections: [...collections], rationale: "PRIVATE_REVIEW_SENTINEL" };
  });
  return { current, plan: { version: 1, migrationId: PROJECT_COLLECTIONS_MIGRATION_ID, patches } };
}

/** Models shared raw CAS/original backup and a separate ledger; no network access. */
function redisFixture() {
  const f = fixture(); const raw = JSON.stringify(f.current, null, 2); const key = "portfolio:collections-test";
  const previousLedger = key + ":migrations:photo-completion-2026-10-16-v1";
  const values = new Map([[key, raw], [previousLedger, "Retain previous ledger"]]); const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2; if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan: f.plan, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planProjectCollectionAssignments(f.current, f.plan).candidateHash,
    backupDirectory: "private-content/collections-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { ...f, raw, key, previousLedger, values, backups, redis, options, writes: () => writes };
}

test("approved collections add 28 memberships to fifteen stable IDs and preserve every other raw/public value and order", () => {
  const f = fixture(); const before = structuredClone(f.current); const result = planProjectCollectionAssignments(f.current, f.plan);
  assert.deepEqual(f.current, before); assert.deepEqual(mask(result.data), mask(before));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(before)));
  assert.equal(result.report.changes.length, 15); assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  assert.equal(result.data.projects.reduce((sum, row) => sum + row.collections.length, 0), 28);
  for (const target of PROJECT_COLLECTION_ASSIGNMENTS) {
    const row = result.data.projects.find(row => row.id === target.id);
    assert.deepEqual(row.collections, target.collections); assert.equal(Object.keys(row).at(-1), "collections");
  }
  assert.equal(new Set(result.data.projects.flatMap(row => row.collections)).size, 7);
  assert.deepEqual(result.data.projects.map(row => row.id), before.projects.map(row => row.id));
  assert.equal(result.data.projects.find(row => row.id === "research-zenodo-22044877").status, "in-preparation");
  assert.deepEqual(result.data.jobs, before.jobs); assert.deepEqual(result.data.education, before.education);
  assert.deepEqual(result.data.profile, before.profile); assert.deepEqual(result.data.research, before.research);
});

test("raw absent collections differs from persisted empty/null and cannot silently overwrite a concurrent label", () => {
  for (const labels of [[], null, ["Owner label"]]) {
    const f = fixture(); f.current.projects[0].collections = labels;
    assert.throws(() => planProjectCollectionAssignments(f.current, f.plan), /Stale raw/);
  }
  const f = fixture(); const patch = f.plan.patches[0]; patch.expected.exists = true;
  assert.throws(() => planProjectCollectionAssignments(f.current, f.plan), /Stale raw/);
  f.current.projects.find(row => row.id === patch.match.id).collections = [];
  assert.equal(planProjectCollectionAssignments(f.current, f.plan).report.changed, true);
});

test("wrong/missing/duplicate targets, category changes, stale names and scientific narrative fail without mutation", () => {
  for (const change of [
    f => f.plan.patches.pop(), f => { f.plan.patches[1] = structuredClone(f.plan.patches[0]); },
    f => { f.plan.patches[0].match.id = "unapproved-id"; }, f => { f.plan.patches[0].match.category = "software"; },
    f => { f.plan.patches[0].match.name = "Renamed without review"; }, f => { f.plan.patches[0].expectedNarrative.description = "Invented discovery"; },
    f => { f.plan.patches[0].expectedNarrative.contribution = "Invented frontend credit"; },
    f => { f.current.projects.pop(); }, f => { f.current.projects.push(structuredClone(f.current.projects[0])); },
    f => { f.current.profile = null; }, f => { f.plan.migrationId = "other-ledger"; }, f => { f.plan.version = 2; }
  ]) { const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planProjectCollectionAssignments(f.current, f.plan)); assert.deepEqual(f.current, before); }
});

test("only exact reviewed labels/order and strict plan fields are allowed, without changing the general API vocabulary", () => {
  for (const change of [
    f => { f.plan.patches[0].collections = ["Machine Learning"]; }, f => { f.plan.patches[0].collections.reverse(); },
    f => { f.plan.patches[0].collections.push(f.plan.patches[0].collections[0]); }, f => { f.plan.patches[0].collections[0] += " "; },
    f => { f.plan.patches[0].collections = null; }, f => { f.plan.patches[0].collections = []; },
    f => { f.plan.patches[0].expected.exists = "false"; }, f => { f.plan.patches[0].expected.collections = ["Not absent"]; },
    f => { f.plan.patches[0].expected.extra = true; }, f => { f.plan.patches[0].expectedNarrative.status = "published"; },
    f => { f.plan.patches[0].values = { category: "research" }; }, f => { f.plan.extra = true; },
    f => { f.plan.patches[0].match.extra = "private"; }, f => { f.plan.patches[0].rationale = ""; }
  ]) { const f = fixture(); change(f); assert.throws(() => planProjectCollectionAssignments(f.current, f.plan)); }
  assert.deepEqual(normalizePortfolioData({ projects: [{ collections: ["Unrestricted owner label"] }] }).projects[0].collections, ["Unrestricted owner label"]);
});

test("completed collection ledger preserves later labels, explicit clears, renamed and deleted projects", () => {
  const f = fixture(); const later = planProjectCollectionAssignments(f.current, f.plan).data;
  later.projects.pop(); later.projects[0].collections = []; later.projects[1].collections = ["Later owner label"]; later.projects[1].name = "Later rename";
  const repeat = planProjectCollectionAssignments(later, null, { alreadyApplied: true });
  assert.deepEqual(repeat.data, later); assert.equal(repeat.report.changed, false); assert.equal(repeat.report.alreadyApplied, true);
});

test("collections dry-run/default is read-only with its own ledger and no backup writes", async () => {
  const f = redisFixture(); for (const dryRun of [undefined, true]) {
    const result = await migrateProjectCollectionsRedis({ ...f.options, dryRun }); assert.equal(result.applied, false);
    assert.equal(result.ledgerKey, f.key + ":migrations:" + PROJECT_COLLECTIONS_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0);
  }
});

test("one collections CAS keeps exact local/Redis original backups and repeat never restores later edits/deletions", async () => {
  const f = redisFixture(); const result = await migrateProjectCollectionsRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw); assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data)); assert.equal(f.values.get(f.previousLedger), "Retain previous ledger");
  const later = JSON.parse(f.values.get(f.key)); later.projects.pop(); later.projects[0].collections = []; later.projects[1].collections = ["Later owner collection"];
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw); const repeat = await migrateProjectCollectionsRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true); assert.equal(repeat.report.changed, false);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("collections source/candidate/deployment/backup guards cannot write Redis on failure", async () => {
  for (const overrides of [{ expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined }, { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/collections-test/source.json", backupReader: async () => "{}" }]) {
    const f = redisFixture(); await assert.rejects(migrateProjectCollectionsRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
  }
});

test("prepared collections backups require exact raw bytes, not only equal parsed data", async () => {
  const f = redisFixture(); await assert.rejects(migrateProjectCollectionsRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/); assert.equal(f.writes(), 0);
  const result = await migrateProjectCollectionsRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("concurrent admin changes abort collections CAS without overwrite or Redis backup", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, laterOwnerEdit: true });
  await assert.rejects(migrateProjectCollectionsRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
});

test("collections CLI rejects ambiguous modes and options before file/Redis access", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateProjectCollectionsRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan"],
    ["--plan", "unread.json", "--apply"], ["--plan", "unread.json", "--apply", "--input", "unread.json"],
    ["--plan", "unread.json", "--apply", "--dry-run"], ["--plan", "unread.json", "--plan", "other.json"]]) {
    await assert.rejects(runProjectCollections(args), /option|Supply/);
  }
});

test("offline collections CLI emits only safe IDs/fields/counts/hashes and never complete source/narrative/rationale", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-collections-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith("portfolio-collections-preview-"));
    await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-project-collections.js", "--input", input, "--plan", plan, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout); assert.equal(report.applied, false); assert.equal(report.changes.length, 15);
  assert.match(report.candidateHash, /^[a-f0-9]{64}$/);
  for (const text of ["PRIVATE_PAYLOAD_SENTINEL", "PRIVATE_RAW_SENTINEL", "PRIVATE_REVIEW_SENTINEL", "Original limitations", "Original backend contribution"]) {
    assert.equal(result.stdout.includes(text), false);
  }
});
