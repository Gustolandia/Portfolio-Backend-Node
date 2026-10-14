import {
  EDUCATION_STATUSES,
  JOB_CATEGORIES,
  PROFILE_FIELDS,
  PROJECT_CATEGORIES,
  PROJECT_OUTPUT_TYPES,
  PROJECT_STATUSES,
  RESEARCH_FIELDS,
  THESIS_STATUSES,
  normalizeAcademicItem,
  normalizeProfile,
  normalizeResearch
} from "./academicMetadata.js";
import { isSafePublicUrl, normalizePublicUrl } from "./publicUrl.js";
import { normalizeSkills } from "../content/skillAliases.js";

export const PAGE_KEYS = Object.freeze([
  "home",
  "experience",
  "education",
  "projects",
  "contact"
]);

export const JOB_FIELDS = Object.freeze([
  "id",
  "category",
  "title",
  "company",
  "location",
  "start",
  "end",
  "imageUrls",
  "imageTitles",
  "imageDescriptions",
  "imageBackupDescriptions",
  "duties",
  "skills",
  "mapLocation"
]);

export const EDUCATION_FIELDS = Object.freeze([
  "status",
  "degree",
  "institution",
  "location",
  "grade",
  "start",
  "end",
  "imageUrls",
  "imageTitles",
  "imageDescriptions",
  "imageBackupDescriptions",
  "courses",
  "activities",
  "skills",
  "mapLocation"
]);

export const PROJECT_FIELDS = Object.freeze([
  "id",
  "category",
  "outputType",
  "status",
  "contribution",
  "relatedRoleIds",
  "authors",
  "name",
  "dateOfCompletion",
  "description",
  "imageUrls",
  "imageTitles",
  "imageDescriptions",
  "imageBackupDescriptions",
  "affiliations",
  "collaborators",
  "skills",
  "links",
  "linksTitles",
  "linksDescriptions",
  "linksBackupDescriptions"
]);

const ARRAY_FIELDS = new Set([
  "authors",
  "affiliations",
  "activities",
  "collaborators",
  "courses",
  "duties",
  "imageBackupDescriptions",
  "imageDescriptions",
  "imageTitles",
  "imageUrls",
  "links",
  "linksBackupDescriptions",
  "linksDescriptions",
  "linksTitles",
  "relatedRoleIds",
  "skills"
]);

const REQUIRED_TOP_LEVEL_KEYS = Object.freeze(["pages", "jobs", "education", "projects"]);
const TOP_LEVEL_KEYS = Object.freeze([...REQUIRED_TOP_LEVEL_KEYS, "profile", "research"]);
const ID_PATTERN = /^[a-z\d][a-z\d._:-]{0,127}$/i;
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

function sourceArray(source, field) {
  return Array.isArray(source[field]) ? source[field] : [];
}

function stringAt(source, field, index) {
  return safeString(sourceArray(source, field)[index]);
}

function firstStringAt(source, fields, index) {
  for (const field of fields) {
    const value = stringAt(source, field, index);

    if (value) {
      return value;
    }
  }

  return "";
}

/**
 * Normalizes a primary URL/link array and its same-index metadata arrays.
 *
 * The primary field controls which rows survive. If a primary value is not a
 * safe, non-empty URL, all related metadata at that index is discarded too, which
 * preserves one-to-one ordering between URLs, descriptions, and fallback text.
 *
 * @param {Record<string, unknown>} source Source rich item.
 * @param {string} primaryField Primary URL/link array field.
 * @param {string[]} relatedFields Same-index metadata fields to normalize.
 * @param {Record<string, string[]>} aliases Fields that may provide fallback values.
 * @returns {Record<string, string[]>} Normalized primary and related arrays.
 */
function normalizeRelatedStringArrays(source, primaryField, relatedFields, aliases = {}) {
  const primaryValues = Array.isArray(source[primaryField]) ? source[primaryField] : [];
  const primary = [];
  const related = Object.fromEntries(relatedFields.map((field) => [field, []]));

  primaryValues.forEach((primaryValue, index) => {
    const url = normalizePublicUrl(primaryValue);

    if (!url) {
      return;
    }

    primary.push(url);
    for (const field of relatedFields) {
      related[field].push(firstStringAt(source, aliases[field] || [field], index));
    }
  });

  return {
    [primaryField]: primary,
    ...related
  };
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
    imageUrl: normalizePublicUrl(page.imageUrl)
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
 * an empty string, and array fields default to an empty array. IDs, placement
 * and academic status use conservative legacy migration rules. Unsafe media
 * URLs and their same-index metadata are removed together.
 *
 * @param {unknown} value Candidate rich portfolio item.
 * @param {readonly string[]} allowedFields Field names to keep.
 * @returns {Record<string, string | string[]>} Safe rich item.
 */
export function normalizeRichItem(value, allowedFields) {
  const source = isObject(value) ? value : {};
  const normalizedItem = Object.fromEntries(
    allowedFields
      .map((field) => [
        field,
        ARRAY_FIELDS.has(field) ? safeStringArray(source[field]) : safeString(source[field])
      ])
  );

  if (allowedFields.includes("skills")) {
    normalizedItem.skills = normalizeSkills(source.skills);
  }

  if (allowedFields.includes("imageUrls") && allowedFields.includes("imageTitles")) {
    Object.assign(
      normalizedItem,
      normalizeRelatedStringArrays(
        source,
        "imageUrls",
        allowedFields.filter((field) => [
          "imageTitles",
          "imageDescriptions",
          "imageBackupDescriptions"
        ].includes(field)),
        {
          imageTitles: ["imageTitles", "imageDescriptions"],
          imageDescriptions: ["imageDescriptions", "imageTitles"]
        }
      )
    );
  }

  if (allowedFields.includes("links") && allowedFields.includes("linksTitles")) {
    Object.assign(
      normalizedItem,
      normalizeRelatedStringArrays(
        source,
        "links",
        allowedFields.filter((field) => [
          "linksTitles",
          "linksDescriptions",
          "linksBackupDescriptions"
        ].includes(field)),
        {
          linksTitles: ["linksTitles", "linksDescriptions"],
          linksDescriptions: ["linksDescriptions", "linksTitles"]
        }
      )
    );
  }

  return normalizeAcademicItem(source, normalizedItem);
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

  const sourceItems = value.filter(isObject);
  const normalizedItems = sourceItems.map((item) => normalizeRichItem(item, allowedFields));

  // Identical legacy entries need distinct IDs; persisted IDs reserve their values.
  if (allowedFields.includes("id")) {
    const reservedIds = new Set(normalizedItems.map((item) => item.id));
    const explicitIds = new Set(sourceItems
      .filter((item) => typeof item.id === "string" && item.id.trim())
      .map((item) => item.id.trim()));
    const seenIds = new Set();

    normalizedItems.forEach((item, index) => {
      const baseId = item.id;
      const suppliedId = safeString(sourceItems[index].id).trim();
      let suffix = 2;

      if (seenIds.has(baseId) || (!suppliedId && explicitIds.has(baseId))) {
        while (reservedIds.has(`${baseId}-${suffix}`)) {
          suffix += 1;
        }
        item.id = `${baseId}-${suffix}`;
        reservedIds.add(item.id);
      }
      seenIds.add(item.id);
    });
  }

  return sortByLatestDate(normalizedItems, dateFields);
}

/**
 * Builds the complete public/admin portfolio payload.
 *
 * The returned payload removes deprecated fields such as `duration`, keeps only
 * the supported page and rich-item fields, defaults missing strings/arrays to
 * safe empty values, migrates legacy IDs/categories, supplies profile/research
 * defaults only for absent objects, and retains the existing date ordering.
 * This function is pure: normalization never writes to storage.
 *
 * @param {unknown} value Candidate portfolio payload.
 * @returns {{pages: Record<string, {title: string, description: string, imageUrl: string}>, jobs: object[], education: object[], projects: object[], profile: import('./academicMetadata.js').Profile, research: import('./academicMetadata.js').Research}} Normalized portfolio payload.
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
    projects: normalizeRichArray(source.projects, PROJECT_FIELDS, ["dateOfCompletion"]),
    profile: normalizeProfile(source.profile),
    research: normalizeResearch(source.research)
  };
}

function validateMetadataObject(value, key, fields, arrayFields, errors) {
  if (!Object.hasOwn(value, key)) {
    return;
  }

  const object = value[key];

  if (!isObject(object)) {
    errors.push(`${key} must be an object.`);
    return;
  }

  for (const field of fields) {
    if (!Object.hasOwn(object, field)) {
      continue;
    }
    const valid = arrayFields.includes(field)
      ? Array.isArray(object[field]) && object[field].every((item) => typeof item === "string")
      : typeof object[field] === "string";

    if (!valid) {
      errors.push(`${key}.${field} must be ${arrayFields.includes(field) ? "an array of strings" : "a string"}.`);
    }
  }
}

function validateEnum(item, field, allowed, path, errors) {
  if (Object.hasOwn(item, field) && !allowed.includes(item[field])) {
    errors.push(`${path}.${field} must be one of: ${allowed.join(", ")}.`);
  }
}

function validateUrl(value, path, errors) {
  if (value !== undefined && !isSafePublicUrl(value)) {
    errors.push(`${path} must be an HTTP(S) URL or a safe relative asset path.`);
  }
}

function validateRichMetadata(value, key, errors) {
  const ids = new Set();

  if (!Array.isArray(value[key])) {
    return;
  }

  value[key].forEach((item, index) => {
    if (!isObject(item)) {
      return;
    }
    const path = `${key}[${index}]`;

    if (key !== "education") {
      if (Object.hasOwn(item, "id")) {
        if (typeof item.id !== "string" || (item.id !== "" && !ID_PATTERN.test(item.id))) {
          errors.push(`${path}.id must be an empty string or a unique identifier of up to 128 letters, digits, dots, underscores, colons or hyphens.`);
        } else if (item.id) {
          if (ids.has(item.id)) {
            errors.push(`${path}.id must be unique within ${key}.`);
          }
          ids.add(item.id);
        }
      }
      validateEnum(item, "category", key === "jobs" ? JOB_CATEGORIES : PROJECT_CATEGORIES, path, errors);
    }

    if (key === "projects") {
      validateEnum(item, "outputType", PROJECT_OUTPUT_TYPES, path, errors);
      validateEnum(item, "status", PROJECT_STATUSES, path, errors);
      if (Object.hasOwn(item, "contribution") && typeof item.contribution !== "string") {
        errors.push(`${path}.contribution must be a string.`);
      }
      if (Object.hasOwn(item, "authors") &&
          (!Array.isArray(item.authors) || !item.authors.every((author) => typeof author === "string"))) {
        errors.push(`${path}.authors must be an ordered array of strings.`);
      }
      if (Object.hasOwn(item, "relatedRoleIds") &&
          (!Array.isArray(item.relatedRoleIds) || !item.relatedRoleIds.every((id) => typeof id === "string" && ID_PATTERN.test(id)))) {
        errors.push(`${path}.relatedRoleIds must be an array of role IDs.`);
      }
    } else if (key === "education") {
      validateEnum(item, "status", EDUCATION_STATUSES, path, errors);
    }

    for (const field of ["imageUrls", ...(key === "projects" ? ["links"] : [])]) {
      if (Array.isArray(item[field])) {
        item[field].forEach((url, urlIndex) => validateUrl(url, `${path}.${field}[${urlIndex}]`, errors));
      }
    }
  });
}

/**
 * Validates that an admin save request contains a complete portfolio payload.
 *
 * The four legacy sections remain required; profile/research are optional for
 * older clients. Supplied metadata types, enums, unique IDs, role references,
 * public email and URL schemes are validated. Unknown rich/object fields are
 * discarded during normalization, preserving existing editing behavior.
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

  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
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
      } else {
        validateUrl(value.pages[pageKey].imageUrl, `pages.${pageKey}.imageUrl`, errors);
      }
    }
  }

  for (const arrayKey of ["jobs", "education", "projects"]) {
    if (!Array.isArray(value[arrayKey])) {
      errors.push(`${arrayKey} must be an array.`);
    }
    validateRichMetadata(value, arrayKey, errors);
  }

  validateMetadataObject(value, "profile", PROFILE_FIELDS, ["researchInterests"], errors);
  validateMetadataObject(value, "research", RESEARCH_FIELDS, ["thesisQuestions", "thesisMethods"], errors);
  if (isObject(value.research)) {
    validateEnum(value.research, "thesisStatus", THESIS_STATUSES, "research", errors);
  }
  if (isObject(value.profile)) {
    validateUrl(value.profile.cvUrl, "profile.cvUrl", errors);
    validateUrl(value.profile.portraitUrl, "profile.portraitUrl", errors);
    if (value.profile.email !== undefined && value.profile.email !== "" &&
        (typeof value.profile.email !== "string" || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.profile.email))) {
      errors.push("profile.email must be an explicit email address or an empty string.");
    }
  }

  if (errors.length === 0) {
    const normalized = normalizePortfolioData(value);
    const roleIds = new Set(normalized.jobs.map((job) => job.id));

    normalized.projects.forEach((project, index) => {
      if (project.relatedRoleIds.some((id) => !roleIds.has(id))) {
        errors.push(`projects[${index}].relatedRoleIds must reference jobs in this payload.`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
