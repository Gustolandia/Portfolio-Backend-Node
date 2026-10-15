import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const EXTENSIONS = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" };
const FORMATS = { "image/jpeg": "jpeg", "image/jpg": "jpeg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg", "image/gif": "gif" };
const PROVIDER_FIELDS = ["fileId", "name", "url", "filePath", "size", "fileType", "width", "height"];
const RECEIPT_FIELDS = ["version", "assetId", "sourceSha256", "sourceBytes", "folder", "reused", "fileName", "status", "startedAt", "httpStatus"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * @typedef {object} SelectedImageAsset
 * @property {string} id Unique safe receipt/file identifier.
 * @property {string} localPath Existing source file inside the approved realpath root.
 * @property {string} sha256 Reviewed lowercase source SHA-256.
 * @property {number} bytes Reviewed source length, between 1 and 15,000,000 bytes.
 * @property {string} mime Supported JPEG, PNG, WebP, SVG or GIF MIME type.
 * @property {number} width Positive decoded source width.
 * @property {number} height Positive decoded source height.
 * @property {'photos'|'snippets'} target Server-controlled destination selector.
 * @property {string} [deliveryTransform] Reviewed limited ImageKit transformation.
 */

/**
 * @typedef {object} DecodedImage
 * @property {number} width Positive integer pixel width.
 * @property {number} height Positive integer pixel height.
 * @property {number} pages Positive integer frame/page count; one for a still image.
 * @property {'jpeg'|'png'|'webp'|'svg'|'gif'} format Actual decoded format.
 * @property {boolean} nonblank Actual decoded-pixel check, not a MIME-only assertion.
 */

/**
 * @typedef {object} StagedAssetReceipt
 * @property {string} assetId Original selected asset ID.
 * @property {string} sourceSha256 Reviewed source digest, never replaced by decoder fields.
 * @property {string} folder Approved upload folder.
 * @property {'verified'} status Successful completion state.
 * @property {object} provider Allow-listed public upload response fields only.
 * @property {DecodedImage & {status:number,bytes:number,sha256:string}} originalVerification Exact source-byte verification.
 * @property {DecodedImage & {status:number,bytes:number,sha256:string}} deliveryVerification Decoded delivery and frame verification.
 * @property {string} deliveryUrl Verified public URL for later separate portfolio save.
 */

function pickFields(value, fields) {
  return Object.fromEntries(fields.filter((field) => value?.[field] !== undefined).map((field) => [field, value[field]]));
}

function providerMetadata(value) {
  return Object.fromEntries(Object.entries(pickFields(value, PROVIDER_FIELDS)).filter(([field, entry]) =>
    ["size", "width", "height"].includes(field) ? Number.isSafeInteger(entry) && entry > 0 : typeof entry === "string"));
}

async function readReceipt(path) {
  try {
    const stored = JSON.parse(await readFile(path, "utf8"));
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) throw new Error("Invalid upload receipt; review before resuming.");
    const fields = Object.fromEntries(Object.entries(pickFields(stored, RECEIPT_FIELDS)).filter(([field, value]) => {
      if (field === "reused") return typeof value === "boolean";
      if (["version", "sourceBytes", "httpStatus"].includes(field)) return Number.isSafeInteger(value) && value > 0;
      return typeof value === "string";
    }));
    return { ...fields, ...(stored.provider ? { provider: providerMetadata(stored.provider) } : {}) };
  }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function persistReceipt(path, receipt, initial = false) {
  const text = JSON.stringify(receipt, null, 2);
  if (initial) return writeFile(path, text, { flag: "wx" });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, text, { flag: "wx" });
  await rename(temporary, path);
}

function validateAsset(asset) {
  if (!asset || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(asset.id) ||
      !/^[a-f0-9]{64}$/.test(asset.sha256) || !EXTENSIONS[asset.mime] ||
      !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > 15_000_000 ||
      !Number.isSafeInteger(asset.width) || asset.width < 1 ||
      !Number.isSafeInteger(asset.height) || asset.height < 1 ||
      !["photos", "snippets"].includes(asset.target) ||
      (asset.deliveryTransform !== undefined && !/^(?:(?:w-\d{1,4}|f-png|bg-[A-Fa-f0-9]{6}),?)+$/.test(asset.deliveryTransform))) {
    throw new Error("Invalid selected asset metadata; review the manifest.");
  }
}

function validateProvider(provider, { asset, folder, urlEndpoint }) {
  const base = new URL(`${urlEndpoint.replace(/\/$/, "")}/`);
  const url = new URL(provider.url);
  const expectedPrefix = `${base.pathname.replace(/\/$/, "")}${folder}/`;
  if (url.protocol !== "https:" || url.origin !== base.origin || url.username || url.password ||
      url.search || url.hash || !decodeURIComponent(url.pathname).startsWith(expectedPrefix) ||
      typeof provider.fileId !== "string" || !provider.fileId || provider.size !== asset.bytes) {
    throw new Error("Upload receipt does not match the approved account, folder and source size.");
  }
}

async function fetchImage(url, { fetchImpl, inspectImage }) {
  const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(45_000) });
  if (!response.ok || !/^image\//i.test(response.headers.get("content-type") || "")) {
    throw new Error("A staged public image did not return an image response.");
  }
  const parts = [];
  let length = 0;
  for await (const part of response.body) {
    length += part.length;
    if (length > 20_000_000) throw new Error("Staged image response exceeds the verification limit.");
    parts.push(part);
  }
  const bytes = Buffer.concat(parts);
  const metadata = await inspectImage(bytes);
  if (![metadata.width, metadata.height, metadata.pages].every((value) => Number.isSafeInteger(value) && value > 0) ||
      !Object.values(FORMATS).includes(metadata.format) || metadata.nonblank !== true) {
    throw new Error("A staged public image failed decoding or nonblank verification.");
  }
  return { status: response.status, bytes: bytes.length, sha256: sha256(bytes),
    ...pickFields(metadata, ["width", "height", "format", "pages", "nonblank"]) };
}

/**
 * Stages only selected, hash-pinned local images; never lists, deletes or updates assets.
 *
 * All selected files are validated before the first upload. Each unique upload has
 * a durable intent receipt before its single POST. Successful uploads resume at
 * verification, not POST; an uncertain outcome requires manual inspection. Normal
 * CDN delivery and original-byte SHA-256 are verified separately. Receipts contain
 * public allow-listed provider/decoder metadata only, never private keys, debug
 * fields or authorization headers, including reused and resumed receipts.
 * No Redis call or endpoint change occurs here. The caller must independently
 * approve a separate media-only content candidate before applying it.
 *
 * @param {object} options Staging dependencies and approved inputs.
 * @param {{assets: SelectedImageAsset[]}} options.manifest Reviewed selected assets.
 * @param {string} options.selectedDirectory Allowed local source directory.
 * @param {string} options.receiptDirectory Ignored durable receipt directory.
 * @param {string} options.privateKey Server-only ImageKit upload credential.
 * @param {string} options.urlEndpoint Approved HTTPS ImageKit account endpoint.
 * @param {{photos: string, snippets: string}} options.folders Approved server-controlled upload folders.
 * @param {(bytes:Buffer) => Promise<DecodedImage>} options.inspectImage Actual image-byte decoder; unrelated/debug metadata is discarded.
 * @param {typeof fetch} [options.fetchImpl=fetch] HTTP transport, injectable for isolated tests.
 * @param {object} [options.existingUploads={}] Previously verified uploads indexed by selected asset ID.
 * @param {Function} [options.onProgress] Public progress callback after each verified asset.
 * @returns {Promise<StagedAssetReceipt[]>} Verified source-to-public URL receipts in manifest order.
 */
export async function stageImageKitAssets({ manifest, selectedDirectory, receiptDirectory,
  privateKey, urlEndpoint, folders, inspectImage, fetchImpl = fetch, existingUploads = {}, onProgress = () => {} }) {
  if (!manifest || !Array.isArray(manifest.assets) || !manifest.assets.length ||
      new Set(manifest.assets.map((asset) => asset.id)).size !== manifest.assets.length ||
      typeof privateKey !== "string" || !privateKey || typeof inspectImage !== "function" ||
      !/^https:\/\/ik\.imagekit\.io\/[a-zA-Z0-9_-]+\/?$/.test(urlEndpoint) ||
      !folders || [folders.photos, folders.snippets].some((folder) => !/^\/[a-zA-Z0-9_/-]+$/.test(folder))) {
    throw new Error("Staging requires approved asset inputs, decoder and server configuration.");
  }
  const selectedRoot = await realpath(selectedDirectory);
  const sources = [];
  for (const asset of manifest.assets) {
    validateAsset(asset);
    const sourcePath = await realpath(asset.localPath);
    const within = relative(selectedRoot, sourcePath);
    if (within.startsWith("..") || isAbsolute(within) || !within) throw new Error("Selected asset escapes the approved source directory.");
    const bytes = await readFile(sourcePath);
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error("Selected asset bytes differ from the approved manifest.");
    if (asset.mime === "image/svg+xml" && /<(?:script|foreignObject|iframe)\b|\bon[a-z]+\s*=|(?:href|url)\s*[=(]\s*["']?\s*(?:https?:|data:|javascript:|\/\/)/i.test(bytes.toString("utf8"))) {
      throw new Error("Selected SVG contains unsupported active or external content.");
    }
    const metadata = await inspectImage(bytes);
    if (metadata.width !== asset.width || metadata.height !== asset.height || metadata.format !== FORMATS[asset.mime] ||
        !Number.isSafeInteger(metadata.pages) || metadata.pages < 1 || metadata.nonblank !== true) {
      throw new Error(`Selected asset dimensions or content need review: ${asset.id}.`);
    }
    sources.push({ asset, bytes, metadata });
  }
  await mkdir(receiptDirectory, { recursive: true });
  const results = [];
  for (const { asset, bytes, metadata } of sources) {
    const path = join(receiptDirectory, `${asset.id}.stage.json`);
    const folder = folders[asset.target];
    let receipt = await readReceipt(path);
    if (receipt && (receipt.assetId !== asset.id || receipt.sourceSha256 !== asset.sha256 || receipt.folder !== folder)) {
      throw new Error("An existing upload receipt differs from the approved source or folder.");
    }
    if (!receipt && existingUploads[asset.id]) {
      receipt = { version: 1, assetId: asset.id, sourceSha256: asset.sha256, folder,
        sourceBytes: asset.bytes, reused: true, provider: providerMetadata(existingUploads[asset.id]), status: "uploaded" };
      validateProvider(receipt.provider, { asset, folder, urlEndpoint });
      await persistReceipt(path, receipt, true);
    }
    if (receipt && !receipt.provider) throw new Error("Upload outcome requires review; automatic re-upload is prohibited.");
    if (!receipt) {
      const fileName = `${asset.id}-${asset.sha256.slice(0, 12)}-${randomUUID()}.${EXTENSIONS[asset.mime]}`;
      receipt = { version: 1, assetId: asset.id, sourceSha256: asset.sha256, sourceBytes: asset.bytes,
        folder, fileName, status: "upload-outcome-uncertain", startedAt: new Date().toISOString() };
      await persistReceipt(path, receipt, true);
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: asset.mime }), fileName);
      form.append("fileName", fileName);
      form.append("folder", folder);
      form.append("useUniqueFileName", "true");
      form.append("overwriteFile", "false");
      form.append("isPrivateFile", "false");
      const response = await fetchImpl(UPLOAD_URL, { method: "POST", redirect: "error",
        signal: AbortSignal.timeout(60_000), headers: { Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}` }, body: form });
      if (!response.ok) {
        receipt.httpStatus = response.status;
        receipt.status = "upload-rejected-review-required";
        await persistReceipt(path, receipt);
        throw new Error(`Selected upload rejected with HTTP ${response.status}; inspect before retrying.`);
      }
      const uploaded = await response.json();
      receipt.provider = providerMetadata(uploaded);
      receipt.status = "uploaded";
      await persistReceipt(path, receipt);
    }
    validateProvider(receipt.provider, { asset, folder, urlEndpoint });
    const originalUrl = new URL(receipt.provider.url);
    originalUrl.searchParams.set("tr", "orig-true");
    const original = await fetchImage(originalUrl.href, { fetchImpl, inspectImage });
    if (original.sha256 !== asset.sha256 || original.bytes !== asset.bytes ||
        original.width !== asset.width || original.height !== asset.height || original.pages !== metadata.pages) {
      throw new Error("Stored original differs from the complete selected source.");
    }
    const deliveryUrl = new URL(receipt.provider.url);
    if (asset.deliveryTransform) deliveryUrl.searchParams.set("tr", asset.deliveryTransform);
    else if (metadata.pages > 1) deliveryUrl.searchParams.set("tr", "orig-true");
    const delivery = await fetchImage(deliveryUrl.href, { fetchImpl, inspectImage });
    if (metadata.pages > 1 && delivery.pages !== metadata.pages) throw new Error("Staged delivery lost animation frames.");
    receipt = { ...receipt, status: "verified", verifiedAt: new Date().toISOString(),
      deliveryUrl: deliveryUrl.href, originalVerification: original, deliveryVerification: delivery };
    await persistReceipt(path, receipt);
    results.push(receipt);
    await onProgress({ assetId: asset.id, verified: results.length, total: sources.length, reused: Boolean(receipt.reused) });
  }
  return results;
}
