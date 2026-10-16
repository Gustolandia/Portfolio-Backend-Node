import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../validation/portfolioData.js";
import { migratePortfolioContentRedis } from "./portfolioContentRedisMigration.js";

export const SCIENTIFIC_FIGURES_MIGRATION_ID = "scientific-figures-2026-10-16-v1";
export const SCIENTIFIC_FIGURE_SOURCES = Object.freeze([
  Object.freeze({ id: "leadpipe-figure-1", projectId: "research-arxiv-2608-27736", category: "research", sha256: "9457c0ac4f13519ef4cf7c6ee0141db972c81c77e41848985508e9eede877927" }),
  Object.freeze({ id: "football-figure-4", projectId: "research-arxiv-2608-11228", category: "research", sha256: "d20af1a0f472753426457391f258ad0497f254f69336a9bfd40d823f7d906404" }),
  Object.freeze({ id: "latency-measurement-model", projectId: "research-zenodo-22044877", category: "research", sha256: "555a609627a82da42a5731f63adee9c0a4820113d56ea9fe4bf3e98fb36e10c0" }),
  Object.freeze({ id: "carsurfing-architecture", projectId: "project-e5a9d2ac9375ff84851016ad", category: "software", sha256: "84f68c66a60fe826d23132a42495747481fce6509ae3b06079ab6baa020ba7ad" })
]);
export const SCIENTIFIC_MEDIA_FIELDS = Object.freeze(["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions"]);
const FILEBOX_ID = "project-1930afed6e1b31fc8e95b24e";
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === "string");
const keysEqual = (value, keys) => object(value) && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const sha = value => createHash("sha256").update(value).digest("hex");
const media = row => Object.fromEntries(SCIENTIFIC_MEDIA_FIELDS.map(field => [field, row[field]]));

/**
 * @typedef {object} ScientificFigurePatch
 * @property {string} id One of the four exact approved source asset identities.
 * @property {{id:string,category:string,name:string}} match Persisted original project identity; cannot be renamed/reclassified.
 * @property {string} sha256 Exact approved original PNG hash, not a QA render/optimization.
 * @property {number} bytes Positive reviewed source byte length.
 * @property {number} width Positive decoded original pixel width.
 * @property {number} height Positive decoded original pixel height.
 * @property {string} caption Approved content-first caption plus complete source credit, no invented claims.
 * @property {string} backupDescription Approved paired accessible fallback.
 * @property {Record<string,string[]>} expectedMedia Every original four-array value/index, including explicit blanks.
 *
 * @typedef {object} ScientificFigurePlan
 * @property {1} version Plan format version.
 * @property {string} migrationId Must equal SCIENTIFIC_FIGURES_MIGRATION_ID.
 * @property {ScientificFigurePatch[]} assets Exactly four approved source images, each once.
 * @property {{match:{id:string,category:string,name:string},expectedMedia:Record<string,string[]>,order:number[]}} filebox Exact independently approved [2,0,1,3,4] existing tuple permutation; no upload.
 */

/**
 * Validates aligned raw tuple sources without inventing or padding old text.
 * @param {object} current Complete original snapshot.
 * @param {object} match Reviewed stable identity/category/name.
 * @param {Record<string,string[]>} expected Exact original four arrays.
 * @param {string} id Pinned approved project identity.
 * @param {string} category Pinned category.
 * @returns {number} Unique raw project index, without chronological reordering.
 * @throws {Error} Identity, original values or tuple alignment differs.
 */
function findProject(current, match, expected, id, category) {
  if (!keysEqual(match, ["id", "category", "name"]) || !Object.values(match).every(value => typeof value === "string") ||
      match.id !== id || match.category !== category || !keysEqual(expected, SCIENTIFIC_MEDIA_FIELDS)) {
    throw new Error("Scientific media requires exact approved project identity and complete original tuples.");
  }
  const matches = current.projects.flatMap((row, index) => row.id === id ? [index] : []);
  if (matches.length !== 1) throw new Error("Scientific media target is missing or ambiguous.");
  const [index] = matches; const row = current.projects[index];
  if (!Object.entries(match).every(([key, value]) => row[key] === value) ||
      SCIENTIFIC_MEDIA_FIELDS.some(field => !strings(row[field]) || row[field].length !== row.imageUrls?.length) ||
      !isDeepStrictEqual(media(row), expected)) throw new Error("Stale or misaligned scientific media source.");
  return index;
}

/**
 * Verifies guarded staging receipts and pins delivery to original PNG bytes.
 * @param {ScientificFigurePatch} asset Approved hash/dimensions/source length.
 * @param {object} receipt Original and delivery verification from staging.
 * @returns {string} Approved account URL with only tr=orig-true.
 * @throws {Error} Receipt, decoded bytes or account/folder checks fail.
 */
function originalUrl(asset, receipt) {
  const original = receipt?.originalVerification;
  if (!receipt || receipt.status !== "verified" || receipt.sourceSha256 !== asset.sha256 || receipt.sourceBytes !== asset.bytes ||
      typeof receipt.provider?.fileId !== "string" || !receipt.provider.fileId || receipt.provider.size !== asset.bytes || receipt.folder !== "/Portfolio-Website/Snippets" ||
      original?.status !== 200 || original.sha256 !== asset.sha256 || original.bytes !== asset.bytes || original.width !== asset.width ||
      original.height !== asset.height || original.format !== "png" || original.pages !== 1 || original.nonblank !== true ||
      receipt.deliveryVerification?.status !== 200 || receipt.deliveryVerification.nonblank !== true || receipt.deliveryVerification.width !== asset.width ||
      receipt.deliveryVerification.height !== asset.height || receipt.deliveryVerification.pages !== 1 || receipt.deliveryVerification.format !== "png") {
    throw new Error("Scientific media needs exact original-byte and decoded delivery staging receipts.");
  }
  let url;
  try { url = new URL(receipt.provider.url); } catch { throw new Error("Scientific media receipt URL is invalid."); }
  if (url.origin !== "https://ik.imagekit.io" || url.username || url.password || url.search || url.hash ||
      !url.pathname.startsWith("/Gustolandia/Portfolio-Website/Snippets/") || !url.pathname.endsWith(".png")) {
    throw new Error("Scientific media receipt is outside the approved account/original PNG folder.");
  }
  url.searchParams.set("tr", "orig-true");
  return url.href;
}

/**
 * Previews four approved real-source figures and one existing Filebox reorder.
 *
 * Uploading is a separate operation performed by stageImageKitAssets. This pure
 * planner accepts only exact source hashes and verified original/decode receipts;
 * no QA images, crops, recolouring, generated plots or delivery transformations
 * are permitted. It appends each approved complete tuple, then promotes that
 * tuple first while preserving every old tuple as an exact following suffix.
 * Filebox only applies the approved complete [2,0,1,3,4] tuple permutation.
 * All non-media raw/public data and every other project's media remain exact,
 * including the freshly polished narrative, curated skills, status, author order,
 * maps, collections, CV, thesis and original record ordering. No delete/list/API
 * operation, startup migration or auth/CORS/CSRF/schema change is introduced.
 * Rights/provenance/captions require independent review and private full licence
 * records; hashes/receipts establish identity, not a public reuse licence.
 *
 * @param {object} current Complete fresh raw Redis snapshot, not a public projection/seed.
 * @param {ScientificFigurePlan} plan Separately confirmed exact sources, captions and original tuple values.
 * @param {object[]} receipts Existing guarded staging receipts, in any order.
 * @param {{alreadyApplied?:boolean}} [options={}] Independent ledger state.
 * @returns {{data:object,report:object,candidateHash:string}} Media-only raw candidate, safe field/ID report and compact raw SHA-256.
 * @throws {Error} Source/receipt/scope/identity/alignment or complete preservation fails.
 */
export function planScientificFiguresMigration(current, plan, receipts, { alreadyApplied = false } = {}) {
  if (!object(current) || !object(current.pages) || !object(current.profile) || !object(current.research) ||
      ["jobs", "education", "projects"].some(key => !Array.isArray(current[key]) || current[key].some(row => !object(row)))) {
    throw new Error("Scientific media requires the complete raw portfolio.");
  }
  const data = structuredClone(current);
  const report = { migrationId: SCIENTIFIC_FIGURES_MIGRATION_ID, alreadyApplied, changed: false, changes: [] };
  const finish = () => ({ data, report, candidateHash: sha(JSON.stringify(data)) });
  if (alreadyApplied) return finish();
  if (!keysEqual(plan, ["version", "migrationId", "assets", "filebox"]) || plan.version !== 1 || plan.migrationId !== SCIENTIFIC_FIGURES_MIGRATION_ID ||
      !Array.isArray(plan.assets) || plan.assets.length !== 4 || !Array.isArray(receipts) || receipts.length !== 4 ||
      receipts.some(item => !object(item) || typeof item.assetId !== "string") ||
      new Set(receipts.map(item => item?.assetId)).size !== 4 || !keysEqual(plan.filebox, ["match", "expectedMedia", "order"]) ||
      !isDeepStrictEqual(plan.filebox.order, [2, 0, 1, 3, 4])) throw new Error("Scientific media requires exactly four approved sources and the reviewed Filebox permutation.");
  const seen = new Set(); const changedIds = new Set();
  for (const asset of plan.assets) {
    if (!keysEqual(asset, ["id", "match", "sha256", "bytes", "width", "height", "caption", "backupDescription", "expectedMedia"]) ||
        ![asset.bytes, asset.width, asset.height].every(value => Number.isSafeInteger(value) && value > 0) || asset.bytes > 15_000_000 ||
        typeof asset.caption !== "string" || !asset.caption.trim() || typeof asset.backupDescription !== "string" || !asset.backupDescription.trim()) {
      throw new Error("Scientific media accepts approved original metadata and paired captions only.");
    }
    const spec = SCIENTIFIC_FIGURE_SOURCES.find(item => item.id === asset.id && item.sha256 === asset.sha256);
    if (!spec || seen.has(asset.id)) throw new Error("Scientific media source is unapproved or duplicate.");
    seen.add(asset.id);
    const index = findProject(current, asset.match, asset.expectedMedia, spec.projectId, spec.category);
    const receipt = receipts.find(item => item.assetId === asset.id); const url = originalUrl(asset, receipt);
    if (current.projects.some(row => row.imageUrls?.includes(url))) throw new Error("Scientific figure URL is already present; inspect the ledger before retrying.");
    const tuple = { imageUrls: url, imageTitles: asset.caption, imageDescriptions: asset.caption, imageBackupDescriptions: asset.backupDescription };
    for (const field of SCIENTIFIC_MEDIA_FIELDS) data.projects[index][field] = [tuple[field], ...current.projects[index][field]];
    changedIds.add(spec.projectId);
    report.changes.push({ id: spec.projectId, assetId: asset.id, fields: [...SCIENTIFIC_MEDIA_FIELDS], oldCount: current.projects[index].imageUrls.length,
      newCount: data.projects[index].imageUrls.length, operation: "append-and-promote-original" });
  }
  const index = findProject(current, plan.filebox.match, plan.filebox.expectedMedia, FILEBOX_ID, "software");
  if (current.projects[index].imageUrls.length !== 5) throw new Error("Filebox requires its exact five original tuples.");
  for (const field of SCIENTIFIC_MEDIA_FIELDS) data.projects[index][field] = plan.filebox.order.map(i => current.projects[index][field][i]);
  changedIds.add(FILEBOX_ID); report.changes.push({ id: FILEBOX_ID, fields: [...SCIENTIFIC_MEDIA_FIELDS], oldCount: 5, newCount: 5, operation: "existing-complete-tuple-permutation" });
  const mask = value => { const copy = structuredClone(value); for (const row of copy.projects) {
    if (changedIds.has(row.id)) for (const field of SCIENTIFIC_MEDIA_FIELDS) delete row[field];
  } return copy; };
  const before = normalizePortfolioData(current);
  const normalized = normalizePortfolioData(data);
  if (!validateCompletePortfolioPayload(normalized).valid || !isDeepStrictEqual(mask(current), mask(data)) ||
      !isDeepStrictEqual(mask(before), mask(normalized))) throw new Error("Scientific media full raw/public field-scope proof failed.");
  for (const row of data.projects.filter(row => changedIds.has(row.id))) {
    const originalPublic = before.projects.find(item => item.id === row.id);
    const expectedPublic = Object.fromEntries(SCIENTIFIC_MEDIA_FIELDS.map(field => [field, row.id === FILEBOX_ID
      ? plan.filebox.order.map(i => originalPublic[field][i]) : [row[field][0], ...originalPublic[field]]]));
    if (!isDeepStrictEqual(media(normalized.projects.find(item => item.id === row.id)), expectedPublic)) throw new Error("Scientific media tuples would shift during API normalization.");
  }
  report.changed = true;
  return finish();
}

/**
 * Previews by default; applies only a separately confirmed media-only candidate.
 * Requires source/candidate hashes, byte-identical prepared original backup and
 * deployed API verification. Existing CAS atomically writes complete original,
 * candidate and independent ledger; stale/concurrent edits abort. A ledger repeat
 * retains later edits/deletions and cannot reinsert removed figures. No uploads
 * happen here; uncertain writes require ledger/readback inspection before retry.
 *
 * @param {Omit<Parameters<typeof migratePortfolioContentRedis>[0], 'migrationId'|'planMigration'> & {plan:ScientificFigurePlan,receipts:object[],expectedCandidateHash?:string}} [options={}] Raw Redis, confirmed plan/staging receipts and explicit guards.
 * @returns {Promise<object>} Safe fields/hashes/backup references, never credentials or full provenance.
 * @throws {Error} Ambiguous mode, source/scope/receipt or backup/hash/deployment/CAS checks fail.
 */
export async function migrateScientificFiguresRedis(options = {}) {
  if (options.dryRun !== undefined && typeof options.dryRun !== "boolean") throw new Error("Scientific media dryRun must be a boolean.");
  if (options.dryRun === false && !/^[a-f0-9]{64}$/.test(options.expectedCandidateHash || "")) throw new Error("Scientific media apply requires the candidate SHA-256.");
  const readBackup = options.backupReader ?? readFile;
  return migratePortfolioContentRedis({ ...options, migrationId: SCIENTIFIC_FIGURES_MIGRATION_ID,
    backupReader: async (path, encoding) => {
      const raw = await readBackup(path, encoding);
      if (typeof raw !== "string" || sha(raw) !== options.expectedHash) throw new Error("Scientific media backup must match exact raw source bytes.");
      return raw;
    },
    planMigration: (current, state) => {
      const result = planScientificFiguresMigration(current, options.plan, options.receipts, state);
      if (options.dryRun === false && !state.alreadyApplied && result.candidateHash !== options.expectedCandidateHash) throw new Error("Scientific media candidate differs from the confirmed preview.");
      return result;
    }
  });
}
