import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { JsonPortfolioStore } from "../src/storage/jsonPortfolioStore.js";

test("JSON portfolio store reads and parses a local JSON file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-store-"));
  const filePath = path.join(directory, "portfolio.json");

  try {
    await writeFile(filePath, JSON.stringify({ jobs: [{ title: "Engineer" }] }), "utf8");

    const store = new JsonPortfolioStore({ filePath });
    const data = await store.getPortfolioData();

    assert.deepEqual(data, {
      jobs: [
        {
          title: "Engineer"
        }
      ]
    });
  } finally {
    await rm(directory, {
      force: true,
      recursive: true
    });
  }
});

test("JSON portfolio store surfaces invalid JSON errors", async () => {
  const store = new JsonPortfolioStore({
    reader: async () => "{invalid"
  });

  await assert.rejects(() => store.getPortfolioData(), SyntaxError);
});
