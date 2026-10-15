import { planResearchContentMigration, RESEARCH_CONTENT_MIGRATION_ID } from "./researchContentMigration.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

/**
 * Verifies that the deployment can return the academic/authors contract.
 * This guard runs before any live content write, never on a dry run.
 *
 * @param {string} apiUrl Public data endpoint of the intended backend.
 * @returns {Promise<void>} Success or an error before migration application.
 */
export async function verifyContentDeployment(apiUrl) {
  const response = await fetch(apiUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Deployment check failed with HTTP ${response.status}.`);
  const data = await response.json();
  if (!data.profile || !data.research || !Array.isArray(data.projects) ||
      !data.projects.every((project) => typeof project.id === "string" &&
        typeof project.category === "string" && Array.isArray(project.authors))) {
    throw new Error("Deploy the academic/authors contract before applying content.");
  }
}

/**
 * Reads raw Redis JSON and previews or atomically applies the content migration.
 *
 * The client must disable automatic deserialization. Application requires the
 * exact reviewed raw-value SHA-256, a compatible deployment and an outside-Git
 * file backup. Lua checks both the value and a separate migration ledger, then
 * writes the Redis backup, replacement and ledger together. Concurrent admin
 * saves abort without overwriting; repeats cannot re-add deleted papers.
 *
 * @param {object} options Execution settings.
 * @param {object} options.redis Raw Redis client (automaticDeserialization:false).
 * @param {string} options.key Existing portfolio key.
 * @param {boolean} [options.dryRun=true] Read-only preview unless false.
 * @param {string} [options.expectedHash] Reviewed raw snapshot hash required to apply.
 * @param {string} [options.backupDirectory] Ignored local backup directory.
 * @param {string} [options.backupFile] Prepared outside-Git backup, checked against the complete source.
 * @param {Function} [options.verifyDeployment] Required deployment verification callback to apply.
 * @param {Function} [options.backupWriter] Outside-Git backup writer; injected only for isolated tests.
 * @param {Function} [options.backupReader] Prepared backup reader; injected only for isolated tests.
 * @returns {Promise<object>} Safe plan/report including snapshot hash and backup paths.
 */
export async function migrateResearchContentRedis(options) {
  return migratePortfolioContentRedis({
    ...options, migrationId: RESEARCH_CONTENT_MIGRATION_ID,
    planMigration: planResearchContentMigration
  });
}
