import { createHmac, randomUUID } from "node:crypto";

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const DEFAULT_MEDIA_ROOT = "/Portfolio Website";
const DEFAULT_UPLOAD_EXPIRES_IN_SECONDS = 600;
const MAX_UPLOAD_EXPIRES_IN_SECONDS = 3599;
const MIN_UPLOAD_EXPIRES_IN_SECONDS = 60;

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function normalizeAbsolutePath(value, fallback = "/") {
  const rawPath = safeString(value).trim() || fallback;
  const pathWithLeadingSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const collapsedPath = pathWithLeadingSlash.replace(/\/{2,}/g, "/");

  if (collapsedPath === "/") {
    return collapsedPath;
  }

  return collapsedPath.replace(/\/$/, "");
}

function isPathWithinRoot(path, rootPath) {
  return path === rootPath || path.startsWith(`${rootPath}/`);
}

function normalizeFolderWithinRoot(value, fallback, rootPath) {
  const folderPath = normalizeAbsolutePath(value || fallback, fallback);

  if (!isPathWithinRoot(folderPath, rootPath)) {
    throw new ImageKitMediaPathError("Configured media folder is outside the configured root.");
  }

  return folderPath;
}

function parseInteger(value, { defaultValue, max, min }) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsedValue, min), max);
}

export class ImageKitMediaPathError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageKitMediaPathError";
  }
}

/**
 * Creates ImageKit browser-upload authentication without exposing media lists.
 *
 * The portfolio payload stored in Redis remains the source of truth for asset
 * URLs. This service only signs short-lived direct-upload requests for
 * configured folders.
 */
export class ImageKitMediaService {
  constructor({
    getPrivateKey = () => process.env.IMAGEKIT_PRIVATE_KEY,
    getPublicKey = () => process.env.IMAGEKIT_PUBLIC_KEY,
    getUrlEndpoint = () => process.env.IMAGEKIT_URL_ENDPOINT,
    mediaRoot = process.env.IMAGEKIT_MEDIA_FOLDER || DEFAULT_MEDIA_ROOT,
    fileFolder = process.env.IMAGEKIT_FILES_FOLDER,
    photosFolder = process.env.IMAGEKIT_PHOTOS_FOLDER,
    snippetsFolder = process.env.IMAGEKIT_SNIPPETS_FOLDER || process.env.IMAGEKIT_IMAGES_FOLDER
  } = {}) {
    this.getPrivateKey = getPrivateKey;
    this.getPublicKey = getPublicKey;
    this.getUrlEndpoint = getUrlEndpoint;
    this.mediaRoot = normalizeAbsolutePath(mediaRoot, DEFAULT_MEDIA_ROOT);
    const defaultPhotosFolder = `${this.mediaRoot}/Photos`;
    const defaultSnippetsFolder = `${this.mediaRoot}/Snippets`;

    this.fileFolder = normalizeFolderWithinRoot(fileFolder, this.mediaRoot, this.mediaRoot);
    this.photosFolder = normalizeFolderWithinRoot(
      photosFolder,
      defaultPhotosFolder,
      this.mediaRoot
    );
    this.snippetsFolder = normalizeFolderWithinRoot(
      snippetsFolder,
      defaultSnippetsFolder,
      this.mediaRoot
    );
  }

  /**
   * Creates short-lived authentication parameters for direct browser uploads.
   *
   * The frontend sends the returned `token`, `expire`, `signature`, and
   * `publicKey` to ImageKit's browser upload API. The private key is used only
   * here to sign the upload token and is never returned to the frontend.
   *
   * @param {Record<string, string | undefined>} query Upload target options. `target`
   * may be `files`, `photos`, or `snippets`; custom frontend-provided folders
   * are rejected so uploads stay inside the configured portfolio folders.
   * @returns {{token: string, expire: number, signature: string, publicKey: string, urlEndpoint: string, uploadEndpoint: string, folder: string, folders: object}} Upload auth payload.
   */
  getUploadAuthentication(query = {}) {
    const privateKey = safeString(this.getPrivateKey()).trim();
    const publicKey = safeString(this.getPublicKey()).trim();
    const urlEndpoint = safeString(this.getUrlEndpoint()).trim();

    if (!privateKey) {
      throw new Error("IMAGEKIT_PRIVATE_KEY is required.");
    }

    if (!publicKey) {
      throw new Error("IMAGEKIT_PUBLIC_KEY is required.");
    }

    if (!urlEndpoint) {
      throw new Error("IMAGEKIT_URL_ENDPOINT is required.");
    }

    const token = randomUUID();
    const expiresInSeconds = parseInteger(query.expiresInSeconds, {
      defaultValue: DEFAULT_UPLOAD_EXPIRES_IN_SECONDS,
      max: MAX_UPLOAD_EXPIRES_IN_SECONDS,
      min: MIN_UPLOAD_EXPIRES_IN_SECONDS
    });
    const expire = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = createHmac("sha1", privateKey)
      .update(`${token}${expire}`)
      .digest("hex");
    const folders = this.uploadFolders();

    return {
      token,
      expire,
      signature,
      publicKey,
      urlEndpoint,
      uploadEndpoint: IMAGEKIT_UPLOAD_URL,
      folder: this.resolveUploadFolder(query),
      folders
    };
  }

  /**
   * Resolves the configured upload folder for a supported media target.
   *
   * @param {Record<string, string | undefined>} query Upload target query.
   * @returns {string} ImageKit folder path for the direct upload.
   */
  resolveUploadFolder(query = {}) {
    if (query.path || query.folder) {
      throw new ImageKitMediaPathError("Custom upload folders are not supported.");
    }

    const target = safeString(query.target).trim().toLowerCase();
    const folders = this.uploadFolders();

    if (target === "files") {
      return folders.files;
    }

    if (target === "photos") {
      return folders.photos;
    }

    if (target === "snippets") {
      return folders.snippets;
    }

    return folders.snippets;
  }

  /**
   * Returns the server-controlled folders available for upload targets.
   *
   * @returns {{files: string, photos: string, snippets: string}} Upload folder map.
   */
  uploadFolders() {
    return {
      files: this.fileFolder,
      photos: this.photosFolder,
      snippets: this.snippetsFolder
    };
  }
}

export function createImageKitMediaService(options = {}) {
  return new ImageKitMediaService(options);
}
