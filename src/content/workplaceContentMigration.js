import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { EDUCATION_FIELDS, JOB_FIELDS, normalizePortfolioData, normalizeRichArray, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { isSafePublicUrl } from "../validation/publicUrl.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const WORKPLACE_CONTENT_MIGRATION_ID = "workplace-photos-2026-10-15-v1";
const MEDIA_FIELDS = ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"];
const FIELDS = { jobs: JOB_FIELDS, education: EDUCATION_FIELDS };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const remote = (value) => /\b(remote|online)\b/i.test(value);
const ownedUrl = (url) => typeof url === "string" && isSafePublicUrl(url) && url.startsWith("https://ik.imagekit.io/Gustolandia/");

function finish(data, report) {
  return { data, report, candidateHash: sha256(JSON.stringify(data)) };
}

function findTarget(data, normalized, operation) {
  const { collection } = operation;
  if (!Object.hasOwn(FIELDS, collection)) throw new Error("Workplace edits are limited to jobs and education.");
  if (collection === "education") {
    if (!object(operation.match) || !isDeepStrictEqual(Object.keys(operation.match).sort(), ["degree", "end", "institution", "start"]) ||
        Object.values(operation.match).some((value) => typeof value !== "string")) {
      throw new Error("Education requires an exact four-field identity.");
    }
  } else if (typeof operation.id !== "string" || !operation.id) throw new Error("Job changes require stable IDs.");
  const indexes = normalized[collection].flatMap((row, index) =>
    (collection === "jobs" ? row.id === operation.id : Object.entries(operation.match).every(([key, value]) => row[key] === value)) ? [index] : []);
  if (indexes.length !== 1) throw new Error("Missing or ambiguous workplace target; review a fresh snapshot.");
  const index = indexes[0];
  return { key: `${collection}:${index}`, collection, index, raw: data[collection][index], normalized: normalized[collection][index] };
}

function checkPhotoSource(append, receipts, existingUrls) {
  const { tuple, source } = append;
  if (!object(tuple) || !isDeepStrictEqual(Object.keys(tuple).sort(), ["backupDescription", "description", "title", "url"]) ||
      Object.values(tuple).some((value) => typeof value !== "string") || !ownedUrl(tuple.url) || !object(source) ||
      typeof source.sourcePage !== "string" || !source.sourcePage || typeof source.rights !== "string" || !source.rights) {
    throw new Error("Workplace photos require an owned URL, aligned text and documented provenance/rights.");
  }
  if (source.kind === "existing-portfolio") {
    if (!existingUrls.has(tuple.url)) throw new Error("Reused photograph is not in the original portfolio.");
    return;
  }
  if (source.kind !== "staged-upload") throw new Error("Unapproved workplace photo source.");
  const receipt = receipts.find((value) => value.assetId === source.assetId);
  if (!receipt || receipt.status !== "verified" || receipt.sourceSha256 !== source.sha256 ||
      receipt.originalVerification?.sha256 !== source.sha256 || receipt.originalVerification.status !== 200 ||
      !receipt.originalVerification.nonblank || receipt.deliveryVerification?.status !== 200 ||
      !receipt.deliveryVerification.nonblank || receipt.deliveryUrl !== tuple.url || !receipt.provider?.fileId) {
    throw new Error("Workplace photograph needs verified original and delivery receipts.");
  }
}

/**
 * Previews only reviewed map queries and appended workplace/campus photo tuples.
 *
 * It never replaces existing photographs or changes other content. Original
 * URL order is checked before any append; four media arrays move as complete
 * tuples. Explicit existing strings, including empty captions, stay exact;
 * missing legacy metadata is padded using the normalizer without shifting indexes.
 * Surplus metadata without a corresponding URL requires manual review.
 * Job IDs are resolved in source order without persisting legacy IDs;
 * education matches all four existing identity fields. Raw unknown fields and
 * all projects, profile, research, dates, facts and existing media remain intact.
 * Explicit remote/online entries may receive only their already stated city as
 * organisation context, never a guessed office/home address. A wholly remote
 * course with no city remains unmapped. A completed ledger makes repeats no-ops.
 *
 * @param {object} current Complete current raw Redis portfolio snapshot.
 * @param {{version: number, migrationId: string, mapUpdates: object[], photoAppends: object[]}} plan Independently reviewed operations with provenance, expected map strings and original URL arrays.
 * @param {object[]} [receipts=[]] Verified staging receipts for new uploads; existing portfolio URLs need no upload.
 * @param {{alreadyApplied?: boolean}} [options={}] Separate migration ledger state.
 * @returns {{data: object, report: object, candidateHash: string}} Pure candidate, exact scoped report and candidate SHA-256.
 */
export function planWorkplaceContentMigration(current, plan, receipts = [], { alreadyApplied = false } = {}) {
  if (!object(current) || ["jobs", "education", "projects"].some((key) => !Array.isArray(current[key]))) {
    throw new Error("Workplace migration requires a complete raw portfolio snapshot.");
  }
  const data = structuredClone(current);
  const report = { migrationId: WORKPLACE_CONTENT_MIGRATION_ID, alreadyApplied, changed: false, maps: [], photos: [],
    counts: Object.fromEntries(["jobs", "education", "projects"].map((key) => [key, data[key].length])) };
  if (alreadyApplied) return finish(data, report);
  if (!object(plan) || plan.version !== 1 || plan.migrationId !== WORKPLACE_CONTENT_MIGRATION_ID ||
      !Array.isArray(plan.mapUpdates) || !Array.isArray(plan.photoAppends) || !Array.isArray(receipts) ||
      new Set(receipts.map((value) => value.assetId)).size !== receipts.length ||
      Object.keys(FIELDS).some((key) => data[key].some((row) => !object(row)))) {
    throw new Error("Invalid workplace plan, receipts or source records.");
  }
  const normalized = Object.fromEntries(Object.entries(FIELDS).map(([key, fields]) => [key, normalizeRichArray(data[key], fields)]));
  const existingUrls = new Set([...(current.jobs || []), ...(current.education || []), ...(current.projects || [])].flatMap((row) => row.imageUrls || []));
  const mapTargets = new Map();
  const photoTargets = new Map();
  for (const operation of plan.mapUpdates) {
    const target = findTarget(data, normalized, operation);
    if (mapTargets.has(target.key) || (target.raw.mapLocation ?? "") !== operation.expectedMapLocation ||
        typeof operation.mapLocation !== "string" || !operation.mapLocation.trim() || operation.mapLocation.length > 300 ||
        /[\x00-\x1f\x7f]|:\/\//.test(operation.mapLocation) || !["workplace", "campus", "area", "organisation-city"].includes(operation.scope) ||
        !Array.isArray(operation.evidence) || !operation.evidence.length) {
      throw new Error("Stale, conflicting or unsupported workplace map operation.");
    }
    if (remote(target.normalized.location)) {
      const city = target.normalized.location.replace(/\s*\((?:remote|online)\)\s*$/i, "").trim();
      if (remote(city) || operation.scope !== "organisation-city" || city !== operation.mapLocation) {
        throw new Error("Remote entries may use only their stated organisation city, not an invented workplace.");
      }
    }
    mapTargets.set(target.key, target);
    target.raw.mapLocation = operation.mapLocation;
    report.maps.push(operation);
  }
  for (const operation of plan.photoAppends) {
    const target = findTarget(data, normalized, operation);
    const originalUrls = target.raw.imageUrls ?? [];
    if (!isDeepStrictEqual(originalUrls, target.normalized.imageUrls) || !isDeepStrictEqual(originalUrls, operation.expectedImageUrls)) {
      throw new Error("Original workplace photo order changed; review a fresh snapshot.");
    }
    if (MEDIA_FIELDS.some((field) => Array.isArray(target.raw[field]) && target.raw[field].length > originalUrls.length)) {
      throw new Error("Original workplace metadata extends beyond its URL array; review before appending.");
    }
    checkPhotoSource(operation, receipts, existingUrls);
    if (!photoTargets.has(target.key)) photoTargets.set(target.key, { ...target, appends: [] });
    const work = photoTargets.get(target.key);
    if (originalUrls.includes(operation.tuple.url) || work.appends.some((value) => value.url === operation.tuple.url)) {
      throw new Error("Workplace photograph would duplicate an existing or pending tuple.");
    }
    work.appends.push(operation.tuple);
    report.photos.push(operation);
  }
  for (const target of photoTargets.values()) {
    const textKey = { imageUrls: "url", imageTitles: "title", imageDescriptions: "description", imageBackupDescriptions: "backupDescription" };
    for (const field of MEDIA_FIELDS) {
      const prefix = target.normalized.imageUrls.map((url, index) =>
        typeof target.raw[field]?.[index] === "string" ? target.raw[field][index] : target.normalized[field][index]);
      target.raw[field] = [...prefix, ...target.appends.map((value) => value[textKey[field]])];
    }
  }
  const mask = (value) => {
    const copy = structuredClone(value);
    for (const target of mapTargets.values()) delete copy[target.collection][target.index].mapLocation;
    for (const target of photoTargets.values()) for (const field of MEDIA_FIELDS) delete copy[target.collection][target.index][field];
    return copy;
  };
  if (!isDeepStrictEqual(mask(current), mask(data))) throw new Error("Workplace-only scope proof failed.");
  const after = normalizePortfolioData(data);
  const validation = validateCompletePortfolioPayload(after);
  if (!validation.valid) throw new Error(`Workplace candidate failed contract validation: ${validation.errors.join(" ")}`);
  const before = normalizePortfolioData(current);
  if (!isDeepStrictEqual(before.jobs.map(({ id }) => id), after.jobs.map(({ id }) => id))) {
    throw new Error("Workplace candidate changed job identity or ordering.");
  }
  report.changed = report.maps.length > 0 || report.photos.length > 0;
  return finish(data, report);
}

/**
 * Previews or applies workplace-only edits with source/candidate and backup guards.
 * Defaults to read-only. Explicit apply needs independently approved exact hashes,
 * deployment verification and a full byte-exact private backup. The shared Lua
 * CAS atomically writes original Redis backup, candidate and separate ledger;
 * concurrent admin edits abort and repeats never restore deleted content.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId' | 'planMigration'> & {plan: object, receipts?: object[], expectedCandidateHash?: string}} options Reviewed operations, raw Redis client and execution/backup dependencies.
 * @returns {Promise<object>} Scoped preview or verified atomic application result.
 */
export async function migrateWorkplaceContentRedis(options) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Workplace dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Workplace apply requires the reviewed candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: WORKPLACE_CONTENT_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha256(raw) !== options.expectedHash) throw new Error("Prepared workplace backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, ledgerState) => {
      const result = planWorkplaceContentMigration(current, options.plan, options.receipts, ledgerState);
      if (options.dryRun === false && !ledgerState.alreadyApplied && options.expectedCandidateHash !== result.candidateHash) {
        throw new Error("Workplace candidate differs from the reviewed preview; no Redis write occurred.");
      }
      return result;
    } });
}
