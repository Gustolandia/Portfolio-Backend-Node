import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { JsonPortfolioStore } from "../src/storage/jsonPortfolioStore.js";
import { planResearchContentMigration, RESEARCH_CONTENT_MIGRATION_ID } from "../src/content/researchContentMigration.js";
import { migrateResearchContentRedis, verifyContentDeployment } from "../src/content/researchContentRedisMigration.js";

/**
 * Executes a content preview, an explicitly requested local seed update, or a
 * reviewed live apply. Public snapshot input is preview-only unless local apply
 * is explicitly chosen. Live apply requires a reviewed raw snapshot hash.
 *
 * @param {string[]} args CLI arguments.
 * @returns {Promise<void>} Command completion without printing content/secrets.
 */
export async function runContentMigration(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (["--dry-run", "--apply", "--apply-local"].includes(flag)) options[flag] = true;
    else if (["--input", "--expected-hash", "--report", "--api-url", "--backup-file"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error(`Invalid migration option: ${flag}`);
  }
  if ((options["--apply"] && (options["--input"] || options["--dry-run"] || options["--apply-local"])) ||
      (options["--apply-local"] && (!options["--input"] || options["--dry-run"])) ||
      (options["--apply"] && !options["--expected-hash"])) {
    throw new Error("Use --input path for preview, --input path --apply-local for local seed, or --apply --expected-hash reviewed-raw-hash for Redis.");
  }
  let result;
  if (options["--input"]) {
    const path = resolve(options["--input"]);
    const raw = await readFile(path, "utf8");
    const ledgerPath = resolve(dirname(path), "content-migrations.json");
    let ledger = [];
    try { ledger = JSON.parse(await readFile(ledgerPath, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    result = planResearchContentMigration(JSON.parse(raw), { alreadyApplied: ledger.includes(RESEARCH_CONTENT_MIGRATION_ID) });
    if (options["--apply-local"]) {
      const store = new JsonPortfolioStore({ filePath: path });
      await store.setPortfolioData(result.data);
      await writeFile(ledgerPath, JSON.stringify([...new Set([...ledger, RESEARCH_CONTENT_MIGRATION_ID])], null, 2) + "\n");
    }
  } else {
    result = await migrateResearchContentRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }),
      key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      dryRun: !options["--apply"], expectedHash: options["--expected-hash"],
      backupDirectory: resolve("private-content/backups"),
      backupFile: options["--backup-file"],
      verifyDeployment: () => verifyContentDeployment(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data")
    });
  }
  const summary = { ...result.report, snapshotHash: result.snapshotHash, applied: result.applied || Boolean(options["--apply-local"]), backupKey: result.backupKey, backupPath: result.backupPath };
  if (options["--report"]) {
    const reportPath = resolve(options["--report"]);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(summary, null, 2) + "\n");
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runContentMigration();
}
