import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { test } from "node:test";
import {
  LINKEDIN_CONTENT_MIGRATION_ID, LINKEDIN_JOB_ADDITIONS,
  LINKEDIN_JOB_CORRECTIONS, LINKEDIN_PAGE_DESCRIPTIONS,
  migrateLinkedInContentRedis, planLinkedInContentMigration
} from "../src/content/linkedInContentMigration.js";
import { migratePortfolioContentRedis } from "../src/content/portfolioContentRedisMigration.js";
import { JOB_FIELDS, normalizePortfolioData, normalizeRichArray } from "../src/validation/portfolioData.js";
import { normalizeSkills } from "../src/content/skillAliases.js";
import { runLinkedInContentMigration } from "../scripts/migrate-linkedin-content.js";

async function fixture() {
  const data = JSON.parse(await readFile(new URL("../data/portfolio.json", import.meta.url), "utf8"));
  data.jobs.find((job) => job.company.includes("Stuttgart")).title = "Student Job";
  data.education.unshift({
    degree: "Masters in Statistics and Data Science", institution: "Trinity College, Dublin",
    start: "2024-09-01", end: "2027-10-01", grade: "", status: "",
    skills: ["Unknown retained skill"], courses: ["Existing course"],
    imageUrls: ["/tcd.jpg"], imageDescriptions: ["User image"], imageBackupDescriptions: ["User fallback"]
  });
  data.profile.location = "";
  data.futureMetadata = { retained: true };
  data.jobs[0].futureJobField = { retained: true };
  return data;
}

function redisFixture(data) {
  const key = "portfolio:test";
  const oldLedgerKey = `${key}:migrations:research-content-2026-10-15-v1`;
  const values = new Map([[key, JSON.stringify(data)], [oldLedgerKey, "existing research ledger"]]);
  const backups = [];
  const writes = [];
  const reads = [];
  const redis = {
    get: async (target) => { reads.push(target); return values.get(target) ?? null; },
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
      if (values.has(keys[1])) return 2;
      if (values.get(keys[0]) !== args[0]) return 0;
      values.set(keys[2], args[0]);
      values.set(keys[0], args[1]);
      values.set(keys[1], args[2]);
      writes.push({ keys, args });
      return 1;
    }
  };
  return {
    key, oldLedgerKey, values, reads, backups, writes, redis,
    options: () => ({ redis, key, dryRun: false,
      expectedHash: createHash("sha256").update(values.get(key)).digest("hex"),
      backupDirectory: "private-content/test-linkedin", verifyDeployment: async () => {},
      backupWriter: async (path, raw) => backups.push({ path, raw }) })
  };
}

test("LinkedIn preview adds exactly four industry jobs with canonical skills and no invented media", async () => {
  const current = await fixture();
  const original = structuredClone(current);
  const { data, report } = planLinkedInContentMigration(current);
  assert.deepEqual(current, original);
  assert.deepEqual(report.counts, { before: { jobs: 13, education: 7, projects: 15 }, after: { jobs: 17, education: 7, projects: 15 } });
  assert.equal(report.added.length, 4);
  assert.equal(new Set(report.added.map((job) => job.id)).size, 4);
  for (const seed of LINKEDIN_JOB_ADDITIONS) {
    const job = data.jobs.find((entry) => entry.id === seed.id);
    assert.equal(job.category, "industry");
    assert.deepEqual(job.skills, normalizeSkills(seed.skills));
    assert.deepEqual(job.duties, seed.duties);
    for (const field of ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"]) assert.deepEqual(job[field], []);
    assert.equal(job.mapLocation, "");
    assert.equal(Object.hasOwn(job, "duration"), false);
  }
  assert.equal(data.jobs[0].company, "BoscaSports");
  assert.equal(data.jobs[0].end, "Present");
  const invertase = data.jobs.find((job) => job.company.startsWith("Invertase"));
  const xerotech = data.jobs.find((job) => job.company === "Xerotech");
  assert.equal(invertase.start, "2024-10-01");
  assert.equal(xerotech.start, "2024-01-01");
  assert.equal(invertase.end, xerotech.end);
});

test("LinkedIn title corrections pin pre-edit IDs and categories without changing other job fields", async () => {
  const current = await fixture();
  const before = normalizeRichArray(current.jobs, JOB_FIELDS);
  const { data, report } = planLinkedInContentMigration(current);
  const after = normalizePortfolioData(data).jobs;
  const corrections = new Map(LINKEDIN_JOB_CORRECTIONS.map(({ id, fields }) => [id, fields]));
  before.forEach((job, index) => {
    const updated = after.find((entry) => entry.id === job.id);
    assert.ok(updated, `Original ID ${job.id} is retained`);
    const fields = corrections.get(job.id);
    assert.deepEqual(updated, { ...job, ...fields });
    const raw = data.jobs.find((entry) => entry.id === job.id || JSON.stringify(entry) === JSON.stringify(current.jobs[index]));
    assert.deepEqual(raw, fields ? { ...current.jobs[index], ...fields, id: job.id, category: job.category } : current.jobs[index]);
  });
  for (const id of ["job-f690ecbeb2d0b20497aba63b", "job-e3dab59ed6334e53ad5302c2"]) {
    assert.equal(after.find((job) => job.id === id).category, "research");
  }
  assert.equal(after.find((job) => job.id === "job-036963ac120af57f22fcf614").start, "2017-06-01");
  assert.equal(report.updates.filter((update) => update.collection === "jobs").length, 10);
  assert.ok(report.updates.filter((update) => update.collection === "jobs").every((update) => update.pinnedId));
});

test("LinkedIn changes only approved education/profile/page fields and preserves all papers/thesis/media", async () => {
  const current = await fixture();
  const before = normalizePortfolioData(current);
  const { data } = planLinkedInContentMigration(current);
  const after = normalizePortfolioData(data);
  assert.deepEqual(data.projects, current.projects);
  assert.deepEqual(data.research, current.research);
  assert.deepEqual(data.futureMetadata, current.futureMetadata);
  assert.deepEqual(data.profile, { ...current.profile, location: "Galway, Ireland" });
  assert.deepEqual(data.education[0], { ...current.education[0],
    institution: "Trinity College Dublin", degree: "MSc in Statistics and Data Science",
    grade: "80% (current mark as of June 2026; not a final degree result)", status: "in-progress" });
  assert.deepEqual(data.education.slice(1), current.education.slice(1));
  assert.deepEqual(after.education[0].imageUrls, before.education[0].imageUrls);
  assert.deepEqual(after.education[0].imageDescriptions, before.education[0].imageDescriptions);
  assert.deepEqual(after.education[0].imageBackupDescriptions, before.education[0].imageBackupDescriptions);
  assert.deepEqual(data.pages, { ...current.pages,
    experience: { ...current.pages.experience, description: LINKEDIN_PAGE_DESCRIPTIONS.experience },
    education: { ...current.pages.education, description: LINKEDIN_PAGE_DESCRIPTIONS.education } });
});

test("LinkedIn repeat ledger makes edited and deleted records a complete no-op", async () => {
  const first = planLinkedInContentMigration(await fixture()).data;
  first.jobs = first.jobs.filter((job) => job.id !== LINKEDIN_JOB_ADDITIONS[0].id);
  first.jobs[0].title = "Later administrator edit";
  first.profile.location = "";
  first.pages.experience.description = "Later page edit";
  const repeated = planLinkedInContentMigration(first, { alreadyApplied: true });
  assert.deepEqual(repeated.data, first);
  assert.equal(repeated.report.changed, false);
  assert.deepEqual(repeated.report.added, []);
  assert.deepEqual(repeated.report.updates, []);
});

test("LinkedIn ambiguous or missing source targets fail without mutating the source", async () => {
  const original = await fixture();
  const cases = [
    (data) => data.jobs.shift(),
    (data) => data.education.push(structuredClone(data.education[0])),
    (data) => { data.education[0].institution = "Already changed elsewhere"; },
    (data) => data.jobs.push({ title: "Edited role", company: "BoscaSports", start: "2025-09-01" }),
    (data) => { data.profile = null; },
    (data) => { data.jobs[0].duration = "Legacy value"; },
    (data) => data.projects.push({ name: "Unreviewed later addition" }),
    (data) => { data.projects[0] = null; }
  ];
  for (const mutate of cases) {
    const data = structuredClone(original);
    mutate(data);
    const copy = structuredClone(data);
    assert.throws(() => planLinkedInContentMigration(data), /review|target/);
    assert.deepEqual(data, copy);
  }
});

test("LinkedIn Redis preview is read-only and uses a separate ledger despite completed research migration", async () => {
  const f = redisFixture(await fixture());
  const result = await migrateLinkedInContentRedis({ redis: f.redis, key: f.key });
  assert.equal(result.applied, false);
  assert.equal(result.snapshotHash, createHash("sha256").update(f.values.get(f.key)).digest("hex"));
  assert.equal(result.ledgerKey, `${f.key}:migrations:${LINKEDIN_CONTENT_MIGRATION_ID}`);
  assert.equal(f.reads.includes(f.oldLedgerKey), false);
  assert.equal(f.writes.length, 0);
  assert.equal(f.backups.length, 0);
});

test("LinkedIn Redis apply retains complete raw backup, validates scope and is idempotent", async () => {
  const f = redisFixture(await fixture());
  const original = f.values.get(f.key);
  const result = await migrateLinkedInContentRedis(f.options());
  assert.equal(result.applied, true);
  assert.equal(f.backups[0].raw, original);
  assert.equal(f.values.get(result.backupKey), original);
  assert.equal(f.values.get(f.oldLedgerKey), "existing research ledger");
  assert.equal(JSON.parse(f.values.get(result.ledgerKey)).migrationId, LINKEDIN_CONTENT_MIGRATION_ID);
  assert.equal(JSON.parse(f.values.get(f.key)).jobs.length, 17);
  const repeated = await migrateLinkedInContentRedis(f.options());
  assert.equal(repeated.applied, false);
  assert.equal(repeated.report.changed, false);
  assert.equal(f.writes.length, 1);
});

test("LinkedIn stale hashes, invalid backups and concurrent edits cannot write Redis", async () => {
  const f = redisFixture(await fixture());
  await assert.rejects(() => migrateLinkedInContentRedis({ ...f.options(), expectedHash: "stale" }), /fresh dry run/);
  await assert.rejects(() => migrateLinkedInContentRedis({ ...f.options(), verifyDeployment: undefined }), /deployment verification/);
  await assert.rejects(() => migrateLinkedInContentRedis({ ...f.options(), backupWriter: async () => { throw new Error("Backup failed"); } }), /Backup failed/);
  await assert.rejects(() => migrateLinkedInContentRedis({ ...f.options(), backupFile: "private-content/prepared.json", backupReader: async () => "{}" }), /complete original payload/);
  await assert.rejects(() => migrateLinkedInContentRedis({ ...f.options(), verifyDeployment: async () => {
    const edited = JSON.parse(f.values.get(f.key));
    edited.profile.location = "Concurrent edit";
    f.values.set(f.key, JSON.stringify(edited));
  } }), /admin changed/);
  assert.equal(f.writes.length, 0);
  assert.equal(JSON.parse(f.values.get(f.key)).profile.location, "Concurrent edit");
});

test("Shared content migration requires an explicit valid identity before accessing Redis", async () => {
  for (const migrationId of [undefined, "", "../unsafe"]) {
    await assert.rejects(() => migratePortfolioContentRedis({
      migrationId, planMigration: () => {}, redis: { get: () => assert.fail("No Redis access") }
    }), /stable identity/);
  }
});

test("shared and LinkedIn migrations reject ambiguous dry-run modes before any access", async () => {
  for (const migrate of [migratePortfolioContentRedis, migrateLinkedInContentRedis]) {
    for (const dryRun of [null, 0, "false", "true", {}, []]) {
      await assert.rejects(migrate({ dryRun, redis: { get: () => assert.fail("No Redis access") } }), /boolean/);
    }
  }
});

test("LinkedIn CLI rejects live apply from file inputs or without a reviewed hash", async () => {
  for (const args of [["--input", "ignored.json", "--apply"], ["--apply"], ["--apply", "--expected-hash", "hash", "--dry-run"], ["--unknown"]]) {
    await assert.rejects(() => runLinkedInContentMigration(args), /preview|Invalid/);
  }
});

for (const descriptionsOnly of [false, true]) {
  test(`LinkedIn ${descriptionsOnly ? "duties" : "roles"} CLI file preview reports hashes without writes or private content`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "portfolio-cli-"));
    t.after(async () => {
      const target = resolve(directory);
      assert.equal(dirname(target), resolve(tmpdir()));
      assert.ok(basename(target).startsWith("portfolio-cli-"));
      await rm(target, { recursive: true, force: true });
    });
    let current = await fixture();
    if (descriptionsOnly) current = planLinkedInContentMigration(current).data;
    const privateMarker = "private-fixture-content-not-for-reports";
    current.futureMetadata = { privateNote: privateMarker };
    const original = JSON.stringify(current);
    const input = join(directory, "source.json"), report = join(directory, "report.json");
    await writeFile(input, original);
    const output = [];
    const previousLog = console.log;
    console.log = (value) => output.push(value);
    try {
      await runLinkedInContentMigration([...(descriptionsOnly ? ["--role-descriptions"] : []), "--input", input, "--dry-run", "--report", report]);
    } finally {
      console.log = previousLog;
    }
    assert.equal(await readFile(input, "utf8"), original);
    const text = await readFile(report, "utf8"), summary = JSON.parse(text);
    assert.equal(summary.applied, false);
    assert.equal(summary.snapshotHash, createHash("sha256").update(original).digest("hex"));
    if (descriptionsOnly) assert.match(summary.candidateHash, /^[a-f\d]{64}$/);
    assert.equal(output.length, 1);
    assert.equal(output[0].includes(privateMarker), false);
    assert.equal(text.includes(privateMarker), false);
    assert.equal(Object.hasOwn(summary, "data"), false);
  });
}

test("unknown LinkedIn CLI arguments are not echoed into errors", async () => {
  await assert.rejects(runLinkedInContentMigration(["sensitive-fixture-argument"]), { message: "Invalid LinkedIn migration option." });
});
