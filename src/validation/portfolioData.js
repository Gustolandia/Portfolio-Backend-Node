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
  "duration",
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
  "duration",
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

export function normalizePage(value) {
  const page = isObject(value) ? value : {};

  return {
    title: safeString(page.title),
    description: safeString(page.description),
    imageUrl: safeString(page.imageUrl)
  };
}

export function normalizeContentArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map(cloneJsonObject);
}

export function normalizeRichItem(value, allowedFields) {
  const source = isObject(value) ? value : {};

  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(source, field))
      .map((field) => [
        field,
        ARRAY_FIELDS.has(field) ? safeStringArray(source[field]) : safeString(source[field])
      ])
  );
}

export function normalizeRichArray(value, allowedFields) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isObject).map((item) => normalizeRichItem(item, allowedFields));
}

export function normalizePortfolioData(value = {}) {
  const source = isObject(value) ? value : {};
  const sourcePages = isObject(source.pages) ? source.pages : {};
  const pages = Object.fromEntries(
    PAGE_KEYS.map((pageKey) => [pageKey, normalizePage(sourcePages[pageKey])])
  );

  return {
    pages,
    jobs: normalizeRichArray(source.jobs, JOB_FIELDS),
    education: normalizeRichArray(source.education, EDUCATION_FIELDS),
    projects: normalizeRichArray(source.projects, PROJECT_FIELDS)
  };
}
