import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { WORKPLACE_CONTENT_MIGRATION_ID, migrateWorkplaceContentRedis, planWorkplaceContentMigration } from "../src/content/workplaceContentMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const cdn = "https://ik.imagekit.io/Gustolandia/Portfolio-Website/Photos/";
const fields = ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"];

function fixture() {
  const current = normalizePortfolioData({
    jobs: [{ title: "Research Intern", company: "Lab", location: "Nancy, France", start: "2020", end: "2021", mapLocation: "Old campus",
      imageUrls: [cdn + "old.png"], imageTitles: ["Original title"], imageDescriptions: ["Original description"], imageBackupDescriptions: ["Original backup"], skills: ["Python"], duties: ["Reviewed duty"] },
    { title: "Engineer", company: "Remote company", location: "Dublin, Ireland (remote)", start: "2019", end: "2020" }],
    education: [{ degree: "Physics", institution: "University", start: "2010", end: "2014", location: "Porto, Portugal", imageUrls: [cdn + "campus.png"] }],
    projects: [{ name: "Manuscript", category: "research", status: "in-preparation", outputType: "manuscript", authors: ["First", "Second"], skills: ["Python"], links: ["https://example.org/paper"] }]
  });
  current.futureField = { preserved: true };
  current.jobs[0].futureRoleField = { preserved: true };
  current.projects[0].relatedRoleIds = [current.jobs[0].id];
  const match = Object.fromEntries(["degree", "institution", "start", "end"].map((key) => [key, current.education[0][key]]));
  const source = { kind: "existing-portfolio", sourcePage: "https://example.org/owned-photo", rights: "Existing authorised portfolio photo" };
  const plan = { version: 1, migrationId: WORKPLACE_CONTENT_MIGRATION_ID,
    mapUpdates: [
      { collection: "jobs", id: current.jobs[0].id, expectedMapLocation: "Old campus", mapLocation: "Historical science campus, Nancy", scope: "campus", evidence: ["Period institutional address"] },
      { collection: "jobs", id: current.jobs[1].id, expectedMapLocation: "", mapLocation: "Dublin, Ireland", scope: "organisation-city", evidence: ["Existing explicit remote location"] }
    ], photoAppends: [
      { collection: "jobs", id: current.jobs[0].id, expectedImageUrls: current.jobs[0].imageUrls,
        tuple: { url: cdn + "campus.png", title: "Campus interior", description: "Existing campus interior, not a claim about the exact lab room", backupDescription: "Campus interior" }, source },
      { collection: "education", match, expectedImageUrls: current.education[0].imageUrls,
        tuple: { url: cdn + "new.png", title: "Exterior", description: "Licensed campus exterior", backupDescription: "Campus exterior" },
        source: { kind: "staged-upload", assetId: "new", sha256: sha("photo"), sourcePage: "https://example.org/licensed", rights: "CC BY-SA 4.0" } }
    ] };
  const receipts = [{ assetId: "new", status: "verified", sourceSha256: sha("photo"), deliveryUrl: cdn + "new.png", provider: { fileId: "new-file" },
    originalVerification: { sha256: sha("photo"), status: 200, nonblank: true }, deliveryVerification: { status: 200, nonblank: true } }];
  return { current, plan, receipts };
}

test("workplace preview changes only reviewed map strings and appends aligned tuples in order", () => {
  const f = fixture();
  const original = structuredClone(f.current);
  const result = planWorkplaceContentMigration(f.current, f.plan, f.receipts);
  assert.deepEqual(f.current, original);
  const expected = structuredClone(original);
  expected.jobs[0].mapLocation = f.plan.mapUpdates[0].mapLocation;
  expected.jobs[1].mapLocation = "Dublin, Ireland";
  for (const [entry, append] of [[expected.jobs[0], f.plan.photoAppends[0]], [expected.education[0], f.plan.photoAppends[1]]]) {
    entry.imageUrls.push(append.tuple.url); entry.imageTitles.push(append.tuple.title);
    entry.imageDescriptions.push(append.tuple.description); entry.imageBackupDescriptions.push(append.tuple.backupDescription);
  }
  assert.deepEqual(result.data, expected);
  assert.equal(result.candidateHash, sha(JSON.stringify(expected)));
  assert.equal(result.report.maps.length, 2);
  assert.equal(result.report.photos.length, 2);
  for (const field of fields) assert.equal(result.data.jobs[0][field][0], original.jobs[0][field][0]);
});

test("workplace edits never persist legacy IDs or change facts, skills, papers, profile, dates or ordering", () => {
  const f = fixture();
  delete f.current.jobs[0].id;
  const { data } = planWorkplaceContentMigration(f.current, f.plan, f.receipts);
  assert.equal(Object.hasOwn(data.jobs[0], "id"), false);
  assert.deepEqual(normalizePortfolioData(data).jobs.map(v => v.id), normalizePortfolioData(f.current).jobs.map(v => v.id));
  assert.deepEqual(data.projects, f.current.projects);
  assert.deepEqual(data.profile, f.current.profile);
  assert.deepEqual(data.research, f.current.research);
  assert.deepEqual(data.pages, f.current.pages);
  assert.deepEqual(data.jobs[0].duties, f.current.jobs[0].duties);
  assert.deepEqual(data.jobs[0].skills, f.current.jobs[0].skills);
  assert.deepEqual(data.jobs[0].futureRoleField, f.current.jobs[0].futureRoleField);
});

test("workplace appends preserve exact raw metadata prefixes including explicit empty strings", () => {
  const f = fixture();
  f.current.jobs[0].imageTitles[0] = "";
  f.current.jobs[0].imageBackupDescriptions[0] = "";
  f.current.jobs[0].imageDescriptions[0] = "Existing description must not replace the empty title";
  const { data } = planWorkplaceContentMigration(f.current, f.plan, f.receipts);
  for (const field of fields) assert.equal(data.jobs[0][field][0], f.current.jobs[0][field][0]);
  assert.equal(data.jobs[0].imageDescriptions[1], f.plan.photoAppends[0].tuple.description);
});

test("workplace appends pad missing legacy metadata without shifting URLs and reject surplus entries", () => {
  const f = fixture();
  delete f.current.jobs[0].imageTitles;
  delete f.current.jobs[0].imageBackupDescriptions;
  const { data } = planWorkplaceContentMigration(f.current, f.plan, f.receipts);
  assert.deepEqual(data.jobs[0].imageUrls.slice(0, 1), f.current.jobs[0].imageUrls);
  assert.equal(data.jobs[0].imageTitles[0], f.current.jobs[0].imageDescriptions[0]);
  assert.equal(data.jobs[0].imageBackupDescriptions[0], "");
  f.current.jobs[0].imageDescriptions.push("Unpaired caption");
  assert.throws(() => planWorkplaceContentMigration(f.current, f.plan, f.receipts), /extends beyond/);
});

test("explicit remote roles accept only their existing organisation-city context", () => {
  for (const change of [
    (op) => { op.scope = "workplace"; },
    (op) => { op.mapLocation = "Invented office, Dublin"; },
    (op) => { op.mapLocation = "Manchester, UK"; }
  ]) {
    const f = fixture(); change(f.plan.mapUpdates[1]);
    assert.throws(() => planWorkplaceContentMigration(f.current, f.plan, f.receipts), /Remote entries/);
  }
});

test("wholly remote education without a verified city stays unmapped", () => {
  const f = fixture();
  f.current.education[0].location = "Remote";
  f.plan.mapUpdates.push({ collection: "education", match: f.plan.photoAppends[1].match, expectedMapLocation: "", mapLocation: "Rome, Italy", scope: "organisation-city", evidence: ["Arbitrary headquarters"] });
  assert.throws(() => planWorkplaceContentMigration(f.current, f.plan, f.receipts), /Remote entries/);
  f.plan.mapUpdates.pop();
  assert.equal(planWorkplaceContentMigration(f.current, f.plan, f.receipts).data.education[0].mapLocation, "");
});

test("stale maps, photo order, duplicate appends and ambiguous targets fail without mutating source", () => {
  for (const change of [
    (f) => { f.plan.mapUpdates[0].expectedMapLocation = "Stale"; },
    (f) => { f.plan.photoAppends[0].expectedImageUrls = []; },
    (f) => { f.plan.mapUpdates.push(f.plan.mapUpdates[0]); },
    (f) => { f.plan.photoAppends.push(f.plan.photoAppends[0]); },
    (f) => { f.current.education.push(structuredClone(f.current.education[0])); }
  ]) {
    const f = fixture(); change(f);
    const original = structuredClone(f.current);
    assert.throws(() => planWorkplaceContentMigration(f.current, f.plan, f.receipts), /Stale|order|duplicate|ambiguous/);
    assert.deepEqual(f.current, original);
  }
});

test("workplace plans reject out-of-scope targets, unknown reuse and unverified new uploads", () => {
  for (const change of [
    (f) => { f.plan.mapUpdates[0].collection = "projects"; },
    (f) => { f.plan.photoAppends[0].tuple.url = cdn + "unlisted.png"; },
    (f) => { f.plan.photoAppends[0].tuple.url = "https://elsewhere.example/photo.jpg"; },
    (f) => { f.plan.photoAppends[0].tuple.extra = "not allowed"; },
    (f) => { f.receipts[0].originalVerification.sha256 = "0".repeat(64); },
    (f) => { f.receipts = []; },
    (f) => { f.plan.photoAppends[1].source.rights = ""; }
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => planWorkplaceContentMigration(f.current, f.plan, f.receipts), /limited|original portfolio|owned URL|verified/);
  }
});

function redisFixture() {
  const f = fixture();
  const key = "portfolio:test";
  const values = new Map([[key, JSON.stringify(f.current)], [`${key}:migrations:earlier`, "preserved"]]);
  const backups = [];
  let writes = 0;
  const redis = { get: async (target) => values.get(target) ?? null,
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
      if (values.has(keys[1])) return 2;
      if (values.get(keys[0]) !== args[0]) return 0;
      writes++; values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); return 1;
    } };
  const options = { redis, key, plan: f.plan, receipts: f.receipts, dryRun: false, expectedHash: sha(values.get(key)),
    expectedCandidateHash: planWorkplaceContentMigration(f.current, f.plan, f.receipts).candidateHash,
    backupDirectory: "private-content/test-workplace", backupWriter: async (path, raw) => backups.push(raw), verifyDeployment: async () => {} };
  return { ...f, key, values, redis, options, backups, writes: () => writes };
}

test("workplace Redis preview defaults to read-only with a distinct ledger", async () => {
  const f = redisFixture();
  const result = await migrateWorkplaceContentRedis({ ...f.options, dryRun: undefined });
  assert.equal(result.applied, false);
  assert.equal(result.ledgerKey, `${f.key}:migrations:${WORKPLACE_CONTENT_MIGRATION_ID}`);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.backups, []);
});

test("guarded workplace application backs up full raw content and repeat never restores later edits", async () => {
  const f = redisFixture();
  const before = f.values.get(f.key);
  const result = await migrateWorkplaceContentRedis(f.options);
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), before);
  assert.deepEqual(f.backups, [before]);
  assert.equal(f.values.get(`${f.key}:migrations:earlier`), "preserved");
  const later = JSON.parse(f.values.get(f.key)); later.jobs = [];
  f.values.set(f.key, JSON.stringify(later));
  const repeat = await migrateWorkplaceContentRedis(f.options);
  assert.equal(repeat.applied, false);
  assert.deepEqual(repeat.data, later);
  assert.equal(f.writes(), 1);
});

test("workplace application refuses unreviewed hashes, incomplete backups and concurrent edits", async () => {
  const f = redisFixture();
  await assert.rejects(migrateWorkplaceContentRedis({ ...f.options, expectedCandidateHash: undefined }), /candidate SHA/);
  await assert.rejects(migrateWorkplaceContentRedis({ ...f.options, expectedCandidateHash: "0".repeat(64) }), /candidate differs/);
  await assert.rejects(migrateWorkplaceContentRedis({ ...f.options, expectedHash: "0".repeat(64) }), /fresh dry run/);
  await assert.rejects(migrateWorkplaceContentRedis({ ...f.options, backupFile: "private-content/invalid.json", backupReader: async () => "{}" }), /exact raw/);
  await assert.rejects(migrateWorkplaceContentRedis({ ...f.options, verifyDeployment: async () => {
    f.values.set(f.key, JSON.stringify({ ...f.current, concurrentEdit: true }));
  } }), /admin changed/);
  assert.equal(f.writes(), 0);
});

test("workplace apply refuses ambiguous boolean modes before Redis access", async () => {
  for (const dryRun of [null, 0, "false"]) {
    await assert.rejects(migrateWorkplaceContentRedis({ dryRun, redis: { get: () => assert.fail("No access") } }), /boolean/);
  }
});
