import assert from "node:assert/strict";
import { test } from "node:test";
import { migratePortfolioStore, runMigration } from "../scripts/migrate-redis.js";

test("migration defaults to a dry run and leaves source and store untouched", async () => {
  const source = { jobs: [{ title: "Research Intern" }], projects: [{ name: "Report on Reflectometry" }] };
  const copy = structuredClone(source);
  const writes = [];
  const result = await migratePortfolioStore({
    getPortfolioData: async () => source,
    setPortfolioData: async (data) => writes.push(data)
  });
  assert.equal(result.changed, true);
  assert.equal(result.applied, false);
  assert.equal(result.backupKey, null);
  assert.deepEqual(source, copy);
  assert.deepEqual(writes, []);
  assert.equal(result.data.profile.email, "");
  assert.equal(result.data.projects[0].category, "research");
});

test("explicit migration apply backs up first and repeated migration is idempotent", async () => {
  let stored = { jobs: [{ title: "Research Intern" }] };
  const writes = [];
  const store = {
    key: "portfolio:test", redis: { set: async (key, data) => writes.push([key, data]) },
    getPortfolioData: async () => stored,
    setPortfolioData: async (data) => {
      writes.push(["portfolio:test", data]);
      stored = data;
    }
  };
  const result = await migratePortfolioStore(store, { dryRun: false });
  assert.equal(result.applied, true);
  assert.match(result.backupKey, /^portfolio:test:backup:/);
  assert.equal(writes[0][0], result.backupKey);
  assert.deepEqual(writes[0][1], { jobs: [{ title: "Research Intern" }] });
  assert.equal(writes[1][0], "portfolio:test");
  const repeat = await migratePortfolioStore(store, { dryRun: false });
  assert.equal(repeat.changed, false);
  assert.equal(repeat.applied, false);
  assert.equal(writes.length, 2);
  assert.equal(repeat.data.jobs[0].id, result.data.jobs[0].id);
});

test("migration blocks dangling role references before any write", async () => {
  const writes = [];
  await assert.rejects(() => migratePortfolioStore({
    key: "portfolio:test", redis: { set: async (data) => writes.push(data) },
    getPortfolioData: async () => ({ projects: [{ relatedRoleIds: ["missing-role"] }] }),
    setPortfolioData: async (data) => writes.push(data)
  }, { dryRun: false }), /requires review/);
  assert.equal(writes.length, 0);
});

test("migration CLI rejects input apply and conflicting flags before connecting", async () => {
  for (const args of [["--input", "private.json", "--apply"], ["--apply", "--dry-run"], ["--input"], ["--unknown"]]) {
    await assert.rejects(() => runMigration(args), /Usage:/);
  }
});
