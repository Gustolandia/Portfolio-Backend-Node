import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateLinkedInContentRedis, planLinkedInContentMigration } from "../src/content/linkedInContentMigration.js";
import { migrateLinkedInRoleDescriptionsRedis, planLinkedInRoleDescriptionsMigration } from "../src/content/linkedInRoleDescriptionsMigration.js";
import { verifyContentDeployment } from "../src/content/researchContentRedisMigration.js";

/**
 * Runs a preview by default; reviewed Redis application must be explicit.
 * File inputs are preview-only and cannot overwrite live content. The summary
 * contains the approved professional field diff, never credentials/full data.
 * This command does not modify the local seed or the completed research ledger.
 * The --role-descriptions mode is a separate duties-only migration/ledger and
 * requires both reviewed source and candidate hashes for application.
 *
 * @param {string[]} [args=process.argv.slice(2)] CLI arguments.
 * @returns {Promise<void>} Safe summary/report after preview or guarded application.
 */
export async function runLinkedInContentMigration(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (["--dry-run", "--apply", "--role-descriptions"].includes(flag)) options[flag] = true;
    else if (["--input", "--expected-hash", "--expected-candidate-hash", "--report", "--api-url", "--backup-file"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid LinkedIn migration option.");
  }
  if ((!options["--role-descriptions"] && options["--expected-candidate-hash"]) ||
      (options["--apply"] && (options["--input"] || options["--dry-run"] || !options["--expected-hash"] ||
        (options["--role-descriptions"] && !options["--expected-candidate-hash"])))) {
    throw new Error("Use --input path for preview; Redis apply needs a reviewed source hash and role-descriptions also needs its reviewed candidate hash.");
  }
  const planner = options["--role-descriptions"] ? planLinkedInRoleDescriptionsMigration : planLinkedInContentMigration;
  const migrateRedis = options["--role-descriptions"] ? migrateLinkedInRoleDescriptionsRedis : migrateLinkedInContentRedis;
  let result;
  if (options["--input"]) {
    const raw = await readFile(resolve(options["--input"]), "utf8");
    result = { ...planner(JSON.parse(raw)),
      snapshotHash: createHash("sha256").update(raw).digest("hex"), applied: false };
  } else {
    result = await migrateRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }),
      key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      dryRun: !options["--apply"], expectedHash: options["--expected-hash"],
      expectedCandidateHash: options["--expected-candidate-hash"],
      backupDirectory: resolve("private-content/backups"), backupFile: options["--backup-file"],
      verifyDeployment: () => verifyContentDeployment(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data")
    });
  }
  const summary = { ...result.report, snapshotHash: result.snapshotHash,
    candidateHash: result.candidateHash,
    applied: result.applied, backupKey: result.backupKey, backupPath: result.backupPath, ledgerKey: result.ledgerKey };
  if (options["--report"]) {
    const reportPath = resolve(options["--report"]);
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(summary, null, 2) + "\n");
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runLinkedInContentMigration();
}
