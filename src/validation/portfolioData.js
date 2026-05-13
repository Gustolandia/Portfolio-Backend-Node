export const PAGE_KEYS = Object.freeze([
  "home",
  "experience",
  "education",
  "projects",
  "contact"
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

export function normalizePortfolioData(value = {}) {
  const source = isObject(value) ? value : {};
  const sourcePages = isObject(source.pages) ? source.pages : {};
  const pages = Object.fromEntries(
    PAGE_KEYS.map((pageKey) => [pageKey, normalizePage(sourcePages[pageKey])])
  );

  return {
    pages,
    jobs: normalizeContentArray(source.jobs),
    education: normalizeContentArray(source.education),
    projects: normalizeContentArray(source.projects)
  };
}
