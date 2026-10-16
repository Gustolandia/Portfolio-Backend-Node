import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateProjectCollectionsRedis, planProjectCollectionAssignments } from "../src/content/projectCollectionAssignmentsMigration.js";
import { validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Previews the separately approved collection mapping; never infers membership.
 * File input is offline-only. Invalid/ambiguous flags fail before file/Redis
 * access. Live apply requires both reviewed hashes, an exact original backup
 * and a healthy deployed API. Reports omit full copy, rationale and credentials.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict maintenance command flags.
 * @returns {Promise<void>} Safe IDs/fields/counts/hashes and backup reference summary.
 * @throws {Error} Arguments, scope, deployment, backup, candidate or CAS guard fails.
 */
export async function runProjectCollections(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate project collections option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid project collections option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both confirmed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planProjectCollectionAssignments(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateProjectCollectionsRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (!response.ok || !validateCompletePortfolioPayload(data).valid || data.projects.some(row => !Array.isArray(row.collections))) {
          throw new Error("Verify the deployed collections-capable portfolio API before applying assignments.");
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runProjectCollections();
