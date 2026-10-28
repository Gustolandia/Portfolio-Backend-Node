import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Redis } from "@upstash/redis";
import { migrateResearchOutputSplitRedis, planResearchOutputSplit } from "../src/content/researchOutputSplitMigration.js";
import { validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

/**
 * Previews the approved three-paper replacement and Article C addition.
 * Input files are offline only. A live apply needs reviewed hashes and an exact
 * raw backup; reports intentionally omit manuscript copy and private rationale.
 *
 * @param {string[]} [args=process.argv.slice(2)] Strict command flags.
 * @returns {Promise<void>} Safe IDs, changed fields, hashes and backup references.
 */
export async function runResearchOutputSplit(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (Object.hasOwn(options, flag)) throw new Error("Duplicate research-output split option.");
    if (["--dry-run", "--apply"].includes(flag)) options[flag] = true;
    else if (["--input", "--plan", "--expected-hash", "--expected-candidate-hash", "--backup-file", "--report", "--api-url"].includes(flag) &&
        args[index + 1] && !args[index + 1].startsWith("--")) options[flag] = args[++index];
    else throw new Error("Invalid research-output split option.");
  }
  if (!options["--plan"] || (options["--apply"] && (options["--input"] || options["--dry-run"] ||
      !/^[a-f0-9]{64}$/.test(options["--expected-hash"] || "") || !/^[a-f0-9]{64}$/.test(options["--expected-candidate-hash"] || "") ||
      !options["--backup-file"]))) {
    throw new Error("Supply --plan; --apply requires both confirmed SHA-256 hashes, --backup-file and no --input/--dry-run.");
  }
  const plan = JSON.parse(await readFile(resolve(options["--plan"]), "utf8"));
  let result;
  if (options["--input"]) {
    result = planResearchOutputSplit(JSON.parse(await readFile(resolve(options["--input"]), "utf8")), plan);
  } else {
    result = await migrateResearchOutputSplitRedis({
      redis: Redis.fromEnv({ automaticDeserialization: false }),
      key: process.env.PORTFOLIO_REDIS_KEY || "portfolio:data",
      plan,
      dryRun: !options["--apply"],
      expectedHash: options["--expected-hash"],
      expectedCandidateHash: options["--expected-candidate-hash"],
      backupFile: options["--backup-file"],
      verifyDeployment: async () => {
        const response = await fetch(options["--api-url"] || "https://gustavopedroricoubackend.netlify.app/.netlify/functions/portfolio-data", { cache: "no-store" });
        const data = response.ok ? await response.json() : null;
        if (!response.ok || !validateCompletePortfolioPayload(data).valid ||
            data.projects.some((project) => !Array.isArray(project.links) || !Array.isArray(project.linksDescriptions))) {
          throw new Error("Verify the deployed portfolio API before applying the research-output split.");
        }
      },
    });
  }
  const summary = {
    ...result.report,
    snapshotHash: result.snapshotHash,
    candidateHash: result.candidateHash,
    applied: Boolean(result.applied),
    backupKey: result.backupKey,
    backupPath: result.backupPath,
  };
  if (options["--report"]) {
    const path = resolve(options["--report"]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runResearchOutputSplit();
