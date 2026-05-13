import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { DEFAULT_PORTFOLIO_DATA_PATH } from "../src/storage/jsonPortfolioStore.js";
import {
  PAGE_KEYS,
  normalizePage,
  normalizePortfolioData,
  normalizeRichItem,
  validateCompletePortfolioPayload,
  JOB_FIELDS
} from "../src/validation/portfolioData.js";

test("normalizes missing portfolio sections to safe empty values", () => {
  const data = normalizePortfolioData({});

  assert.deepEqual(Object.keys(data.pages), PAGE_KEYS);
  assert.deepEqual(data.pages.home, {
    title: "",
    description: "",
    imageUrl: ""
  });
  assert.deepEqual(data.jobs, []);
  assert.deepEqual(data.education, []);
  assert.deepEqual(data.projects, []);
});

test("normalizes page text fields and strips unsupported page fields", () => {
  assert.deepEqual(
    normalizePage({
      description: 123,
      imageUrl: "https://example.com/image.jpg",
      path: "/home",
      title: "Home"
    }),
    {
      title: "Home",
      description: "",
      imageUrl: "https://example.com/image.jpg"
    }
  );
});

test("local portfolio data file matches the public payload shape", async () => {
  const fileContent = await readFile(DEFAULT_PORTFOLIO_DATA_PATH, "utf8");
  const normalizedData = normalizePortfolioData(JSON.parse(fileContent));

  assert.deepEqual(Object.keys(normalizedData), ["pages", "jobs", "education", "projects"]);
  assert.deepEqual(Object.keys(normalizedData.pages), PAGE_KEYS);
  assert.ok(normalizedData.jobs.length > 0);
  assert.ok(normalizedData.education.length > 0);
  assert.ok(normalizedData.projects.length > 0);
});

test("normalizes rich items to allowed fields with safe defaults", () => {
  assert.deepEqual(
    normalizeRichItem(
      {
        company: "Company",
        duties: ["Build"],
        unknown: "discard"
      },
      JOB_FIELDS
    ),
    {
      title: "",
      company: "Company",
      duration: "",
      location: "",
      start: "",
      end: "",
      imageUrls: [],
      imageTitles: [],
      duties: ["Build"],
      skills: [],
      mapLocation: ""
    }
  );
});

test("validates complete admin portfolio payloads", () => {
  const result = validateCompletePortfolioPayload({
    pages: Object.fromEntries(
      PAGE_KEYS.map((pageKey) => [
        pageKey,
        {
          title: pageKey
        }
      ])
    ),
    jobs: [],
    education: [],
    projects: []
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("rejects incomplete admin portfolio payloads", () => {
  const result = validateCompletePortfolioPayload({
    pages: {
      home: {}
    },
    jobs: [],
    extra: true
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Missing required top-level key")));
  assert.ok(result.errors.some((error) => error.includes("Unknown top-level keys")));
  assert.ok(result.errors.some((error) => error.includes("pages.experience")));
});
