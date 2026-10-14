import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Prepares a normalized migration and optionally saves it to the supplied store.
 *
 * Dry run is the default: exactly one read, no writes. Applying a Redis migration
 * writes a separate backup key before replacing the portfolio key. Explicitly
 * reviewed profile/research data, IDs and media relationships survive repeats.
 *
 * @param {{key?: string, redis?: object, getPortfolioData: Function, setPortfolioData?: Function}} store Source portfolio store.
 * @param {{dryRun?: boolean}} options Migration execution options.
 * @returns {Promise<{changed: boolean, applied: boolean, backupKey: string | null, data: ReturnType<typeof normalizePortfolioData>}>} Reviewable migration result.
 */
export async function migratePortfolioStore(store, { dryRun = true } = {}) {
  const current = await store.getPortfolioData();
  const data = normalizePortfolioData(current);
  const validation = validateCompletePortfolioPayload(data);

  if (!validation.valid) {
    throw new Error(`Normalized migration requires review: ${validation.errors.join(" ")}`);
  }

  const changed = JSON.stringify(current) !== JSON.stringify(data);
  let backupKey = null;

  if (!dryRun && changed) {
    if (!store.redis || !store.key) {
      throw new Error("Applying a migration requires a Redis store with backup support.");
    }
    backupKey = `${store.key}:backup:${new Date().toISOString()}`;
    await store.redis.set(backupKey, current);
    await store.setPortfolioData(data);
  }

  return { changed, applied: !dryRun && changed, backupKey, data };
}

/**
 * Runs a Redis preview or an offline preview of a noncommitted JSON snapshot.
 * `--apply` explicitly enables writes; `--input` supports offline dry runs only.
 *
 * @param {string[]} args CLI arguments excluding Node and the script path.
 * @returns {Promise<void>} Completion of the CLI command.
 */
export async function runMigration(args = process.argv.slice(2)) {
  const inputIndex = args.indexOf("--input");
  const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const apply = args.includes("--apply");
  const remaining = args.filter((_, index) => index !== inputIndex &&
    !(inputIndex >= 0 && index === inputIndex + 1));

  if (remaining.some((arg) => !["--dry-run", "--apply"].includes(arg)) ||
      (apply && args.includes("--dry-run")) ||
      (inputIndex >= 0 && (!inputPath || inputPath.startsWith("--") || apply))) {
    throw new Error("Usage: npm run migrate:redis -- [--dry-run | --apply] [--input path-to-json (dry run only)]");
  }

  const store = inputPath ? {
    getPortfolioData: async () => JSON.parse(await readFile(resolve(inputPath), "utf8"))
  } : new RedisPortfolioStore();
  const result = await migratePortfolioStore(store, { dryRun: !apply });

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    changed: result.changed,
    applied: result.applied,
    backupKey: result.backupKey,
    jobs: result.data.jobs.map(({ id, category }) => ({ id, category })),
    projects: result.data.projects.map(({ id, category, outputType, status }) => ({ id, category, outputType, status })),
    educationEntries: result.data.education.length
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runMigration();
}
