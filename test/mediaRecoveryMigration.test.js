import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { MEDIA_RECOVERY_MIGRATION_ID, migrateMediaRecoveryRedis, planMediaRecoveryMigration } from "../src/content/mediaRecoveryMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const fields = ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"];

function fixture() {
  const current = normalizePortfolioData({
    jobs: [{ title: "Research role", company: "Institute", start: "2020", end: "2021", skills: ["Python"],
      duties: ["Reviewed duties"], imageUrls: ["https://old.example/0", "https://old.example/1", "https://ik.imagekit.io/Gustolandia/old-working.png", "https://old.example/3"],
      imageTitles: ["title0", "title1", "title2", "title3"], imageDescriptions: ["description0", "description1", "description2", "description3"],
      imageBackupDescriptions: ["backup0", "backup1", "backup2", "backup3"] }],
    education: [{ degree: "Physics", institution: "University", start: "2010", end: "2014", imageUrls: ["https://old.example/campus"] }],
    projects: [{ name: "Reviewed manuscript", dateOfCompletion: "2025", category: "research", status: "in-preparation", outputType: "manuscript",
      authors: ["First author", "Second author"], links: ["https://example.org/paper"], linksDescriptions: ["Paper"], skills: ["Python"] }]
  });
  current.projects[0].relatedRoleIds = [current.jobs[0].id];
  current.futureField = { retained: true };
  current.jobs[0].futureJobField = { retained: true };
  const urls = [...current.jobs[0].imageUrls];
  const operation = (kind, index) => ({ operation: kind, collection: "jobs", id: current.jobs[0].id, expectedExistingUrls: urls,
    ...(index === undefined ? {} : { originalIndex: index, expectedUrl: urls[index] }) });
  const assets = [
    ["replace-first", [operation("replace", 0)]],
    ["replace-last", [operation("replace", 3)]],
    ["append", [operation("append")]],
    ["portrait", [{ operation: "set", collection: "profile", field: "portraitUrl", expectedValue: "" }]]
  ].map(([id, operations]) => ({ id, sha256: sha(id), bytes: 10, width: 20, height: 10, mime: "image/png", target: "photos",
    caption: `Description ${id}`, backupDescription: `Backup ${id}`, operations }));
  const receipts = assets.map((asset) => ({ assetId: asset.id, status: "verified", sourceSha256: asset.sha256,
    folder: "/Portfolio-Website/Photos", provider: { fileId: asset.id, size: asset.bytes,
      url: `https://ik.imagekit.io/Gustolandia/Portfolio-Website/Photos/${asset.id}.png` },
    deliveryUrl: `https://ik.imagekit.io/Gustolandia/Portfolio-Website/Photos/${asset.id}.png`,
    originalVerification: { status: 200, bytes: asset.bytes, width: asset.width, height: asset.height, sha256: asset.sha256, pages: 1, nonblank: true },
    deliveryVerification: { status: 200, width: 20, height: 10, nonblank: true, pages: 1 } }));
  const manifest = { version: 2, batchId: MEDIA_RECOVERY_MIGRATION_ID, approvedDestination: "/Portfolio-Website", assets,
    retirements: [{ collection: "jobs", id: current.jobs[0].id, originalIndex: 1, expectedUrl: urls[1], reason: "Unavailable original" }] };
  return { current, manifest, receipts };
}

test("media preview changes only approved tuples/portrait, preserves original indexes and archives removals", () => {
  const f = fixture();
  const before = structuredClone(f.current);
  const result = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  assert.deepEqual(f.current, before);
  const expected = structuredClone(before);
  const rows = [0, 2, 1, 2].map((source, index) => index === 1
    ? Object.fromEntries(fields.map((field) => [field, before.jobs[0][field][2]]))
    : { imageUrls: f.receipts[source].deliveryUrl, imageTitles: f.manifest.assets[source].caption,
      imageDescriptions: f.manifest.assets[source].caption, imageBackupDescriptions: f.manifest.assets[source].backupDescription });
  for (const field of fields) expected.jobs[0][field] = rows.map((row) => row[field]);
  expected.profile.portraitUrl = f.receipts[3].deliveryUrl;
  assert.deepEqual(result.data, expected);
  assert.equal(result.candidateHash, sha(JSON.stringify(expected)));
  assert.deepEqual(result.report.archived[0].originalTuple, Object.fromEntries(fields.map((field) => [field, before.jobs[0][field][1]])));
  assert.equal(result.report.updates.length, 4);
  assert.equal(result.report.archived.length, 1);
});

test("media edits retain legacy computed IDs without persisting them and preserve academic relationships", () => {
  const f = fixture();
  delete f.current.jobs[0].id;
  const before = normalizePortfolioData(f.current);
  const { data } = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  assert.equal(Object.hasOwn(data.jobs[0], "id"), false);
  const after = normalizePortfolioData(data);
  assert.equal(after.jobs[0].id, before.jobs[0].id);
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.education, before.education);
  assert.deepEqual(after.research, before.research);
  assert.deepEqual(after.jobs[0].skills, before.jobs[0].skills);
  assert.deepEqual(after.jobs[0].duties, before.jobs[0].duties);
});

test("media preview preserves explicitly empty captions and backup descriptions", () => {
  const f = fixture();
  f.manifest.assets[0].caption = "";
  f.manifest.assets[0].backupDescription = "";
  const { data } = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  assert.equal(data.jobs[0].imageTitles[0], "");
  assert.equal(data.jobs[0].imageDescriptions[0], "");
  assert.equal(data.jobs[0].imageBackupDescriptions[0], "");
});

test("media preview matches education by all four identity fields and rejects ambiguous matches", () => {
  const f = fixture();
  const match = Object.fromEntries(["degree", "institution", "start", "end"].map((key) => [key, f.current.education[0][key]]));
  f.manifest.assets[0].operations = [{ operation: "replace", collection: "education", match, originalIndex: 0,
    expectedExistingUrls: f.current.education[0].imageUrls, expectedUrl: f.current.education[0].imageUrls[0] }];
  assert.equal(planMediaRecoveryMigration(f.current, f.manifest, f.receipts).data.education[0].imageUrls[0], f.receipts[0].deliveryUrl);
  f.current.education.push(structuredClone(f.current.education[0]));
  assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /ambiguous/);
});

test("media preview rejects stale source indexes/arrays, protected ImageKit URLs and conflicting removals", () => {
  const changes = [
    (f) => { f.manifest.assets[0].operations[0].expectedExistingUrls = []; },
    (f) => { f.manifest.assets[0].operations[0].originalIndex = 3; },
    (f) => { f.manifest.retirements[0].originalIndex = 0; f.manifest.retirements[0].expectedUrl = f.current.jobs[0].imageUrls[0]; },
    (f) => { f.manifest.retirements[0].originalIndex = 2; f.manifest.retirements[0].expectedUrl = f.current.jobs[0].imageUrls[2]; },
    (f) => { f.manifest.assets[0].operations[0].id = "missing"; }
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    const original = structuredClone(f.current);
    assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /reviewed|Conflicting|ImageKit|ambiguous/);
    assert.deepEqual(f.current, original);
  }
});

test("media preview requires complete verified receipts and forbids out-of-scope scalar changes", () => {
  const changes = [
    (f) => { f.receipts.pop(); },
    (f) => { f.receipts[0].originalVerification.sha256 = "0".repeat(64); },
    (f) => { f.receipts[0].deliveryUrl = "https://wrong.example/image.png"; },
    (f) => { f.receipts[0].provider.url = "https://wrong.example/image.png"; },
    (f) => { f.manifest.assets[3].operations[0].field = "summary"; },
    (f) => { f.manifest.assets[0].operations[0].collection = "research"; }
  ];
  for (const change of changes) {
    const f = fixture(); change(f);
    assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /receipt|verified|URL|scalar|collection/);
  }
});

test("project image updates preserve bylines, publication state, link tuples and role references", () => {
  const f = fixture();
  f.manifest.assets[0].operations = [{ operation: "append", collection: "projects", id: f.current.projects[0].id, expectedExistingUrls: [] }];
  const { data } = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  const project = structuredClone(f.current.projects[0]);
  project.imageUrls = [f.receipts[0].deliveryUrl];
  project.imageTitles = project.imageDescriptions = [f.manifest.assets[0].caption];
  project.imageBackupDescriptions = [f.manifest.assets[0].backupDescription];
  assert.deepEqual(data.projects[0], project);
});

test("a separately approved fixed page image changes neither its copy nor the profile", () => {
  const f = fixture();
  f.current.pages.home.title = "Home";
  f.current.pages.home.description = "Reviewed page copy";
  f.manifest.assets[3].operations = [{ operation: "set", collection: "pages", page: "home", field: "imageUrl", expectedValue: "" }];
  const { data } = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  assert.deepEqual(data.pages.home, { ...f.current.pages.home, imageUrl: f.receipts[3].deliveryUrl });
  assert.deepEqual(data.profile, f.current.profile);
  f.manifest.assets[3].operations[0].page = "unexpected";
  assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /scalar/);
});

test("media preview rejects a delivery receipt that loses GIF frames", () => {
  const f = fixture();
  f.receipts[0].originalVerification.pages = 65;
  f.receipts[0].deliveryVerification.pages = 1;
  assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /lost frames/);
});

test("delivery transformations cannot bypass media animation frame verification", () => {
  const f = fixture();
  f.manifest.assets[0].deliveryTransform = "w-1600";
  f.receipts[0].deliveryUrl += "?tr=w-1600";
  f.receipts[0].originalVerification.pages = 65;
  f.receipts[0].deliveryVerification.pages = 1;
  assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /lost frames/);
});

test("untouched and archived media preserve explicitly empty original metadata", () => {
  const f = fixture();
  f.current.jobs[0].imageTitles[2] = "";
  f.current.jobs[0].imageDescriptions[2] = "Original descriptive caption";
  f.current.jobs[0].imageTitles[1] = "";
  f.current.jobs[0].imageBackupDescriptions[1] = "";
  const { data, report } = planMediaRecoveryMigration(f.current, f.manifest, f.receipts);
  assert.equal(data.jobs[0].imageTitles[1], "");
  assert.equal(data.jobs[0].imageDescriptions[1], "Original descriptive caption");
  assert.equal(report.archived[0].originalTuple.imageTitles, "");
  assert.equal(report.archived[0].originalTuple.imageBackupDescriptions, "");
  assert.equal(report.archived[0].originalTuple.imageDescriptions, f.current.jobs[0].imageDescriptions[1]);
});

test("media preview rejects surplus metadata without a corresponding URL", () => {
  const f = fixture();
  f.current.jobs[0].imageDescriptions.push("Unpaired caption");
  assert.throws(() => planMediaRecoveryMigration(f.current, f.manifest, f.receipts), /extends beyond/);
});

function redisFixture() {
  const f = fixture();
  const key = "portfolio:test";
  const values = new Map([[key, JSON.stringify(f.current)], [`${key}:migrations:earlier`, "preserved"]]);
  let writes = 0;
  const backups = [];
  const redis = { get: async (name) => values.get(name) ?? null,
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
      if (values.has(keys[1])) return 2;
      if (values.get(keys[0]) !== args[0]) return 0;
      writes++;
      values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]);
      return 1;
    } };
  const options = { redis, key, manifest: f.manifest, receipts: f.receipts, dryRun: false,
    expectedHash: sha(values.get(key)), expectedCandidateHash: planMediaRecoveryMigration(f.current, f.manifest, f.receipts).candidateHash,
    backupDirectory: "private-content/test-media", verifyDeployment: async () => {}, backupWriter: async (path, raw) => backups.push(raw) };
  return { ...f, key, values, redis, options, backups, writes: () => writes };
}

test("media Redis preview is read-only and uses a separate ledger", async () => {
  const f = redisFixture();
  const result = await migrateMediaRecoveryRedis({ ...f.options, dryRun: true });
  assert.equal(result.applied, false);
  assert.equal(result.ledgerKey, `${f.key}:migrations:${MEDIA_RECOVERY_MIGRATION_ID}`);
  assert.equal(result.snapshotHash, sha(f.values.get(f.key)));
  assert.equal(f.writes(), 0);
  assert.equal(f.backups.length, 0);
});

test("media Redis apply backs up exact raw bytes and repeats never restore later admin edits", async () => {
  const f = redisFixture();
  const original = f.values.get(f.key);
  const result = await migrateMediaRecoveryRedis(f.options);
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), original);
  assert.deepEqual(f.backups, [original]);
  assert.equal(f.values.get(`${f.key}:migrations:earlier`), "preserved");
  const edited = JSON.parse(f.values.get(f.key));
  edited.jobs = [];
  f.values.set(f.key, JSON.stringify(edited));
  const repeat = await migrateMediaRecoveryRedis(f.options);
  assert.equal(repeat.applied, false);
  assert.deepEqual(repeat.data, edited);
  assert.equal(f.writes(), 1);
});

test("media apply rejects stale hashes, incomplete backups and concurrent edits before writes", async () => {
  const f = redisFixture();
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, expectedCandidateHash: undefined }), /candidate SHA/);
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, expectedCandidateHash: "0".repeat(64) }), /candidate differs/);
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, expectedHash: "0".repeat(64) }), /fresh dry run/);
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, backupFile: "ignored.json", backupReader: async () => "{}" }), /exact raw/);
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, verifyDeployment: async () => {
    f.values.set(f.key, JSON.stringify({ ...f.current, concurrent: true }));
  } }), /admin changed/);
  assert.equal(f.writes(), 0);
});

test("prepared media backups must match raw bytes, not merely equivalent parsed JSON", async () => {
  const f = redisFixture();
  const formatted = JSON.stringify(f.current, null, 2);
  assert.deepEqual(JSON.parse(formatted), f.current);
  await assert.rejects(migrateMediaRecoveryRedis({ ...f.options, backupFile: "ignored.json", backupReader: async () => formatted }), /exact raw/);
  assert.equal(f.writes(), 0);
  const raw = f.values.get(f.key);
  const result = await migrateMediaRecoveryRedis({ ...f.options, backupFile: "ignored.json", backupReader: async () => raw });
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), raw);
});

test("media migration rejects ambiguous apply modes before Redis access", async () => {
  for (const dryRun of ["false", null, 0]) {
    await assert.rejects(migrateMediaRecoveryRedis({ dryRun, redis: { get: () => assert.fail("No Redis access") } }), /boolean/);
  }
});
