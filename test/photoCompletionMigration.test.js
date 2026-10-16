import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PHOTO_COMPLETION_MIGRATION_ID, PHOTO_COMPLETION_JOB_IDS, PHOTO_COMPLETION_EDUCATION_MATCH, PHOTO_COMPLETION_MEDIA_FIELDS,
  migratePhotoCompletionRedis, planPhotoCompletionMigration } from "../src/content/photoCompletionMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runPhotoCompletion } from "../scripts/migrate-photo-completion.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const media = row => Object.fromEntries(PHOTO_COMPLETION_MEDIA_FIELDS.map(field => [field, row[field]]));
const same = (row, match) => Object.entries(match).every(([key, value]) => row[key] === value);
const mask = value => { const copy = structuredClone(value);
  for (const row of copy.jobs) if (PHOTO_COMPLETION_JOB_IDS.includes(row.id)) PHOTO_COMPLETION_MEDIA_FIELDS.forEach(field => delete row[field]);
  for (const row of copy.education) if (same(row, PHOTO_COMPLETION_EDUCATION_MATCH)) PHOTO_COMPLETION_MEDIA_FIELDS.forEach(field => delete row[field]);
  return copy;
};

/** Builds all five pinned identities with rich protected content and isolated staged-photo receipts. */
function fixture() {
  const oldMedia = key => ({ imageUrls: [`/${key}-logo.gif`, `/${key}-old.png`], imageTitles: ["Original logo credit", "Original old credit"],
    imageDescriptions: ["Original logo caption", "Original old caption"], imageBackupDescriptions: ["Original logo backup", "Original old backup"] });
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", summary: "Approved research and backend narrative", location: "", cvUrl: "/original-cv.pdf" },
    research: { thesisSummary: "Simultaneous two-task shared trunk comparison; prediction is an aim", thesisMethods: ["Original method"] },
    jobs: [...PHOTO_COMPLETION_JOB_IDS.map((id, index) => ({ id, category: "industry", title: `Original role ${index}`, company: `Original company ${index}`,
      start: "2018", end: String(2000 + index), location: index < 3 ? "Original city (remote)" : "Athens, Greece", mapLocation: "Original map",
      duties: ["Original duty"], skills: ["Cloud Computing", "API Development"], ...oldMedia(`job-${index}`) })),
    { id: "unrelated-research", category: "research", title: "Original research", duties: ["Original scientific duty"], skills: ["Plasma Diagnostics"], ...oldMedia("research") }],
    education: [{ ...PHOTO_COMPLETION_EDUCATION_MATCH, location: "Remote", mapLocation: "", courses: ["Original course"], activities: ["Original activity"],
      skills: ["Node.js", "Web Development"], grade: "Original grade", ...oldMedia("education") },
    { degree: "Other original degree", institution: "Other institution", skills: ["Statistics"], ...oldMedia("other") }],
    projects: [{ id: "research-arxiv-2608-27736", name: "Original paper", category: "research", status: "preprint", description: "Original reviewed scientific caveat",
      contribution: "Original credited contribution", authors: ["Author One", "Author Two"], collaborators: ["Original collaborator"],
      collections: ["Original collection"], relatedRoleIds: ["unrelated-research"], skills: ["Statistics", "Data Analysis"], ...oldMedia("scientific-figure") }]
  });
  current.jobs.reverse(); current.education.reverse(); current.privateMetadata = "PRIVATE_RAW_SENTINEL";
  const targets = [...PHOTO_COMPLETION_JOB_IDS.map(id => ({ collection: "jobs", row: current.jobs.find(row => row.id === id) })),
    { collection: "education", row: current.education.find(row => same(row, PHOTO_COMPLETION_EDUCATION_MATCH)) }];
  const receipts = [];
  const assets = targets.map(({ collection, row }, index) => {
    const mime = index === 1 ? "image/png" : "image/jpeg"; const format = index === 1 ? "png" : "jpeg";
    const asset = { id: `context-${index}`, collection, match: Object.fromEntries((collection === "jobs" ? ["id", "category", "title", "company"] : Object.keys(PHOTO_COMPLETION_EDUCATION_MATCH)).map(key => [key, row[key]])),
      sha256: sha(`isolated-source-${index}`), bytes: 100 + index, width: 320, height: 240, mime,
      caption: "Reviewed context, full source credit and licence", backupDescription: "Concise context description",
      expectedMedia: structuredClone(media(row)), provenance: { sourcePage: "https://source.example/reviewed", rights: "Reviewed source-specific licence",
        credit: "Original source author", context: index === 4 ? "online-learning-context" : index === 3 ? "product-context" : index === 1 ? "tooling-context" : "industry-context",
        scopeNote: "Context only; no office, attendance, design ownership or individual contribution claim" } };
    const decoded = { status: 200, bytes: asset.bytes, sha256: asset.sha256, width: 320, height: 240, format, pages: 1, nonblank: true };
    const url = `https://ik.imagekit.io/Gustolandia/Portfolio-Website/Photos/context-${index}.${format === "jpeg" ? "jpg" : "png"}`;
    receipts.push({ assetId: asset.id, sourceSha256: asset.sha256, sourceBytes: asset.bytes, status: "verified", folder: "/Portfolio-Website/Photos",
      provider: { fileId: `isolated-file-${index}`, size: asset.bytes, url }, deliveryUrl: url, originalVerification: { ...decoded }, deliveryVerification: { ...decoded } });
    return asset;
  });
  return { current, plan: { version: 1, migrationId: PHOTO_COMPLETION_MIGRATION_ID, assets }, receipts };
}

/** Models existing atomic raw CAS and a separate ledger, with no network/upload access. */
function redisFixture() {
  const f = fixture(); const raw = JSON.stringify(f.current, null, 2); const key = "portfolio:photo-completion-test";
  const values = new Map([[key, raw], [key + ":migrations:scientific-figures-2026-10-16-v1", "Retain scientific ledger"]]);
  const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2; if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan: f.plan, receipts: f.receipts, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planPhotoCompletionMigration(f.current, f.plan, f.receipts).candidateHash,
    backupDirectory: "private-content/photo-completion-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { ...f, raw, key, values, backups, redis, options, writes: () => writes };
}

test("photo completion appends exactly five full tuples while every old four-array prefix and other raw/public value stays exact", () => {
  const f = fixture(); const original = structuredClone(f.current); const result = planPhotoCompletionMigration(f.current, f.plan, f.receipts);
  assert.deepEqual(f.current, original); assert.deepEqual(mask(result.data), mask(original));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(original)));
  assert.equal(result.report.changes.length, 5); assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  for (const asset of f.plan.assets) {
    const old = original[asset.collection].find(row => same(row, asset.match)); const next = result.data[asset.collection].find(row => same(row, asset.match));
    PHOTO_COMPLETION_MEDIA_FIELDS.forEach(field => assert.deepEqual(next[field].slice(0, -1), old[field]));
    assert.equal(next.imageUrls.at(-1), f.receipts.find(r => r.assetId === asset.id).provider.url + "?tr=orig-true");
    assert.equal(next.imageTitles.at(-1), asset.caption); assert.equal(next.imageDescriptions.at(-1), asset.caption); assert.equal(next.imageBackupDescriptions.at(-1), asset.backupDescription);
  }
  assert.deepEqual(result.data.jobs.map(row => row.id), original.jobs.map(row => row.id));
  assert.deepEqual(result.data.education.map(row => row.degree), original.education.map(row => row.degree));
  assert.deepEqual(result.data.projects, original.projects); assert.deepEqual(result.data.profile, original.profile); assert.deepEqual(result.data.research, original.research);
});

test("photo append preserves raw blank metadata and its existing public alias behavior without shifting tuples", () => {
  const f = fixture(); const asset = f.plan.assets[0]; const row = f.current.jobs.find(row => same(row, asset.match));
  row.imageTitles[0] = ""; row.imageDescriptions[1] = ""; row.imageBackupDescriptions[0] = ""; asset.expectedMedia = structuredClone(media(row));
  const before = normalizePortfolioData(f.current).jobs.find(row => row.id === asset.match.id);
  const result = planPhotoCompletionMigration(f.current, f.plan, f.receipts); const raw = result.data.jobs.find(row => row.id === asset.match.id);
  assert.equal(raw.imageTitles[0], ""); assert.equal(raw.imageDescriptions[1], ""); assert.equal(raw.imageBackupDescriptions[0], "");
  const after = normalizePortfolioData(result.data).jobs.find(row => row.id === asset.match.id);
  PHOTO_COMPLETION_MEDIA_FIELDS.forEach(field => assert.deepEqual(after[field].slice(0, -1), before[field]));
});

test("reviewed width-only delivery keeps full aspect and a separately verified immutable original", () => {
  const f = fixture(); f.plan.assets[3].deliveryTransform = "w-160";
  f.receipts[3].deliveryVerification = { ...f.receipts[3].deliveryVerification, width: 160, height: 120, bytes: 80, sha256: "a".repeat(64) };
  f.receipts[3].deliveryUrl += "?tr=w-160";
  const result = planPhotoCompletionMigration(f.current, f.plan, f.receipts);
  assert.equal(result.data.jobs.find(row => row.id === PHOTO_COMPLETION_JOB_IDS[3]).imageUrls.at(-1), f.receipts[3].deliveryUrl);
  assert.equal(f.receipts[3].originalVerification.sha256, f.plan.assets[3].sha256);
});

test("photo contexts cannot infer remote attendance, a historic workplace or unrelated device authorship", () => {
  for (const [index, context] of [[0, "workplace"], [1, "historic-office"], [2, "product-context"], [3, "user-designed-device"], [4, "in-person-course-cohort"]]) {
    const f = fixture(); f.plan.assets[index].provenance.context = context;
    assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts), /honest non-attendance/);
  }
  const f = fixture(); f.plan.assets[0].provenance.scopeNote = "";
  assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts), /rights\/credit/);
});

test("stale, duplicate, missing, foreign and reclassified photo targets cannot mutate records or maps", () => {
  for (const change of [
    f => { f.plan.assets.pop(); }, f => { f.plan.assets[1] = structuredClone(f.plan.assets[0]); },
    f => { f.plan.assets[0].collection = "projects"; }, f => { f.plan.assets[0].match.id = "unrelated-research"; },
    f => { f.plan.assets[0].match.category = "research"; }, f => { f.plan.assets[0].match.company = "Wrong employer"; },
    f => { f.plan.assets[4].match.start = "2021-04-01"; }, f => { f.plan.assets[4].match.degree = "Other original degree"; },
    f => { f.current.jobs.push(structuredClone(f.current.jobs.find(row => row.id === PHOTO_COMPLETION_JOB_IDS[0]))); },
    f => { f.current.education.push(structuredClone(f.current.education.find(row => same(row, PHOTO_COMPLETION_EDUCATION_MATCH)))); },
    f => { f.current.jobs = f.current.jobs.filter(row => row.id !== PHOTO_COMPLETION_JOB_IDS[0]); },
    f => { f.plan.mapUpdates = []; }, f => { f.plan.assets[0].values = { mapLocation: "Invented office" }; },
    f => { f.plan.assets[0].expectedMedia.imageTitles[0] = "Changed old title"; },
    f => { f.current.jobs.find(row => row.id === PHOTO_COMPLETION_JOB_IDS[0]).imageTitles.pop(); },
    f => { f.current.profile = null; }
  ]) { const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts)); assert.deepEqual(f.current, before); }
});

test("unsafe sources, malformed receipts, wrong Photos accounts and duplicate existing canonical URLs fail", () => {
  for (const change of [
    f => { f.plan.assets[0].mime = "image/svg+xml"; }, f => { f.plan.assets[0].sha256 = "wrong"; }, f => { f.plan.assets[0].bytes = 0; },
    f => { f.plan.assets[0].caption = ""; }, f => { f.plan.assets[0].backupDescription = null; },
    f => { f.receipts.pop(); }, f => { f.receipts[0] = null; }, f => { f.receipts[1] = structuredClone(f.receipts[0]); },
    f => { f.receipts[0].status = "upload-outcome-uncertain"; }, f => { f.receipts[0].sourceBytes += 1; },
    f => { f.receipts[0].originalVerification.sha256 = "0".repeat(64); }, f => { f.receipts[0].originalVerification.pages = 2; },
    f => { f.receipts[0].originalVerification.format = "webp"; }, f => { f.receipts[0].originalVerification.nonblank = false; },
    f => { f.receipts[0].provider.fileId = {}; }, f => { f.receipts[0].folder = "/Portfolio-Website/Snippets"; },
    f => { f.receipts[0].provider.url = "https://unapproved.example/context.jpg"; }, f => { f.receipts[0].provider.url += "?tr=c-force"; },
    f => { f.receipts[0].provider.url = f.current.jobs.find(row => row.id === PHOTO_COMPLETION_JOB_IDS[1]).imageUrls[1]; },
    f => { f.current.projects[0].imageUrls.push(f.receipts[0].provider.url + "?tr=w-1000"); }
  ]) { const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts)); assert.deepEqual(f.current, before); }
});

test("unapproved crop/format/colour/upscale transforms, changed delivery URLs and distorted aspect are rejected", () => {
  for (const transform of ["w-500", "w-0", "w-160,h-60", "w-160,c-force", "w-160,f-png", "bg-ffffff", " w-160", "w-16000"]) {
    const f = fixture(); f.plan.assets[3].deliveryTransform = transform;
    assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts));
  }
  for (const change of [r => { r.deliveryVerification.height = 60; }, r => { r.deliveryUrl += ",c-force"; }, r => { r.deliveryVerification.width = 159; }]) {
    const f = fixture(); f.plan.assets[3].deliveryTransform = "w-160"; f.receipts[3].deliveryVerification.width = 160; f.receipts[3].deliveryVerification.height = 120;
    f.receipts[3].deliveryUrl += "?tr=w-160"; change(f.receipts[3]); assert.throws(() => planPhotoCompletionMigration(f.current, f.plan, f.receipts));
  }
});

test("completed photo ledger repeats retain later owner edits, removed photos and deleted records", () => {
  const f = fixture(); const later = planPhotoCompletionMigration(f.current, f.plan, f.receipts).data;
  later.jobs.pop(); later.education.pop(); later.jobs[0].imageUrls = []; later.jobs[0].imageDescriptions = ["Later owner caption"];
  const repeat = planPhotoCompletionMigration(later, null, null, { alreadyApplied: true });
  assert.deepEqual(repeat.data, later); assert.equal(repeat.report.changed, false); assert.equal(repeat.report.alreadyApplied, true);
});

test("photo Redis previews/defaults are read-only and use their own independent ledger without backup writes", async () => {
  const f = redisFixture(); for (const dryRun of [undefined, true]) {
    const result = await migratePhotoCompletionRedis({ ...f.options, dryRun }); assert.equal(result.applied, false); assert.equal(result.snapshotHash, sha(f.raw));
    assert.equal(result.ledgerKey, f.key + ":migrations:" + PHOTO_COMPLETION_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0);
  }
});

test("photo apply atomically preserves exact originals and repeats never restore later owner changes", async () => {
  const f = redisFixture(); const result = await migratePhotoCompletionRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw); assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data)); assert.deepEqual(mask(result.data), mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:scientific-figures-2026-10-16-v1"), "Retain scientific ledger");
  const later = JSON.parse(f.values.get(f.key)); later.jobs.pop(); later.education.pop(); later.jobs[0].imageUrls = [];
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw); const repeat = await migratePhotoCompletionRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true); assert.equal(repeat.report.changed, false);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("photo source/candidate/deployment/backup failures cannot write Redis", async () => {
  for (const overrides of [{ expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined }, { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/photo-completion-test/source.json", backupReader: async () => "{}" }]) {
    const f = redisFixture(); await assert.rejects(migratePhotoCompletionRedis({ ...f.options, ...overrides })); assert.equal(f.values.get(f.key), f.raw); assert.equal(f.writes(), 0);
  }
});

test("photo prepared backups require every exact source byte, not only parsed equality", async () => {
  const f = redisFixture(); await assert.rejects(migratePhotoCompletionRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/); assert.equal(f.writes(), 0);
  const result = await migratePhotoCompletionRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("a concurrent admin edit aborts photo CAS without overwrite or Redis backup creation", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migratePhotoCompletionRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
});

test("photo CLI rejects ambiguous write modes and missing receipts before accessing files or Redis", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migratePhotoCompletionRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "unread.json"],
    ["--plan", "unread.json", "--receipts", "unread.json", "--apply"], ["--plan", "unread.json", "--receipts", "unread.json", "--apply", "--input", "unread.json"],
    ["--plan", "unread.json", "--receipts", "unread.json", "--apply", "--dry-run"]]) await assert.rejects(runPhotoCompletion(args), /option|Supply/);
});

test("offline photo CLI emits safe fields/counts/hashes, not source, captions, private provenance or success IDs", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-photo-completion-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith("portfolio-photo-completion-preview-"));
    await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json"); const receipts = join(directory, "receipts.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan)); await writeFile(receipts, JSON.stringify(f.receipts));
  const result = spawnSync(process.execPath, ["scripts/migrate-photo-completion.js", "--input", input, "--plan", plan, "--receipts", receipts, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout); assert.equal(report.applied, false); assert.equal(report.changes.length, 5);
  assert.match(report.candidateHash, /^[a-f0-9]{64}$/);
  for (const text of ["PRIVATE_PAYLOAD_SENTINEL", "PRIVATE_RAW_SENTINEL", "Reviewed context", "source.example", "isolated-file-"]) assert.equal(result.stdout.includes(text), false);
});
