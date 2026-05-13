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

test("JSON portfolio store writes through a temporary file before replacing data", async () => {
  const calls = [];
  const store = new JsonPortfolioStore({
    filePath: "portfolio.json",
    renamer: async (from, to) => calls.push(["rename", from, to]),
    writer: async (filePath, content, encoding) => calls.push(["write", filePath, content, encoding])
  });

  await store.setPortfolioData({
    pages: {
      home: {
        title: "Home"
      }
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "write");
  assert.match(calls[0][1], /^portfolio\.json\..+\.tmp$/);
  assert.equal(calls[0][3], "utf8");
  assert.deepEqual(calls[1], ["rename", calls[0][1], "portfolio.json"]);
});
