import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { planResearchContentMigration, RESEARCH_CONTENT_MIGRATION_ID } from "./researchContentMigration.js";

const APPLY_CONTENT = `
if redis.call('EXISTS', KEYS[2]) == 1 then return 2 end
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[3], ARGV[1])
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
return 1
`;

/**
 * Verifies that the deployment can return the academic/authors contract.
 * This guard runs before any live content write, never on a dry run.
 *
 * @param {string} apiUrl Public data endpoint of the intended backend.
 * @returns {Promise<void>} Success or an error before migration application.
 */
export async function verifyContentDeployment(apiUrl) {
  const response = await fetch(apiUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Deployment check failed with HTTP ${response.status}.`);
  const data = await response.json();
  if (!data.profile || !data.research || !Array.isArray(data.projects) ||
      !data.projects.every((project) => typeof project.id === "string" &&
        typeof project.category === "string" && Array.isArray(project.authors))) {
    throw new Error("Deploy the academic/authors contract before applying content.");
  }
}

async function persistBackup(path, raw) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, raw, { encoding: "utf8", flag: "wx" });
}

/**
 * Reads raw Redis JSON and previews or atomically applies the content migration.
 *
 * The client must disable automatic deserialization. Application requires the
 * exact reviewed raw-value SHA-256, a compatible deployment and an outside-Git
 * file backup. Lua checks both the value and a separate migration ledger, then
 * writes the Redis backup, replacement and ledger together. Concurrent admin
 * saves abort without overwriting; repeats cannot re-add deleted papers.
 *
 * @param {object} options Execution settings.
 * @param {object} options.redis Raw Redis client (automaticDeserialization:false).
 * @param {string} options.key Existing portfolio key.
 * @param {boolean} [options.dryRun=true] Read-only preview unless false.
 * @param {string} [options.expectedHash] Reviewed raw snapshot hash required to apply.
 * @param {string} [options.backupDirectory] Ignored local backup directory.
 * @param {string} [options.backupFile] Prepared outside-Git backup, checked against the complete source.
 * @param {Function} [options.verifyDeployment] Required deployment verification callback to apply.
 * @param {Function} [options.backupWriter] Outside-Git backup writer; injected only for isolated tests.
 * @param {Function} [options.backupReader] Prepared backup reader; injected only for isolated tests.
 * @returns {Promise<object>} Safe plan/report including snapshot hash and backup paths.
 */
export async function migrateResearchContentRedis({
  redis, key, dryRun = true, expectedHash, backupDirectory, backupFile,
  verifyDeployment, backupWriter = persistBackup, backupReader = readFile
}) {
  const ledgerKey = `${key}:migrations:${RESEARCH_CONTENT_MIGRATION_ID}`;
  const raw = await redis.get(key);
  if (typeof raw !== "string") throw new Error("Expected an existing raw JSON portfolio value.");
  const snapshotHash = createHash("sha256").update(raw).digest("hex");
  const ledger = await redis.get(ledgerKey);
  const plan = planResearchContentMigration(JSON.parse(raw), { alreadyApplied: ledger !== null });
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
  const backupKey = `${key}:backup:${RESEARCH_CONTENT_MIGRATION_ID}:${token}`;
  const backupPath = backupFile ? resolve(backupFile)
    : resolve(backupDirectory, `${RESEARCH_CONTENT_MIGRATION_ID}-${token}.json`);
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
    [raw, JSON.stringify(plan.data), JSON.stringify({ appliedAt: new Date().toISOString(), migrationId: RESEARCH_CONTENT_MIGRATION_ID, snapshotHash, backupKey })]));
  if (code === 0) throw new Error("An admin changed live content during migration; no Redis write occurred.");
  if (code === 2) return { ...result, backupPath, alreadyApplied: true };
  if (code !== 1) throw new Error("Unexpected Redis migration result; inspect the ledger before retrying.");
  return { ...result, applied: true, backupKey, backupPath };
}
