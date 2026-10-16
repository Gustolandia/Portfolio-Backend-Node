import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const PHOTO_COMPLETION_MIGRATION_ID = "photo-completion-2026-10-16-v1";
export const PHOTO_COMPLETION_JOB_IDS = Object.freeze([
  "job-linkedin-boscasports-2025-09", "job-linkedin-invertase-2024-10", "job-linkedin-xerotech-2024-01", "job-8a8a1640190a0ce47953978c"
]);
export const PHOTO_COMPLETION_EDUCATION_MATCH = Object.freeze({
  degree: "Bootcamp - Node.js FullStack Development", institution: "EPICODE", start: "2020-04-01", end: "2020-10-01"
});
export const PHOTO_COMPLETION_MEDIA_FIELDS = Object.freeze(["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"]);
const FORMATS = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");
const media = row => Object.fromEntries(PHOTO_COMPLETION_MEDIA_FIELDS.map(field => [field, row[field]]));
const matches = (row, match) => Object.entries(match).every(([key, value]) => row[key] === value);

/**
 * @typedef {object} PhotoCompletionAsset
 * @property {string} id Unique reviewed safe staging identity, not a provider credential.
 * @property {'jobs'|'education'} collection Only the four approved jobs or exact EPICODE period.
 * @property {object} match Exact id/category/title/company for a job; exact degree/institution/start/end for EPICODE.
 * @property {string} sha256 Reviewed original lowercase SHA-256; no source is authorized by this value alone.
 * @property {number} bytes Positive source length, up to the selected-upload helper limit.
 * @property {number} width Positive decoded original pixel width.
 * @property {number} height Positive decoded original pixel height.
 * @property {'image/jpeg'|'image/png'|'image/webp'} mime Approved still-photo MIME, checked against actual decoder metadata.
 * @property {string} [deliveryTransform] Separately reviewed width-only downsize, e.g. w-1600; no crop/recolour/upscale. Original remains available.
 * @property {string} caption Approved descriptive text and full credit/source; the frontend owns one-line/info presentation.
 * @property {string} backupDescription Approved same-index accessible fallback.
 * @property {Record<string,string[]>} expectedMedia Complete original four-array values, including explicit blanks.
 * @property {{sourcePage:string,rights:string,credit:string,context:string,scopeNote:string}} provenance Independently reviewed rights and honest context; never an inferred attendance/ownership claim.
 *
 * @typedef {object} PhotoCompletionPlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal PHOTO_COMPLETION_MIGRATION_ID.
 * @property {PhotoCompletionAsset[]} assets Exactly one reviewed photo for each of the five fixed targets.
 */

/**
 * Resolves a reviewed target in raw source order without inferring identity.
 * @param {object} current Complete raw portfolio snapshot.
 * @param {PhotoCompletionAsset} asset Approved target identity/context and expected old tuples.
 * @returns {{collection:string,index:number,match:object,key:string}} Unique raw location and stable review identity.
 * @throws {Error} Scope, category, source identity, context or tuple expectations fail.
 */
function findTarget(current, asset) {
  const job = asset.collection === "jobs";
  if (!["jobs", "education"].includes(asset.collection) ||
      !keysEqual(asset.match, job ? ["id", "category", "title", "company"] : Object.keys(PHOTO_COMPLETION_EDUCATION_MATCH)) ||
      !Object.values(asset.match).every(value => typeof value === "string") ||
      (job ? !PHOTO_COMPLETION_JOB_IDS.includes(asset.match.id) || asset.match.category !== "industry"
        : !isDeepStrictEqual(asset.match, PHOTO_COMPLETION_EDUCATION_MATCH))) throw new Error("Photo completion target is outside the five approved records.");
  const allowedContexts = !job ? ["organisation-context", "online-learning-context"]
    : asset.match.id === PHOTO_COMPLETION_JOB_IDS[3] ? ["organisation-context", "product-context"]
      : asset.match.id === PHOTO_COMPLETION_JOB_IDS[1] ? ["organisation-context", "tooling-context"] : ["organisation-context", "industry-context"];
  if (!keysEqual(asset.provenance, ["sourcePage", "rights", "credit", "context", "scopeNote"]) ||
      Object.values(asset.provenance).some(value => typeof value !== "string" || !value.trim()) ||
      !allowedContexts.includes(asset.provenance.context)) throw new Error("Photos require reviewed rights/credit and honest non-attendance context.");
  const indexes = current[asset.collection].flatMap((row, index) =>
    (job ? row.id === asset.match.id : matches(row, asset.match)) ? [index] : []);
  if (indexes.length !== 1) throw new Error("Photo completion target is missing or ambiguous.");
  const [index] = indexes; const row = current[asset.collection][index];
  if (!matches(row, asset.match) || !keysEqual(asset.expectedMedia, PHOTO_COMPLETION_MEDIA_FIELDS) ||
      PHOTO_COMPLETION_MEDIA_FIELDS.some(field => !strings(row[field]) || row[field].length !== row.imageUrls?.length) ||
      !isDeepStrictEqual(media(row), asset.expectedMedia)) throw new Error("Stale or misaligned original photo tuples.");
  return { collection: asset.collection, index, match: asset.match, key: job ? asset.match.id : "epicode-2020" };
}

/**
 * Validates guarded still-photo staging receipts and original-only delivery.
 * @param {PhotoCompletionAsset} asset Reviewed original source dimensions/hash/MIME.
 * @param {object} receipt Existing stageImageKitAssets success receipt.
 * @returns {string} Approved original URL or exact reviewed width-only delivery URL.
 * @throws {Error} Source/decoder, provider identity or account/folder checks fail.
 */
function originalPhotoUrl(asset, receipt) {
  const original = receipt?.originalVerification; const delivery = receipt?.deliveryVerification;
  const width = asset.deliveryTransform ? Number(asset.deliveryTransform.slice(2)) : asset.width;
  const height = asset.height * width / asset.width;
  if (!receipt || receipt.status !== "verified" || receipt.sourceSha256 !== asset.sha256 || receipt.sourceBytes !== asset.bytes ||
      typeof receipt.provider?.fileId !== "string" || !receipt.provider.fileId || receipt.provider.size !== asset.bytes ||
      receipt.folder !== "/Portfolio-Website/Photos" || original?.status !== 200 || original.sha256 !== asset.sha256 || original.bytes !== asset.bytes ||
      original.width !== asset.width || original.height !== asset.height || original.format !== FORMATS[asset.mime] || original.pages !== 1 || original.nonblank !== true ||
      delivery?.status !== 200 || delivery.nonblank !== true || delivery.pages !== 1 || delivery.width !== width ||
      !Number.isSafeInteger(delivery.height) || Math.abs(delivery.height - height) > 1 ||
      !Object.values(FORMATS).includes(delivery.format)) throw new Error("Photo completion requires verified original-byte and decoded still-photo staging receipts.");
  let url;
  try { url = new URL(receipt.provider.url); } catch { throw new Error("Photo receipt URL is invalid."); }
  if (url.origin !== "https://ik.imagekit.io" || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith("/Gustolandia/Portfolio-Website/Photos/") || !/\.(?:jpe?g|png|webp)$/.test(url.pathname)) {
    throw new Error("Photo receipt is outside the approved original Photos folder.");
  }
  url.searchParams.set("tr", asset.deliveryTransform ?? "orig-true");
  if (asset.deliveryTransform && receipt.deliveryUrl !== url.href) throw new Error("Photo resize delivery differs from the reviewed width-only transformation.");
  return url.href;
}

/**
 * Previews exactly five append-only context photographs, with no network writes.
 *
 * Each old URL/title/description/backup tuple remains an exact prefix; no logo,
 * photo, caption, GIF or source figure is replaced, cropped, retired or reordered.
 * The four industry job IDs and exact EPICODE 2020 period are fixed; every other
 * raw/public field and record order remains exact, including maps, narrative,
 * curated skills, bylines/statuses, collections, CV, thesis and scientific figures.
 * Remote roles accept reviewed organisation/industry/tooling context only, never
 * an inferred historic workplace/attendance claim. Vertu additionally permits reviewed
 * product context without attributing device design or a new product to the user.
 * The planner checks scope/identity/receipts, not truth or copyright permission:
 * parent/owner review of each exact source/caption/provenance remains mandatory.
 * No approved assets are seeded by this code; staging/uploading is separate and
 * publishing/GET/startup never invokes the migration. Completed ledger repeats
 * retain later administrator edits or deleted records/photos.
 *
 * @param {object} current Complete fresh raw Redis snapshot, not an older seed/public projection.
 * @param {PhotoCompletionPlan} plan Separately confirmed exact five assets and old media arrays.
 * @param {object[]} receipts Independently verified guarded upload receipts, in any order.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent photo-completion ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Full raw candidate, safe field/count report and compact JSON SHA-256.
 * @throws {Error} Scope, source/context, old tuple alignment, receipt or full preservation checks fail.
 */
export function planPhotoCompletionMigration(current, plan, receipts, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Photo completion requires the complete raw portfolio.");
  }
  const data = structuredClone(current);
  const report = { migrationId: PHOTO_COMPLETION_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "assets"]) || plan.version !== 1 || plan.migrationId !== PHOTO_COMPLETION_MIGRATION_ID ||
      !Array.isArray(plan.assets) || plan.assets.length !== 5 || !Array.isArray(receipts) || receipts.length !== 5 ||
      receipts.some(value => !object(value) || typeof value.assetId !== "string") || new Set(receipts.map(r => r.assetId)).size !== 5) {
    throw new Error("Photo completion requires exactly five reviewed assets and independent staging receipts.");
  }
  const seenAssets = new Set(); const seenTargets = new Set(); const seenUrls = new Set(); const targets = [];
  const sourceUrls = new Set([...current.jobs, ...current.education, ...current.projects].flatMap(row => row.imageUrls ?? []).map(value => {
    try { const url = new URL(value); return url.origin + url.pathname; } catch { return value; }
  }));
  for (const asset of plan.assets) {
    if (!keysEqual(asset, ["id", "collection", "match", "sha256", "bytes", "width", "height", "mime", "caption", "backupDescription", "expectedMedia", "provenance",
      ...(Object.hasOwn(asset ?? {}, "deliveryTransform") ? ["deliveryTransform"] : [])]) ||
        typeof asset.id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(asset.id) || seenAssets.has(asset.id) ||
        !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "") || !Object.hasOwn(FORMATS, asset.mime) ||
        ![asset.bytes, asset.width, asset.height].every(value => Number.isSafeInteger(value) && value > 0) || asset.bytes > 15_000_000 ||
        (Object.hasOwn(asset, "deliveryTransform") && (typeof asset.deliveryTransform !== "string" || !/^w-[1-9]\d{0,3}$/.test(asset.deliveryTransform) || Number(asset.deliveryTransform.slice(2)) > asset.width)) ||
        typeof asset.caption !== "string" || !asset.caption.trim() || typeof asset.backupDescription !== "string" || !asset.backupDescription.trim()) {
      throw new Error("Photos require reviewed still-source metadata and complete paired caption/backup strings.");
    }
    const target = findTarget(current, asset);
    if (seenTargets.has(target.key)) throw new Error("Photo completion cannot duplicate or omit an approved target.");
    const url = originalPhotoUrl(asset, receipts.find(receipt => receipt.assetId === asset.id)); const parsed = new URL(url);
    const canonicalUrl = parsed.origin + parsed.pathname;
    if (sourceUrls.has(canonicalUrl) || seenUrls.has(canonicalUrl)) throw new Error("Photo URL is already present; inspect the plan/ledger instead of duplicating it.");
    seenAssets.add(asset.id); seenTargets.add(target.key); seenUrls.add(canonicalUrl); targets.push(target);
    const tuple = { imageUrls: url, imageTitles: asset.caption, imageDescriptions: asset.caption, imageBackupDescriptions: asset.backupDescription };
    for (const field of PHOTO_COMPLETION_MEDIA_FIELDS) data[target.collection][target.index][field] = [...current[target.collection][target.index][field], tuple[field]];
    report.changes.push({ collection: target.collection, ...(target.collection === "jobs" ? { id: asset.match.id } : { match: { ...asset.match } }),
      assetId: asset.id, fields: [...PHOTO_COMPLETION_MEDIA_FIELDS], oldCount: asset.expectedMedia.imageUrls.length, newCount: asset.expectedMedia.imageUrls.length + 1 });
  }
  const mask = value => { const copy = structuredClone(value); for (const target of targets) {
    const row = copy[target.collection].find(row => matches(row, target.match));
    for (const field of PHOTO_COMPLETION_MEDIA_FIELDS) delete row[field];
  } return copy; };
  const before = normalizePortfolioData(current); const after = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(after).valid || !isDeepStrictEqual(mask(current), mask(data)) ||
      !isDeepStrictEqual(mask(before), mask(after))) throw new Error("Append-only photo full raw/public scope proof failed.");
  for (const target of targets) {
    const original = before[target.collection].find(row => matches(row, target.match));
    const actual = after[target.collection].find(row => matches(row, target.match));
    const raw = data[target.collection][target.index];
    if (PHOTO_COMPLETION_MEDIA_FIELDS.some(field => !isDeepStrictEqual(actual[field], [...original[field], raw[field].at(-1)]))) {
      throw new Error("Appended photo would shift original public media associations during normalization.");
    }
  }
  report.changed = true;
  return finish();
}

/**
 * Previews by default; applies only a separately confirmed append-only candidate.
 * Source/candidate hashes, exact complete prepared backup and deployment check
 * guard the shared atomic raw CAS/original backup/new independent ledger. Stale
 * sources and concurrent edits abort. Repeats never re-add deleted photos/records.
 * Uploading is separate: this wrapper neither uploads nor lists/deletes assets.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:PhotoCompletionPlan,receipts:object[],expectedCandidateHash?:string}} [options={}] Raw Redis, reviewed plan/receipts and explicit apply guards.
 * @returns {Promise<object>} Safe fields/hashes/counts and backup references without copy, provenance or secrets.
 * @throws {Error} Mode, scope/context/source/receipt, backup/hash/deployment or CAS guards fail.
 */
export async function migratePhotoCompletionRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Photo completion dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Photo completion apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: PHOTO_COMPLETION_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Photo completion backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planPhotoCompletionMigration(current, options.plan, options.receipts, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) throw new Error("Photo completion candidate differs from the confirmed preview.");
      return result;
    }
  });
}
