import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateAcademicReviewRedis, planAcademicReviewMigration } from "../src/content/academicReviewMigration.js";

/**
 * Previews an independently reviewed academic plan or applies it to raw Redis.
 * File snapshots are preview-only. Live applies need both approved hashes, a
 * complete prepared backup and a deployed supervisor contract. Reports contain
 * field paths/evidence rather than payloads, contact values or credentials.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict CLI arguments.
 * @returns {Promise<void>} Preview/application summary; no automatic seeding.
 */
export async function runAcademicReview(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[i + 1] && !args[i + 1].startsWith("--")) options[flag] = args[++i];
    else throw new Error("Invalid academic review option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !options["--expected-hash"] || !options["--expected-candidate-hash"] || !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both reviewed hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planAcademicReviewMigration(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateAcademicReviewRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data");
        if (!response.ok) throw new Error("Verify the deployed backend before applying content.");
        const data = await response.json();
        if (typeof data.research?.thesisSupervisor !== "string") throw new Error("Deploy the supervisor contract before applying content.");
      }
    });
  }
  const summary = { ...result.report, snapshotHash: result.snapshotHash, candidateHash: result.candidateHash,
    applied: Boolean(result.applied), backupKey: result.backupKey, backupPath: result.backupPath };
  if (options["--report"]) {
    const path = resolve(options["--report"]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(summary, null, 2) + "\n");
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runAcademicReview();
