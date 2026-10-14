import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { migrateResearchContentRedis } from "../src/content/researchContentRedisMigration.js";

function fixture() {
  let raw = JSON.stringify({ pages: {}, jobs: [], education: [], projects: [] });
  let ledger = null;
  const writes = [];
  const backups = [];
  const redis = {
    get: async (key) => key.includes(":migrations:") ? ledger : raw,
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
      if (ledger !== null) return 2;
      if (raw !== args[0]) return 0;
      writes.push({ backupKey: keys[2], backup: args[0], saved: JSON.parse(args[1]) });
      raw = args[1];
      ledger = args[2];
      return 1;
    }
  };
  return {
    redis, writes, backups, raw: () => raw,
    change: () => { raw = JSON.stringify({ pages: {}, jobs: [], education: [], projects: [], profile: { name: "Concurrent edit" } }); },
    applyOptions: () => ({
      redis, key: "portfolio:test", dryRun: false,
      expectedHash: createHash("sha256").update(raw).digest("hex"),
      backupDirectory: "private-content/test-backups", verifyDeployment: async () => {},
      backupWriter: async (path, value) => backups.push({ path, raw: value })
    })
  };
}

test("Redis content preview is read-only and reports the exact raw snapshot hash", async () => {
  const f = fixture();
  const result = await migrateResearchContentRedis({ redis: f.redis, key: "portfolio:test" });
  assert.equal(result.applied, false);
  assert.equal(result.report.added.length, 5);
  assert.equal(result.snapshotHash, createHash("sha256").update(f.raw()).digest("hex"));
  assert.equal(f.writes.length, 0);
  assert.equal(f.backups.length, 0);
});

test("reviewed apply saves complete original backup and sets the one-time ledger atomically", async () => {
  const f = fixture();
  const original = f.raw();
  const result = await migrateResearchContentRedis(f.applyOptions());
  assert.equal(result.applied, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].backup, original);
  assert.equal(f.backups[0].raw, original);
  assert.equal(f.backups[0].path, result.backupPath);
  assert.equal(f.writes[0].saved.projects.length, 5);
  const repeated = await migrateResearchContentRedis(f.applyOptions());
  assert.equal(repeated.applied, false);
  assert.equal(repeated.report.added.length, 0);
  assert.equal(f.writes.length, 1);
});

test("stale approval hash, missing deployment guard and failed backup cannot write Redis", async () => {
  const f = fixture();
  await assert.rejects(() => migrateResearchContentRedis({ ...f.applyOptions(), expectedHash: "stale" }), /fresh dry run/);
  await assert.rejects(() => migrateResearchContentRedis({ ...f.applyOptions(), verifyDeployment: undefined }), /deployment verification/);
  await assert.rejects(() => migrateResearchContentRedis({ ...f.applyOptions(), backupWriter: async () => { throw new Error("Backup failed"); } }), /Backup failed/);
  assert.equal(f.writes.length, 0);
});

test("a concurrent admin edit aborts without overwriting the edited content", async () => {
  const f = fixture();
  await assert.rejects(() => migrateResearchContentRedis({ ...f.applyOptions(), verifyDeployment: async () => f.change() }), /admin changed/);
  assert.equal(f.writes.length, 0);
  assert.equal(JSON.parse(f.raw()).profile.name, "Concurrent edit");
});

test("a prepared private backup must contain every original field before apply", async () => {
  const f = fixture();
  const original = f.raw();
  await assert.rejects(() => migrateResearchContentRedis({
    ...f.applyOptions(), backupFile: "private-content/prepared.json",
    backupReader: async () => JSON.stringify({ pages: {} })
  }), /complete original payload/);
  assert.equal(f.writes.length, 0);
  const result = await migrateResearchContentRedis({
    ...f.applyOptions(), backupFile: "private-content/prepared.json",
    backupReader: async () => JSON.stringify(JSON.parse(original), null, 2) + "\n"
  });
  assert.equal(result.applied, true);
  assert.equal(f.writes[0].backup, original);
  assert.equal(f.backups.length, 0);
});
