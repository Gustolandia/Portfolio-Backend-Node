const IMAGEKIT_LIST_FILES_URL = "https://api.imagekit.io/v1/files";
const DEFAULT_MEDIA_ROOT = "/Portfolio Website";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const ALLOWED_SORT_VALUES = new Set([
  "ASC_CREATED",
  "DESC_CREATED",
  "ASC_UPDATED",
  "DESC_UPDATED",
  "ASC_NAME",
  "DESC_NAME",
  "ASC_SIZE",
  "DESC_SIZE",
  "ASC_HEIGHT",
  "DESC_HEIGHT",
  "ASC_WIDTH",
  "DESC_WIDTH"
]);

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function safeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function parseInteger(value, { defaultValue, max, min }) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsedValue, min), max);
}

function encodeImageKitPath(path) {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function joinUrlEndpointAndPath(urlEndpoint, filePath) {
  const endpoint = safeString(urlEndpoint).replace(/\/$/, "");

  if (!endpoint || !filePath) {
    return "";
  }

  return `${endpoint}${encodeImageKitPath(filePath)}`;
}

export class ImageKitMediaPathError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImageKitMediaPathError";
  }
}

/**
 * Normalizes one ImageKit Media Library asset for frontend CMS pickers.
 *
 * Only public asset metadata and delivery URLs are returned. API credentials,
 * private keys, and raw provider response internals are never exposed.
 *
 * @param {Record<string, unknown>} asset ImageKit file response item.
 * @param {{urlEndpoint: string}} options URL generation options.
 * @returns {Record<string, string | number>} Public asset summary.
 */
export function normalizeImageKitAsset(asset, { urlEndpoint }) {
  const filePath = safeString(asset.filePath);
  const url = safeString(asset.url) || joinUrlEndpointAndPath(urlEndpoint, filePath);
  const fileId = safeString(asset.fileId) || safeString(asset.id);

  return {
    fileId,
    id: fileId,
    name: safeString(asset.name),
    filePath,
    url,
    thumbnailUrl: safeString(asset.thumbnail) || safeString(asset.thumbnailUrl) || url,
    fileType: safeString(asset.fileType),
    mime: safeString(asset.mime) || safeString(asset.mimeType),
    size: safeNumber(asset.size),
    width: safeNumber(asset.width),
    height: safeNumber(asset.height),
    createdAt: safeString(asset.createdAt),
    updatedAt: safeString(asset.updatedAt)
  };
}

export class ImageKitMediaService {
  constructor({
    fetcher = fetch,
    getPrivateKey = () => process.env.IMAGEKIT_PRIVATE_KEY,
    getUrlEndpoint = () => process.env.IMAGEKIT_URL_ENDPOINT,
    mediaRoot = process.env.IMAGEKIT_MEDIA_FOLDER || DEFAULT_MEDIA_ROOT,
    imageFolder = process.env.IMAGEKIT_IMAGES_FOLDER,
    fileFolder = process.env.IMAGEKIT_FILES_FOLDER
  } = {}) {
    this.fetcher = fetcher;
    this.getPrivateKey = getPrivateKey;
    this.getUrlEndpoint = getUrlEndpoint;
    this.mediaRoot = normalizeAbsolutePath(mediaRoot, DEFAULT_MEDIA_ROOT);
    this.imageFolder = normalizeAbsolutePath(
      imageFolder || `${this.mediaRoot}/Photos`,
      `${this.mediaRoot}/Photos`
    );
    this.fileFolder = normalizeAbsolutePath(
      fileFolder || `${this.mediaRoot}/Snippets`,
      `${this.mediaRoot}/Snippets`
    );
  }

  /**
   * Lists image assets from the configured ImageKit media folder.
   *
   * @param {Record<string, string | undefined>} query Request query parameters.
   * @returns {Promise<{images: object[], path: string, limit: number, skip: number, sort: string}>} Images response.
   */
  async listImages(query = {}) {
    const result = await this.listAssets({
      defaultPath: this.imageFolder,
      fileType: "image",
      query
    });

    return {
      images: result.assets,
      path: result.path,
      limit: result.limit,
      skip: result.skip,
      sort: result.sort
    };
  }

  /**
   * Lists non-image assets from the configured ImageKit media folder.
   *
   * @param {Record<string, string | undefined>} query Request query parameters.
   * @returns {Promise<{files: object[], path: string, limit: number, skip: number, sort: string}>} Files response.
   */
  async listFiles(query = {}) {
    const result = await this.listAssets({
      defaultPath: this.fileFolder,
      fileType: "non-image",
      query
    });

    return {
      files: result.assets,
      path: result.path,
      limit: result.limit,
      skip: result.skip,
      sort: result.sort
    };
  }

  async listAssets({ defaultPath, fileType, query }) {
    const privateKey = safeString(this.getPrivateKey()).trim();
    const urlEndpoint = safeString(this.getUrlEndpoint()).trim();

    if (!privateKey) {
      throw new Error("IMAGEKIT_PRIVATE_KEY is required.");
    }

    if (!urlEndpoint) {
      throw new Error("IMAGEKIT_URL_ENDPOINT is required.");
    }

    const path = this.resolvePath(query.path || query.folder, defaultPath);
    const limit = parseInteger(query.limit, {
      defaultValue: DEFAULT_LIMIT,
      max: MAX_LIMIT,
      min: 1
    });
    const skip = parseInteger(query.skip, {
      defaultValue: 0,
      max: Number.MAX_SAFE_INTEGER,
      min: 0
    });
    const requestedSort = safeString(query.sort).trim().toUpperCase();
    const sort = ALLOWED_SORT_VALUES.has(requestedSort) ? requestedSort : "ASC_CREATED";
    const requestUrl = new URL(IMAGEKIT_LIST_FILES_URL);

    requestUrl.searchParams.set("type", "file");
    requestUrl.searchParams.set("fileType", fileType);
    requestUrl.searchParams.set("path", path);
    requestUrl.searchParams.set("limit", String(limit));
    requestUrl.searchParams.set("skip", String(skip));
    requestUrl.searchParams.set("sort", sort);

    const response = await this.fetcher(requestUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`
      }
    });

    if (!response.ok) {
      throw new Error(`ImageKit list files request failed with status ${response.status}.`);
    }

    const data = await response.json();
    const assets = Array.isArray(data)
      ? data
      : Array.isArray(data?.items)
        ? data.items
        : [];

    return {
      assets: assets.map((asset) => normalizeImageKitAsset(asset, { urlEndpoint })),
      path,
      limit,
      skip,
      sort
    };
  }

  resolvePath(requestedPath, defaultPath) {
    if (!requestedPath) {
      return defaultPath;
    }

    const rawPath = safeString(requestedPath).trim();
    const pathWithinRoot = rawPath.startsWith("/")
      ? rawPath
      : `${this.mediaRoot}/${rawPath}`;
    const candidatePath = normalizeAbsolutePath(pathWithinRoot, defaultPath);

    if (!isPathWithinRoot(candidatePath, this.mediaRoot)) {
      throw new ImageKitMediaPathError("Requested media path is outside the configured root.");
    }

    return candidatePath;
  }
}

export function createImageKitMediaService(options = {}) {
  return new ImageKitMediaService(options);
}
