import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { EDUCATION_FIELDS, JOB_FIELDS, PAGE_KEYS, PROJECT_FIELDS, normalizePortfolioData,
  normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const MEDIA_RECOVERY_MIGRATION_ID = "media-recovery-2026-10-15-v1";
const MEDIA_FIELDS = ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"];
const FIELDS = { jobs: JOB_FIELDS, education: EDUCATION_FIELDS, projects: PROJECT_FIELDS };
const digest = (text) => createHash("sha256").update(text).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function finish(data, report) {
  return { data, report, candidateHash: digest(JSON.stringify(data)) };
}

function findRow(data, normalized, operation) {
  const { collection } = operation;
  if (!Object.hasOwn(FIELDS, collection)) throw new Error("Unapproved media collection.");
  if (collection === "education" && (!object(operation.match) ||
      !isDeepStrictEqual(Object.keys(operation.match).sort(), ["degree", "end", "institution", "start"]) ||
      Object.values(operation.match).some((value) => typeof value !== "string"))) {
    throw new Error("Education media requires its exact four-field identity.");
  }
  if (collection !== "education" && (typeof operation.id !== "string" || !operation.id)) {
    throw new Error("Media changes require stable job/project identity.");
  }
  const indexes = normalized[collection].flatMap((row, index) =>
    (collection === "education" ? Object.entries(operation.match).every(([key, value]) => row[key] === value)
      : row.id === operation.id) ? [index] : []);
  if (indexes.length !== 1) throw new Error("Missing or ambiguous media target; review a fresh snapshot.");
  const index = indexes[0];
  return { key: `${collection}:${index}`, collection, index, raw: data[collection][index], normalized: normalized[collection][index] };
}

function tuple(work, index) {
  return Object.fromEntries(MEDIA_FIELDS.map((field) => [field,
    typeof work.raw[field]?.[index] === "string" ? work.raw[field][index] : work.normalized[field][index]
  ]));
}

function verifyOldIndex(work, operation) {
  if (!Number.isSafeInteger(operation.originalIndex) || operation.originalIndex < 0 ||
      work.originalUrls[operation.originalIndex] !== operation.expectedUrl) {
    throw new Error("Original media index differs from the reviewed snapshot.");
  }
  if (/^https:\/\/ik\.imagekit\.io\//i.test(operation.expectedUrl)) {
    throw new Error("Existing ImageKit URLs must remain unchanged.");
  }
}

function maskScope(value, changes, scalarChanges) {
  const copy = structuredClone(value);
  for (const work of changes.values()) for (const field of MEDIA_FIELDS) delete copy[work.collection][work.index][field];
  for (const change of scalarChanges) delete (change.collection === "profile" ? copy.profile : copy.pages[change.page])[change.field];
  return copy;
}

function mediaUrl(asset, receipt, urlEndpoint, destination) {
  if (!receipt || receipt.status !== "verified" || receipt.sourceSha256 !== asset.sha256 ||
      receipt.originalVerification?.sha256 !== asset.sha256 || receipt.originalVerification.bytes !== asset.bytes ||
      receipt.originalVerification.width !== asset.width || receipt.originalVerification.height !== asset.height ||
      !receipt.originalVerification.nonblank || !receipt.deliveryVerification?.nonblank ||
      receipt.originalVerification.status !== 200 || receipt.deliveryVerification.status !== 200 ||
      !receipt.provider?.fileId || receipt.provider.size !== asset.bytes ||
      !["photos", "snippets"].includes(asset.target)) {
    throw new Error("Media candidate requires a verified original and delivery receipt for every asset.");
  }
  const base = new URL(urlEndpoint);
  const original = new URL(receipt.provider.url);
  const folder = `${destination}/${asset.target === "photos" ? "Photos" : "Snippets"}`;
  if (base.protocol !== "https:" || base.hostname !== "ik.imagekit.io" ||
      original.origin !== base.origin || original.username || original.password || original.search || original.hash ||
      !decodeURIComponent(original.pathname).startsWith(`${base.pathname.replace(/\/$/, "")}${folder}/`) ||
      receipt.folder !== folder) throw new Error("Media receipt URL is outside the approved account/folder.");
  if (receipt.originalVerification.pages > 1 && receipt.deliveryVerification.pages !== receipt.originalVerification.pages) {
    throw new Error("Animated delivery lost frames.");
  }
  if (asset.deliveryTransform) original.searchParams.set("tr", asset.deliveryTransform);
  else if (receipt.originalVerification.pages > 1) original.searchParams.set("tr", "orig-true");
  if (receipt.deliveryUrl !== original.href) throw new Error("Delivery URL differs from the reviewed transformation.");
  return original.href;
}

/**
 * Builds an exact, media-only preview from a complete raw portfolio snapshot.
 *
 * Jobs/projects match stable normalized IDs without persisting new IDs; education
 * matches its exact degree/institution/start/end. Every replacement/retirement
 * uses the original array index, never an index shifted by an earlier removal.
 * Four media arrays are edited as one ordered tuple; explicit old strings,
 * including empty captions, remain exact. Missing legacy metadata uses the
 * existing normalizer's padding/aliases. Removed tuples and reasons
 * are archived in the report, not deleted from ImageKit. Existing ImageKit URLs,
 * all non-media raw fields, entry order and academic metadata remain unchanged.
 * A completed separate ledger makes subsequent runs complete no-ops.
 *
 * @param {object} current Full raw portfolio, never a normalized public snapshot.
 * @param {object} manifest Approved version-2 selected asset/operation manifest.
 * @param {object[]} receipts Independently verified staging receipts in any order.
 * @param {object} [options={}] Ledger state and approved delivery account.
 * @param {boolean} [options.alreadyApplied=false] Existing media migration ledger.
 * @param {string} [options.urlEndpoint='https://ik.imagekit.io/Gustolandia'] Approved account, not supplied by a browser.
 * @returns {{data: object, report: object, candidateHash: string}} Complete candidate, scoped change/archive report and exact candidate hash.
 */
export function planMediaRecoveryMigration(current, manifest, receipts, { alreadyApplied = false,
  urlEndpoint = "https://ik.imagekit.io/Gustolandia" } = {}) {
  if (!object(current) || ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key]))) {
    throw new Error("Media recovery requires the complete raw portfolio.");
  }
  const data = structuredClone(current);
  const report = { migrationId: MEDIA_RECOVERY_MIGRATION_ID, alreadyApplied, changed: false,
    counts: Object.fromEntries(Object.keys(FIELDS).map((key) => [key, current[key].length])), updates: [], archived: [] };
  if (alreadyApplied) return finish(data, report);
  if (!object(data.pages) || !object(data.profile) || !object(data.research) ||
      Object.keys(FIELDS).some((key) => data[key].some((row) => !object(row))) ||
      manifest?.version !== 2 || manifest.batchId !== MEDIA_RECOVERY_MIGRATION_ID ||
      manifest.approvedDestination !== "/Portfolio-Website" || !Array.isArray(manifest.assets) || !manifest.assets.length ||
      !Array.isArray(manifest.retirements) || !Array.isArray(receipts) ||
      receipts.length !== manifest.assets.length || new Set(receipts.map((receipt) => receipt.assetId)).size !== receipts.length ||
      new Set(manifest.assets.map((asset) => asset.id)).size !== manifest.assets.length) {
    throw new Error("Incomplete or ambiguous media manifest, source or receipts.");
  }
  const normalized = Object.fromEntries(Object.entries(FIELDS).map(([key, fields]) => [key, normalizeRichArray(data[key], fields)]));
  const byAsset = new Map(receipts.map((receipt) => [receipt.assetId, receipt]));
  const changes = new Map();
  const scalarChanges = [];
  function getWork(operation) {
    const found = findRow(data, normalized, operation);
    if (!changes.has(found.key)) {
      const originalUrls = found.raw.imageUrls ?? [];
      if (!Array.isArray(originalUrls) || !isDeepStrictEqual(originalUrls, found.normalized.imageUrls)) {
        throw new Error("Raw media indexes differ from normalized indexes; review before migrating.");
      }
      if (MEDIA_FIELDS.some((field) => Array.isArray(found.raw[field]) && found.raw[field].length > originalUrls.length)) {
        throw new Error("Original media metadata extends beyond its URL array; review before migrating.");
      }
      changes.set(found.key, { ...found, originalUrls, replace: new Map(), remove: new Set(), append: [] });
    }
    return changes.get(found.key);
  }
  for (const asset of manifest.assets) {
    if (typeof asset.caption !== "string" || typeof asset.backupDescription !== "string" ||
        !Array.isArray(asset.operations) || !asset.operations.length) {
      throw new Error("Selected media needs paired descriptions, backup descriptions and exact operations.");
    }
    const url = mediaUrl(asset, byAsset.get(asset.id), urlEndpoint, manifest.approvedDestination);
    const row = { imageUrls: url, imageTitles: asset.caption, imageDescriptions: asset.caption,
      imageBackupDescriptions: asset.backupDescription };
    for (const operation of asset.operations) {
      if (operation.operation === "set") {
        if (!((operation.collection === "profile" && operation.field === "portraitUrl") ||
            (operation.collection === "pages" && PAGE_KEYS.includes(operation.page) && operation.field === "imageUrl"))) {
          throw new Error("Unapproved scalar media field.");
        }
        const target = operation.collection === "profile" ? data.profile : data.pages[operation.page];
        if (!object(target) || (target[operation.field] ?? "") !== operation.expectedValue ||
            /^https:\/\/ik\.imagekit\.io\//i.test(target[operation.field] || "") ||
            scalarChanges.some((change) => change.collection === operation.collection && change.page === operation.page)) {
          throw new Error("Stale, protected or conflicting scalar media operation.");
        }
        target[operation.field] = url;
        scalarChanges.push(operation);
      } else {
        if (!["append", "replace"].includes(operation.operation)) throw new Error("Unsupported media operation.");
        const work = getWork(operation);
        if (!isDeepStrictEqual(work.originalUrls, operation.expectedExistingUrls)) throw new Error("Original media URLs differ from the reviewed snapshot.");
        if (operation.operation === "append") work.append.push(row);
        else {
          verifyOldIndex(work, operation);
          if (work.replace.has(operation.originalIndex)) throw new Error("Conflicting media replacement.");
          work.replace.set(operation.originalIndex, row);
        }
      }
      report.updates.push({ assetId: asset.id, operation, url, description: asset.caption, backupDescription: asset.backupDescription });
    }
  }
  for (const operation of manifest.retirements) {
    if (typeof operation.reason !== "string" || !operation.reason) throw new Error("Retirement requires an archival reason.");
    const work = getWork(operation);
    verifyOldIndex(work, operation);
    if (work.remove.has(operation.originalIndex) || work.replace.has(operation.originalIndex)) throw new Error("Conflicting media retirement.");
    work.remove.add(operation.originalIndex);
    report.archived.push({ ...operation, originalTuple: tuple(work, operation.originalIndex) });
  }
  for (const work of changes.values()) {
    const rows = work.originalUrls.map((url, index) => work.replace.get(index) ?? tuple(work, index))
      .filter((row, index) => !work.remove.has(index)).concat(work.append);
    for (const field of MEDIA_FIELDS) work.raw[field] = rows.map((row) => row[field]);
  }
  if (!isDeepStrictEqual(maskScope(current, changes, scalarChanges), maskScope(data, changes, scalarChanges))) {
    throw new Error("Media-only scope proof failed.");
  }
  const after = normalizePortfolioData(data);
  const validation = validateCompletePortfolioPayload(after);
  if (!validation.valid) throw new Error(`Media candidate requires contract review: ${validation.errors.join(" ")}`);
  for (const key of ["jobs", "projects"]) {
    if (!isDeepStrictEqual(normalizePortfolioData(current)[key].map(({ id }) => id), after[key].map(({ id }) => id))) {
      throw new Error("Media candidate changed record identities or ordering.");
    }
  }
  report.changed = report.updates.length > 0 || report.archived.length > 0;
  return finish(data, report);
}

/**
 * Previews or atomically applies an approved media candidate with two hash guards.
 * Defaults to read-only. Apply requires the exact fresh raw source SHA-256, exact
 * reviewed candidate SHA-256, complete local/Redis backups and deployment check.
 * The shared CAS/ledger protects concurrent admin edits and prevents repeats from
 * restoring removed images. Uploading and Redis application remain separate.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId' | 'planMigration'> & {manifest: object, receipts: object[], expectedCandidateHash?: string, urlEndpoint?: string}} options Approved media plan, raw Redis client and backup/CAS dependencies.
 * @returns {Promise<object>} Candidate, report, source/candidate hashes and guarded receipt fields.
 */
export async function migrateMediaRecoveryRedis(options) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Media dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) {
    throw new Error("Media apply requires the reviewed candidate SHA-256.");
  }
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: MEDIA_RECOVERY_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || digest(raw) !== options.expectedHash) {
        throw new Error("Prepared media backup must match the exact raw source bytes; no Redis write occurred.");
      }
      return raw;
    },
    planMigration: (current, ledgerState) => {
      const result = planMediaRecoveryMigration(current, options.manifest, options.receipts, { ...ledgerState, urlEndpoint: options.urlEndpoint });
      if (options.dryRun === false && !ledgerState.alreadyApplied && options.expectedCandidateHash !== result.candidateHash) {
        throw new Error("Media candidate differs from the reviewed preview; no Redis write occurred.");
      }
      return result;
    } });
}
