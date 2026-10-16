import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { SCIENTIFIC_FIGURES_MIGRATION_ID, SCIENTIFIC_FIGURE_SOURCES, SCIENTIFIC_MEDIA_FIELDS,
  migrateScientificFiguresRedis, planScientificFiguresMigration } from "../src/content/scientificFiguresMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runScientificFigures } from "../scripts/migrate-scientific-figures.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const media = row => Object.fromEntries(SCIENTIFIC_MEDIA_FIELDS.map(field => [field, row[field]]));
const match = row => Object.fromEntries(["id", "category", "name"].map(field => [field, row[field]]));
const FILEBOX_ID = "project-1930afed6e1b31fc8e95b24e";
const mask = value => { const copy = structuredClone(value); const ids = [...SCIENTIFIC_FIGURE_SOURCES.map(spec => spec.projectId), FILEBOX_ID];
  copy.projects.forEach(row => { if (ids.includes(row.id)) SCIENTIFIC_MEDIA_FIELDS.forEach(field => delete row[field]); }); return copy; };

/** Builds all approved identities with exact original tuples, rich protected content and isolated staging receipts. */
function fixture() {
  const row = (id, category, index, count) => ({ id, category, name: `Original project ${index}`, description: "Approved narrative, not a causal claim",
    contribution: "Original credited role", status: "in-preparation", outputType: "manuscript", authors: ["Author One", "Author Two"],
    collaborators: ["Original collaborator"], collections: ["Original collection"], relatedRoleIds: ["research-role"], featuredOrder: index + 1,
    dateOfCompletion: String(2000 + index), skills: ["Statistics", "Data Analysis"],
    imageUrls: Array.from({ length: count }, (_, i) => `/original-${index}-${i}.gif`),
    imageTitles: Array.from({ length: count }, (_, i) => `Original title ${i}`),
    imageDescriptions: Array.from({ length: count }, (_, i) => `Original caption ${i}`),
    imageBackupDescriptions: Array.from({ length: count }, (_, i) => `Original backup ${i}`),
    links: ["/original.pdf"], linksDescriptions: ["Older restricted archive"], linksBackupDescriptions: ["Original file backup"] });
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", summary: "Approved BoscaSports backend narrative", location: "", cvUrl: "/original-cv.pdf" },
    research: { thesisSummary: "Simultaneous two-task shared trunk study; prediction is an aim", thesisMethods: ["Original method"] },
    jobs: [{ id: "research-role", category: "research", title: "Original role", duties: ["Original duty"], skills: ["Plasma Diagnostics"], imageUrls: ["/job.gif"] }],
    education: [{ degree: "Original degree", grade: "Original grade", courses: ["Original course"], skills: ["Statistics"], imageUrls: ["/education.gif"] }],
    projects: [...SCIENTIFIC_FIGURE_SOURCES.map((spec, index) => row(spec.projectId, spec.category, index, 2)), row(FILEBOX_ID, "software", 4, 5),
      row("unrelated-project", "research", 5, 1)]
  });
  current.projects.reverse(); current.privateMetadata = "PRIVATE_RAW_SENTINEL";
  const receipts = []; const assets = SCIENTIFIC_FIGURE_SOURCES.map((spec, index) => {
    const project = current.projects.find(row => row.id === spec.projectId);
    const asset = { id: spec.id, match: match(project), sha256: spec.sha256, bytes: 100 + index, width: 120 + index, height: 220 + index,
      caption: "Approved caption with complete source credit", backupDescription: "Approved backup description", expectedMedia: structuredClone(media(project)) };
    const decoded = { status: 200, bytes: asset.bytes, sha256: asset.sha256, width: asset.width, height: asset.height, pages: 1, format: "png", nonblank: true };
    receipts.push({ assetId: spec.id, sourceSha256: spec.sha256, sourceBytes: asset.bytes, status: "verified", folder: "/Portfolio-Website/Snippets",
      provider: { fileId: `isolated-file-${index}`, size: asset.bytes, url: `https://ik.imagekit.io/Gustolandia/Portfolio-Website/Snippets/${spec.id}.png` },
      originalVerification: { ...decoded }, deliveryVerification: { ...decoded } });
    return asset;
  });
  const filebox = current.projects.find(row => row.id === FILEBOX_ID);
  const plan = { version: 1, migrationId: SCIENTIFIC_FIGURES_MIGRATION_ID, assets,
    filebox: { match: match(filebox), expectedMedia: structuredClone(media(filebox)), order: [2, 0, 1, 3, 4] } };
  return { current, plan, receipts };
}

/** Simulates the common atomic raw CAS and separate ledger without live Redis/upload access. */
function redisFixture() {
  const f = fixture(); const raw = JSON.stringify(f.current, null, 2); const key = "portfolio:scientific-test";
  const values = new Map([[key, raw], [key + ":migrations:presentation-review-2026-10-16-v1", "Retain previous ledger"]]);
  const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2; if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan: f.plan, receipts: f.receipts, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planScientificFiguresMigration(f.current, f.plan, f.receipts).candidateHash,
    backupDirectory: "private-content/scientific-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { ...f, raw, key, values, backups, redis, options, writes: () => writes };
}

test("scientific media preview prepends four approved whole tuples, permutes Filebox and preserves every other raw/public value", () => {
  const f = fixture(); const original = structuredClone(f.current); const result = planScientificFiguresMigration(f.current, f.plan, f.receipts);
  assert.deepEqual(f.current, original); assert.deepEqual(mask(result.data), mask(original));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(original)));
  assert.equal(result.report.changes.length, 5); assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  for (const asset of f.plan.assets) {
    const old = original.projects.find(row => row.id === asset.match.id); const next = result.data.projects.find(row => row.id === asset.match.id);
    assert.equal(next.imageUrls[0], f.receipts.find(r => r.assetId === asset.id).provider.url + "?tr=orig-true");
    assert.equal(next.imageTitles[0], asset.caption); assert.equal(next.imageDescriptions[0], asset.caption); assert.equal(next.imageBackupDescriptions[0], asset.backupDescription);
    SCIENTIFIC_MEDIA_FIELDS.forEach(field => assert.deepEqual(next[field].slice(1), old[field]));
  }
  const old = original.projects.find(row => row.id === FILEBOX_ID); const next = result.data.projects.find(row => row.id === FILEBOX_ID);
  SCIENTIFIC_MEDIA_FIELDS.forEach(field => assert.deepEqual(next[field], [2, 0, 1, 3, 4].map(i => old[field][i])));
  assert.deepEqual(result.data.projects.map(row => row.id), original.projects.map(row => row.id));
});

test("scientific media retains explicit blank raw captions and their public alias behavior without shifting associations", () => {
  const f = fixture(); const asset = f.plan.assets[0]; const row = f.current.projects.find(row => row.id === asset.match.id);
  row.imageTitles[0] = ""; row.imageDescriptions[1] = ""; row.imageBackupDescriptions[0] = ""; asset.expectedMedia = media(row);
  const before = normalizePortfolioData(f.current).projects.find(item => item.id === row.id);
  const result = planScientificFiguresMigration(f.current, f.plan, f.receipts);
  const after = result.data.projects.find(item => item.id === row.id);
  assert.equal(after.imageTitles[1], ""); assert.equal(after.imageDescriptions[2], ""); assert.equal(after.imageBackupDescriptions[1], "");
  const normalized = normalizePortfolioData(result.data).projects.find(item => item.id === row.id);
  SCIENTIFIC_MEDIA_FIELDS.forEach(field => assert.deepEqual(normalized[field].slice(1), before[field]));
});

test("original-byte links tolerate separately optimized normal delivery without changing original PNG selection", () => {
  const f = fixture(); f.receipts[3].deliveryVerification.bytes = 80; f.receipts[3].deliveryVerification.sha256 = "a".repeat(64);
  const result = planScientificFiguresMigration(f.current, f.plan, f.receipts);
  assert.match(result.data.projects.find(row => row.id === f.plan.assets[3].match.id).imageUrls[0], /\?tr=orig-true$/);
});

test("narrative, skills, status, ordered authors, collections, courses, CV and existing GIF URLs stay exact", () => {
  const f = fixture(); const { data } = planScientificFiguresMigration(f.current, f.plan, f.receipts);
  assert.deepEqual(data.jobs, f.current.jobs); assert.deepEqual(data.education, f.current.education);
  assert.deepEqual(data.profile, f.current.profile); assert.deepEqual(data.research, f.current.research);
  const latency = data.projects.find(row => row.id === "research-zenodo-22044877");
  assert.equal(latency.status, "in-preparation"); assert.deepEqual(latency.authors, ["Author One", "Author Two"]);
  assert.deepEqual(latency.linksDescriptions, ["Older restricted archive"]); assert.ok(latency.imageUrls[1].endsWith(".gif"));
});

test("unapproved sources, QA hashes, duplicate/missing receipts, wrong accounts and altered originals are rejected", () => {
  const changes = [
    f => { f.plan.assets[0].sha256 = "0".repeat(64); }, f => { f.plan.assets[0].id = "qa-preview"; }, f => { f.plan.assets.pop(); },
    f => { f.plan.assets[1] = structuredClone(f.plan.assets[0]); }, f => { f.receipts.pop(); }, f => { f.receipts[1] = structuredClone(f.receipts[0]); },
    f => { f.receipts[0] = null; }, f => { f.receipts[0].status = "upload-outcome-uncertain"; },
    f => { f.receipts[0].sourceSha256 = "0".repeat(64); }, f => { f.receipts[0].sourceBytes += 1; },
    f => { f.receipts[0].originalVerification.sha256 = "0".repeat(64); }, f => { f.receipts[0].originalVerification.format = "webp"; },
    f => { f.receipts[0].originalVerification.pages = 2; }, f => { f.receipts[0].originalVerification.nonblank = false; },
    f => { f.receipts[0].provider.fileId = {}; }, f => { f.receipts[0].folder = "/Portfolio Website/Snippets"; },
    f => { f.receipts[0].provider.url = "https://unapproved.example/figure.png"; },
    f => { f.receipts[0].provider.url += "?tr=w-200"; }, f => { f.receipts[0].deliveryVerification.width += 1; }
  ];
  for (const change of changes) { const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planScientificFiguresMigration(f.current, f.plan, f.receipts)); assert.deepEqual(f.current, before); }
});

test("scientific media rejects stale/misaligned old tuples, wrong IDs/categories, retirements and nonmedia writes", () => {
  for (const change of [
    f => { f.plan.retirements = []; }, f => { f.plan.assets[0].values = { description: "Invented" }; },
    f => { f.plan.assets[0].match.category = "software"; }, f => { f.plan.assets[0].match.id = FILEBOX_ID; },
    f => { f.plan.assets[0].match.name = "Different project"; }, f => { f.plan.assets[0].expectedMedia.imageTitles[0] = "Stale caption"; },
    f => { f.plan.assets[0].caption = ""; }, f => { f.plan.assets[0].backupDescription = null; },
    f => { f.current.projects.find(row => row.id === f.plan.assets[0].match.id).imageTitles.pop(); },
    f => { f.current.projects.push(structuredClone(f.current.projects.find(row => row.id === f.plan.assets[0].match.id))); },
    f => { f.current.projects = f.current.projects.filter(row => row.id !== f.plan.assets[0].match.id); },
    f => { f.plan.filebox.order = [2, 1, 0, 3, 4]; }, f => { f.plan.filebox.order = [2, 0, 1, 3, 3]; },
    f => { f.plan.filebox.expectedMedia.imageBackupDescriptions[0] = "Changed"; }, f => { f.current.profile = null; }
  ]) { const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planScientificFiguresMigration(f.current, f.plan, f.receipts)); assert.deepEqual(f.current, before); }
});

test("scientific media ledger repeats retain later caption edits, deleted figures and reordered/deleted records", () => {
  const f = fixture(); const later = planScientificFiguresMigration(f.current, f.plan, f.receipts).data;
  later.projects.pop(); later.projects[0].imageUrls = []; later.projects[0].imageDescriptions = ["Later owner caption"];
  const repeat = planScientificFiguresMigration(later, null, null, { alreadyApplied: true });
  assert.deepEqual(repeat.data, later); assert.equal(repeat.report.alreadyApplied, true); assert.equal(repeat.report.changed, false);
});

test("scientific Redis previews/defaults are read-only with independent ledger and no upload or backup writes", async () => {
  const f = redisFixture(); for (const dryRun of [undefined, true]) {
    const result = await migrateScientificFiguresRedis({ ...f.options, dryRun });
    assert.equal(result.applied, false); assert.equal(result.snapshotHash, sha(f.raw));
    assert.equal(result.ledgerKey, f.key + ":migrations:" + SCIENTIFIC_FIGURES_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0);
  }
});

test("scientific apply atomically preserves exact originals and repeats never restore later owner media edits", async () => {
  const f = redisFixture(); const result = await migrateScientificFiguresRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw); assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data)); assert.deepEqual(mask(result.data), mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:presentation-review-2026-10-16-v1"), "Retain previous ledger");
  const later = JSON.parse(f.values.get(f.key)); later.projects.pop(); later.projects[0].imageUrls = [];
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw); const repeat = await migrateScientificFiguresRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true); assert.equal(repeat.report.changed, false);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("scientific source/candidate/deployment/backup failures cannot write Redis", async () => {
  for (const overrides of [{ expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined }, { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/scientific-test/source.json", backupReader: async () => "{}" }]) {
    const f = redisFixture(); await assert.rejects(migrateScientificFiguresRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.writes(), 0);
  }
});

test("scientific prepared backups must match every original byte, not only parsed JSON", async () => {
  const f = redisFixture(); await assert.rejects(migrateScientificFiguresRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/); assert.equal(f.writes(), 0);
  const result = await migrateScientificFiguresRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("concurrent admin edits abort scientific CAS without overwriting content or creating Redis backup", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migrateScientificFiguresRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
});

test("scientific CLI rejects ambiguous modes and missing receipts before accessing files or Redis", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateScientificFiguresRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "unread.json"], ["--plan", "unread.json", "--receipts", "unread.json", "--apply"],
    ["--plan", "unread.json", "--receipts", "unread.json", "--apply", "--input", "unread.json"],
    ["--plan", "unread.json", "--receipts", "unread.json", "--apply", "--dry-run"]]) await assert.rejects(runScientificFigures(args), /option|Supply/);
});

test("offline scientific CLI emits safe IDs/fields/hashes without source, captions, provenance or provider file IDs", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-scientific-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith("portfolio-scientific-preview-"));
    await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json"); const receipts = join(directory, "receipts.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan)); await writeFile(receipts, JSON.stringify(f.receipts));
  const result = spawnSync(process.execPath, ["scripts/migrate-scientific-figures.js", "--input", input, "--plan", plan, "--receipts", receipts, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout); assert.equal(report.applied, false);
  assert.equal(report.changes.length, 5); assert.match(report.candidateHash, /^[a-f0-9]{64}$/);
  for (const text of ["PRIVATE_PAYLOAD_SENTINEL", "PRIVATE_RAW_SENTINEL", "Approved caption", "isolated-file-", "Original course"]) assert.equal(result.stdout.includes(text), false);
});
