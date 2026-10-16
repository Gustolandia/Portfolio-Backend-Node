import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateWebsiteReviewRedis, planWebsiteReviewMigration } from "../src/content/websiteReviewMigration.js";

/**
 * Previews a reviewed website plan or explicitly applies it with both hashes.
 * File snapshots are preview-only. Redis access is never performed when CLI
 * validation fails. Real credentials stay in server-side environment variables;
 * stdout/report contain field paths, hashes and backup references, not payloads.
 * The generated proposal must be reviewed separately, not approved by this CLI.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict maintenance CLI arguments.
 * @returns {Promise<void>} Safe preview/application summary; no automatic seeding.
 */
export async function runWebsiteReview(args = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate website review option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[i + 1] && !args[i + 1].startsWith("--")) options[flag] = args[++i];
    else throw new Error("Invalid website review option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both reviewed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planWebsiteReviewMigration(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateWebsiteReviewRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        if (!response.ok) throw new Error("Verify the deployed backend before applying website content.");
        const data = await response.json();
        if (typeof data.profile?.academicStatus !== "string" || typeof data.profile?.availability !== "string") {
          throw new Error("Deploy the editorial metadata contract before applying website content.");
        }
      }
    });
  }
  const summary = { ...result.report, snapshotHash: result.snapshotHash, candidateHash: result.candidateHash,
    applied: Boolean(result.applied), backupKey: result.backupKey, backupPath: result.backupPath };
  if (options["--report"]) {
    const path = resolve(options["--report"]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runWebsiteReview();
