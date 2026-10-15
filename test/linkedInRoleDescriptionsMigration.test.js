import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { planLinkedInContentMigration } from "../src/content/linkedInContentMigration.js";
import {
  LINKEDIN_ROLE_DESCRIPTIONS_MIGRATION_ID, LINKEDIN_ROLE_DUTY_UPDATES,
  migrateLinkedInRoleDescriptionsRedis, planLinkedInRoleDescriptionsMigration
} from "../src/content/linkedInRoleDescriptionsMigration.js";
import { JOB_FIELDS, normalizePortfolioData, normalizeRichArray } from "../src/validation/portfolioData.js";
import { runLinkedInContentMigration } from "../scripts/migrate-linkedin-content.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function fixture() {
  const data = JSON.parse(await readFile(new URL("../data/portfolio.json", import.meta.url), "utf8"));
  data.jobs.find((job) => job.company.includes("Stuttgart")).title = "Student Job";
  data.education.unshift({ degree: "Masters in Statistics and Data Science", institution: "Trinity College, Dublin",
    start: "2024-09-01", end: "2027-10-01", skills: [], courses: ["Test course"] });
  const current = planLinkedInContentMigration(data).data;
  current.futureContent = { retained: true };
  current.jobs[0].futureJobField = { retained: true };
  return current;
}

function redisFixture(data) {
  const key = "portfolio:test";
  const previousLedgers = ["research-content-2026-10-15-v1", "linkedin-content-2026-10-15-v1"]
    .map((id) => `${key}:migrations:${id}`);
  const values = new Map([[key, JSON.stringify(data)], ...previousLedgers.map((ledger) => [ledger, "Existing ledger"])]);
  const writes = [];
  const backups = [];
  const redis = {
    get: async (target) => values.get(target) ?? null,
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
  return { key, values, writes, backups, redis, previousLedgers,
    options: () => ({ redis, key, dryRun: false, expectedHash: sha256(values.get(key)),
      expectedCandidateHash: planLinkedInRoleDescriptionsMigration(JSON.parse(values.get(key))).candidateHash,
      backupDirectory: "private-content/test-role-descriptions", verifyDeployment: async () => {},
      backupWriter: async (path, raw) => backups.push({ path, raw }) }) };
}

test("Description planner changes exactly thirteen existing duties arrays and no other raw fields/order", async () => {
  const current = await fixture();
  const copy = structuredClone(current);
  const beforeRows = normalizeRichArray(current.jobs, JOB_FIELDS);
  const result = planLinkedInRoleDescriptionsMigration(current);
  assert.deepEqual(current, copy);
  assert.equal(result.report.updates.length, 13);
  assert.deepEqual(result.report.counts, { jobs: 17, education: 7, projects: 15 });
  const expected = structuredClone(current);
  beforeRows.forEach(({ id }, index) => {
    if (LINKEDIN_ROLE_DUTY_UPDATES[id]) expected.jobs[index].duties = [...LINKEDIN_ROLE_DUTY_UPDATES[id]];
  });
  assert.deepEqual(result.data, expected);
  assert.equal(result.candidateHash, sha256(JSON.stringify(expected)));
  assert.equal(result.data.jobs[beforeRows.findIndex((job) => job.id === "job-44a10c8d45ae3eaaa582ac9c")].duties.length, 1);
  assert.equal(normalizePortfolioData(result.data).jobs.filter((job) => job.category === "research").length, 5);
});

test("Description updates retain all normalized identities/media/skills and leave three legacy IDs unpersisted", async () => {
  const current = await fixture();
  const before = normalizePortfolioData(current);
  const { data } = planLinkedInRoleDescriptionsMigration(current);
  const after = normalizePortfolioData(data);
  before.jobs.forEach((job, index) => {
    assert.deepEqual(after.jobs[index], { ...job, duties: LINKEDIN_ROLE_DUTY_UPDATES[job.id] ? [...LINKEDIN_ROLE_DUTY_UPDATES[job.id]] : job.duties });
  });
  const rawRows = normalizeRichArray(data.jobs, JOB_FIELDS);
  for (const id of ["job-8a8a1640190a0ce47953978c", "job-b103e2ba7ee07cf79497e9d1", "job-636bd8253182ac041a72f4c2"]) {
    const index = rawRows.findIndex((job) => job.id === id);
    assert.equal(Object.hasOwn(data.jobs[index], "id"), false);
    assert.equal(Object.hasOwn(data.jobs[index], "category"), false);
  }
  assert.deepEqual(after.pages, before.pages);
  assert.deepEqual(after.education, before.education);
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.profile, before.profile);
  assert.deepEqual(after.research, before.research);
});

test("Descriptions never restore newer roles or later edits once their own ledger is applied", async () => {
  const current = await fixture();
  const newer = current.jobs.find((job) => job.id === "job-linkedin-boscasports-2025-09");
  newer.duties = ["Administrator-edited newer role"];
  const first = planLinkedInRoleDescriptionsMigration(current).data;
  assert.deepEqual(first.jobs.find((job) => job.id === newer.id), newer);
  first.jobs.pop();
  first.jobs[0].duties = ["Administrator-edited existing role"];
  const repeated = planLinkedInRoleDescriptionsMigration(first, { alreadyApplied: true });
  assert.deepEqual(repeated.data, first);
  assert.equal(repeated.report.changed, false);
  assert.deepEqual(repeated.report.updates, []);
});

test("Missing, ambiguous or unexpected description source identities/counts fail closed", async () => {
  const original = await fixture();
  const changes = [
    (data) => data.jobs.pop(),
    (data) => data.education.pop(),
    (data) => { data.pages = null; },
    (data) => { data.jobs[1].id = "Unexpected ID"; },
    (data) => { data.jobs[1] = structuredClone(data.jobs[2]); },
    (data) => { data.jobs[1] = null; }
  ];
  for (const change of changes) {
    const data = structuredClone(original);
    change(data);
    const copy = structuredClone(data);
    assert.throws(() => planLinkedInRoleDescriptionsMigration(data), /scope|target/);
    assert.deepEqual(data, copy);
  }
});

test("Role-description preview is read-only and independent of both previous ledgers", async () => {
  const f = redisFixture(await fixture());
  const result = await migrateLinkedInRoleDescriptionsRedis({ redis: f.redis, key: f.key });
  assert.equal(result.snapshotHash, sha256(f.values.get(f.key)));
  assert.equal(result.candidateHash, sha256(JSON.stringify(result.data)));
  assert.equal(result.ledgerKey, `${f.key}:migrations:${LINKEDIN_ROLE_DESCRIPTIONS_MIGRATION_ID}`);
  assert.equal(result.applied, false);
  assert.equal(f.writes.length, 0);
  assert.equal(f.backups.length, 0);
});

test("Role-description apply backs up exact original and never repeats after the separate ledger", async () => {
  const f = redisFixture(await fixture());
  const original = f.values.get(f.key);
  const options = f.options();
  const result = await migrateLinkedInRoleDescriptionsRedis(options);
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), original);
  assert.equal(f.backups[0].raw, original);
  for (const ledger of f.previousLedgers) assert.equal(f.values.get(ledger), "Existing ledger");
  const current = JSON.parse(f.values.get(f.key));
  current.jobs[0].duties = ["Later edit"];
  f.values.set(f.key, JSON.stringify(current));
  const repeat = await migrateLinkedInRoleDescriptionsRedis(options);
  assert.equal(repeat.applied, false);
  assert.equal(repeat.report.changed, false);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(JSON.parse(f.values.get(f.key)).jobs[0].duties, ["Later edit"]);
});

test("Role descriptions reject stale candidate/source hashes and failed/incomplete backups before writes", async () => {
  const f = redisFixture(await fixture());
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), expectedCandidateHash: undefined }), /candidate SHA/);
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), expectedCandidateHash: "0".repeat(64) }), /candidate differs/);
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), expectedHash: "stale" }), /fresh dry run/);
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), verifyDeployment: undefined }), /deployment verification/);
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), backupWriter: async () => { throw new Error("Backup failed"); } }), /Backup failed/);
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), backupFile: "private-content/invalid.json", backupReader: async () => "{}" }), /complete original payload/);
  assert.equal(f.writes.length, 0);
});

test("Concurrent administrator edits abort role-description application without overwriting them", async () => {
  const f = redisFixture(await fixture());
  await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({ ...f.options(), verifyDeployment: async () => {
    const current = JSON.parse(f.values.get(f.key));
    current.jobs[0].duties = ["Concurrent administrator edit"];
    f.values.set(f.key, JSON.stringify(current));
  } }), /admin changed/);
  assert.equal(f.writes.length, 0);
  assert.deepEqual(JSON.parse(f.values.get(f.key)).jobs[0].duties, ["Concurrent administrator edit"]);
});

test("Description CLI requires both hashes and refuses file-input apply or mixed migration hashes", async () => {
  for (const args of [
    ["--role-descriptions", "--apply", "--expected-hash", "source"],
    ["--role-descriptions", "--apply", "--input", "ignored.json", "--expected-hash", "source", "--expected-candidate-hash", "candidate"],
    ["--expected-candidate-hash", "candidate"],
    ["--role-descriptions", "--apply", "--dry-run", "--expected-hash", "source", "--expected-candidate-hash", "candidate"]
  ]) {
    await assert.rejects(() => runLinkedInContentMigration(args), /preview/);
  }
});

test("Description migration rejects non-boolean apply modes before Redis access", async () => {
  for (const dryRun of [0, "false", null]) {
    await assert.rejects(() => migrateLinkedInRoleDescriptionsRedis({
      dryRun, redis: { get: () => assert.fail("No Redis access") }
    }), /boolean/);
  }
});
