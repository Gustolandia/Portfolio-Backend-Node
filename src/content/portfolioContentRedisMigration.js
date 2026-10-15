import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

const APPLY_CONTENT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[3], ARGV[1])
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

async function persistBackup(path, raw) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, raw, { encoding: "utf8", flag: "wx" });
}

/**
 * Previews a scoped content plan or applies it with complete backups and CAS.
 *
 * Redis must disable automatic deserialization so the reviewed SHA-256 and
 * Redis backup cover the exact original bytes. The planner owns field scope;
 * each migration uses its own ledger. Only the boolean false enables writes;
 * ambiguous modes are rejected before Redis access. A repeat never restores
 * deleted records.
 * Apply requires deployment verification and an outside-Git original backup.
 * Concurrent edits abort before any Redis write. No credentials are returned.
 *
 * @param {object} options Execution settings.
 * @param {object} options.redis Raw Redis client (automaticDeserialization:false).
 * @param {string} options.key Existing portfolio key.
 * @param {string} options.migrationId Distinct stable ledger identity.
 * @param {Function} options.planMigration Pure planner accepting data and ledger state.
 * @param {boolean} [options.dryRun=true] Read-only preview unless false.
 * @param {string} [options.expectedHash] Reviewed exact raw SHA-256 required to apply.
 * @param {string} [options.backupDirectory] Ignored local backup directory.
 * @param {string} [options.backupFile] Prepared original backup checked before applying.
 * @param {Function} [options.verifyDeployment] Required verification callback to apply.
 * @param {Function} [options.backupWriter] Backup writer; injected only for isolated tests.
 * @param {Function} [options.backupReader] Prepared backup reader; injected only for tests.
 * @returns {Promise<object>} Proposed data, safe report, hash, ledger and backup paths.
 */
export async function migratePortfolioContentRedis({
  redis, key, migrationId, planMigration, dryRun = true, expectedHash,
  backupDirectory, backupFile, verifyDeployment,
  backupWriter = persistBackup, backupReader = readFile
}) {
  if (typeof dryRun !== "boolean") throw new Error("Content migration dryRun must be a boolean.");
  if (typeof migrationId !== "string" || !/^[a-z0-9][a-z0-9-]{0,127}$/.test(migrationId) || typeof planMigration !== "function") {
    throw new Error("Content migration requires a stable identity and scoped planner.");
  }
  const ledgerKey = `${key}:migrations:${migrationId}`;
  const raw = await redis.get(key);
  if (typeof raw !== "string") throw new Error("Expected an existing raw JSON portfolio value.");
  const snapshotHash = createHash("sha256").update(raw).digest("hex");
  const ledger = await redis.get(ledgerKey);
  const plan = planMigration(JSON.parse(raw), { alreadyApplied: ledger !== null });
  const result = { ...plan, snapshotHash, ledgerKey, applied: false, backupKey: null, backupPath: null };
  if (dryRun || ledger !== null) return result;

  if (!expectedHash || expectedHash !== snapshotHash) {
    throw new Error("Live content differs from the reviewed snapshot; create a fresh dry run.");
  }
  if ((!backupDirectory && !backupFile) || typeof verifyDeployment !== "function") {
    throw new Error("Apply requires an outside-Git backup directory and deployment verification.");
  }
  await verifyDeployment();
  const token = `${Date.now()}-${randomUUID()}`;
  const backupKey = `${key}:backup:${migrationId}:${token}`;
  const backupPath = backupFile ? resolve(backupFile)
    : resolve(backupDirectory, `${migrationId}-${token}.json`);
  if (backupFile) {
    const originalBackup = await backupReader(backupPath, "utf8");
    if (!isDeepStrictEqual(JSON.parse(originalBackup), JSON.parse(raw))) {
      throw new Error("Prepared backup does not match the complete original payload; no Redis write occurred.");
    }
  } else {
    await backupWriter(backupPath, raw);
  }
  const code = Number(await redis.eval(APPLY_CONTENT,
    [key, ledgerKey, backupKey],
    [raw, JSON.stringify(plan.data), JSON.stringify({ appliedAt: new Date().toISOString(), migrationId, snapshotHash, backupKey })]));
  if (code === 0) throw new Error("An admin changed live content during migration; no Redis write occurred.");
  if (code === 2) return { ...result, backupPath, alreadyApplied: true };
  if (code !== 1) throw new Error("Unexpected Redis migration result; inspect the ledger before retrying.");
  return { ...result, applied: true, backupKey, backupPath };
}
