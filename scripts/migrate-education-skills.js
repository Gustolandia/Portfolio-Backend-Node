import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateEducationSkillsRedis, planEducationSkillsMigration } from "../src/content/educationSkillsMigration.js";
import { validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Previews an education.skills-only plan or applies it behind explicit guards.
 *
 * File input is preview-only. Invalid flags fail before files or Redis are read.
 * Apply requires both reviewed hashes, a prepared exact backup and a healthy
 * deployed API. Credentials remain environment-only; stdout/report contain only
 * field counts, hashes and backup references, never complete source content.
 * This CLI does not approve a plan, seed content or run during normal requests.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict maintenance CLI flags.
 * @returns {Promise<void>} Prints a safe preview/application summary.
 * @throws {Error} Arguments, source evidence, deployment or write guards fail.
 */
export async function runEducationSkills(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate education skill option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid education skill option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both reviewed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planEducationSkillsMigration(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateEducationSkillsRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        if (!response.ok || !validateCompletePortfolioPayload(await response.json()).valid) {
          throw new Error("Verify the deployed portfolio API before applying education skill curation.");
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runEducationSkills();
