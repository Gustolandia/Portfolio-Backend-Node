export const PAGE_KEYS = Object.freeze([
  "home",
  "experience",
  "education",
  "projects",
  "contact"
]);

export const JOB_FIELDS = Object.freeze([
  "title",
  "company",
  "location",
  "start",
  "end",
  "imageUrls",
  "imageTitles",
  "duties",
  "skills",
  "mapLocation"
]);

export const EDUCATION_FIELDS = Object.freeze([
  "degree",
  "institution",
  "location",
  "grade",
  "start",
  "end",
  "imageUrls",
  "imageTitles",
  "courses",
  "activities",
  "skills",
  "mapLocation"
]);

export const PROJECT_FIELDS = Object.freeze([
  "name",
  "dateOfCompletion",
  "description",
  "imageUrls",
  "affiliations",
  "collaborators",
  "skills",
  "links",
  "linksTitles"
]);

const ARRAY_FIELDS = new Set([
  "affiliations",
  "activities",
  "collaborators",
  "courses",
  "duties",
  "imageTitles",
  "imageUrls",
  "links",
  "linksTitles",
  "skills"
]);

const TOP_LEVEL_KEYS = Object.freeze(["pages", "jobs", "education", "projects"]);
const OPEN_ENDED_DATE_VALUES = new Set(["current", "now", "ongoing", "present"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function cloneJsonObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === "string");
}

/**
 * Normalizes a fixed page entry and removes unsupported page fields.
 *
 * @param {unknown} value Candidate page object.
 * @returns {{title: string, description: string, imageUrl: string}} Safe page payload.
 */
export function normalizePage(value) {
  const page = isObject(value) ? value : {};

  return {
    title: safeString(page.title),
    description: safeString(page.description),
    imageUrl: safeString(page.imageUrl)
  };
}

/**
 * Preserves only JSON objects in a generic content array.
 *
 * @param {unknown} value Candidate content array.
 * @returns {Record<string, unknown>[]} Deep-cloned object entries.
 */
export function normalizeContentArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map(cloneJsonObject);
}

/**
 * Normalizes one rich portfolio item to the configured field allow-list.
 *
 * Fields not present in the allow-list are discarded. String fields default to
 * an empty string, and array fields default to an empty array.
 *
 * @param {unknown} value Candidate rich portfolio item.
 * @param {readonly string[]} allowedFields Field names to keep.
 * @returns {Record<string, string | string[]>} Safe rich item.
 */
export function normalizeRichItem(value, allowedFields) {
  const source = isObject(value) ? value : {};

  return Object.fromEntries(
    allowedFields
      .map((field) => [
        field,
        ARRAY_FIELDS.has(field) ? safeStringArray(source[field]) : safeString(source[field])
      ])
  );
}

function parseSortableDate(value) {
  if (typeof value !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return Number.NEGATIVE_INFINITY;
  }

  if (OPEN_ENDED_DATE_VALUES.has(normalizedValue.toLowerCase())) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = Date.parse(normalizedValue);

  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function sortByLatestDate(items, dateFields) {
  return items
    .map((item, index) => ({
      index,
      item,
      timestamp: Math.max(...dateFields.map((field) => parseSortableDate(item[field])))
    }))
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

/**
 * Normalizes and sorts a rich portfolio collection.
 *
 * Sorting is descending by the latest configured date field so the most recent
 * job, education entry, or project appears first in the API payload and in
 * persisted storage.
 *
 * @param {unknown} value Candidate rich item array.
 * @param {readonly string[]} allowedFields Field names to keep.
 * @param {readonly string[]} dateFields Date-like fields used for ordering.
 * @returns {Record<string, string | string[]>[]} Normalized, sorted entries.
 */
export function normalizeRichArray(value, allowedFields, dateFields = []) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedItems = value
    .filter(isObject)
    .map((item) => normalizeRichItem(item, allowedFields));

  return sortByLatestDate(normalizedItems, dateFields);
}

/**
 * Builds the complete public/admin portfolio payload.
 *
 * The returned payload removes deprecated fields such as `duration`, keeps only
 * the supported page and rich-item fields, defaults missing strings/arrays to
 * safe empty values, and sorts jobs, education, and projects by most recent end
 * date first.
 *
 * @param {unknown} value Candidate portfolio payload.
 * @returns {{pages: Record<string, {title: string, description: string, imageUrl: string}>, jobs: object[], education: object[], projects: object[]}} Normalized portfolio payload.
 */
export function normalizePortfolioData(value = {}) {
  const source = isObject(value) ? value : {};
  const sourcePages = isObject(source.pages) ? source.pages : {};
  const pages = Object.fromEntries(
    PAGE_KEYS.map((pageKey) => [pageKey, normalizePage(sourcePages[pageKey])])
  );

  return {
    pages,
    jobs: normalizeRichArray(source.jobs, JOB_FIELDS, ["end", "start"]),
    education: normalizeRichArray(source.education, EDUCATION_FIELDS, ["end", "start"]),
    projects: normalizeRichArray(source.projects, PROJECT_FIELDS, ["dateOfCompletion"])
  };
}

/**
 * Validates that an admin save request contains a complete portfolio payload.
 *
 * Rich item unknown fields are intentionally not rejected here because
 * normalization discards them, preserving the existing admin editing behavior.
 *
 * @param {unknown} value Candidate request body.
 * @returns {{valid: boolean, errors: string[]}} Validation result and messages.
 */
export function validateCompletePortfolioPayload(value) {
  const errors = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: ["Payload must be a JSON object."]
    };
  }

  const unknownTopLevelKeys = Object.keys(value).filter(
    (key) => !TOP_LEVEL_KEYS.includes(key)
  );

  if (unknownTopLevelKeys.length > 0) {
    errors.push(`Unknown top-level keys: ${unknownTopLevelKeys.join(", ")}.`);
  }

  for (const key of TOP_LEVEL_KEYS) {
    if (!Object.hasOwn(value, key)) {
      errors.push(`Missing required top-level key: ${key}.`);
    }
  }

  if (!isObject(value.pages)) {
    errors.push("pages must be an object.");
  } else {
    const unknownPageKeys = Object.keys(value.pages).filter(
      (key) => !PAGE_KEYS.includes(key)
    );

    if (unknownPageKeys.length > 0) {
      errors.push(`Unknown page keys: ${unknownPageKeys.join(", ")}.`);
    }

    for (const pageKey of PAGE_KEYS) {
      if (!isObject(value.pages[pageKey])) {
        errors.push(`pages.${pageKey} must be an object.`);
      }
    }
  }

  for (const arrayKey of ["jobs", "education", "projects"]) {
    if (!Array.isArray(value[arrayKey])) {
      errors.push(`${arrayKey} must be an array.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
