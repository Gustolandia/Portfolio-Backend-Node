import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateProfessionalSkillsRedis, planProfessionalSkillsMigration } from "../src/content/professionalSkillsMigration.js";
import { validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Previews the twelve-role professional skill plan; never implicitly approves it.
 *
 * Offline snapshots are preview-only. Invalid/ambiguous flags fail before file
 * or Redis access. A separately confirmed live apply needs both hashes, an exact
 * original backup and a healthy deployed API. Environment-only credentials and
 * full source content are never part of the count/hash-only CLI report.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict maintenance CLI flags.
 * @returns {Promise<void>} Safe preview/application summary.
 * @throws {Error} Arguments, evidence, scope, deployment or CAS guards fail.
 */
export async function runProfessionalSkills(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate professional skill option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid professional skill option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both confirmed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planProfessionalSkillsMigration(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateProfessionalSkillsRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }), key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan, dryRun: !options["--apply"], expectedHash: options["--expected-hash"], expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        if (!response.ok || !validateCompletePortfolioPayload(await response.json()).valid) {
          throw new Error("Verify the deployed portfolio API before applying professional skill curation.");
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runProfessionalSkills();
