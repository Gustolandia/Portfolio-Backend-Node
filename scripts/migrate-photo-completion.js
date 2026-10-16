import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migratePhotoCompletionRedis, planPhotoCompletionMigration } from "../src/content/photoCompletionMigration.js";
import { validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Previews approved append-only context photos and verified upload receipts; never uploads.
 * File inputs are offline preview-only. Invalid/ambiguous flags fail before
 * file/Redis access. Live apply requires a separately confirmed candidate,
 * source/candidate hashes, exact original backup and a healthy deployed API.
 * Backend-only credentials and full source/narrative never enter CLI reports.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict maintenance CLI flags.
 * @returns {Promise<void>} Safe counts/IDs/hashes and backup reference summary.
 * @throws {Error} Argument, evidence, scope, deployment, backup or CAS guards fail.
 */
export async function runPhotoCompletion(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate append-only context photos option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--receipts", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid append-only context photos option.");
  }
  if (!options["--plan"] || !options["--receipts"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan and --receipts; --apply requires both confirmed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  const receipts = JSON.parse(await readFile(resolve(options["--receipts"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planPhotoCompletionMigration(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan, receipts);
  } else {
    result = await migratePhotoCompletionRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, receipts, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        if (!response.ok || !validateCompletePortfolioPayload(await response.json()).valid) {
          throw new Error("Verify the deployed portfolio API before applying append-only context photos curation.");
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runPhotoCompletion();
