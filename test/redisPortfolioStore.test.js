import assert from "node:assert/strict";
import { test } from "node:test";
import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";

test("Redis portfolio store returns empty data when the key is missing", async () => {
  const store = new RedisPortfolioStore({
    key: "portfolio:test",
    redis: {
      get: async () => null
    }
  });

  assert.deepEqual(await store.getPortfolioData(), {});
});

test("Redis portfolio store reads and writes portfolio data by key", async () => {
  const calls = [];
  const expectedData = {
    jobs: [
      {
        title: "Engineer"
      }
    ]
  };
  const store = new RedisPortfolioStore({
    key: "portfolio:test",
    redis: {
      get: async (key) => {
        calls.push(["get", key]);
        return expectedData;
      },
      set: async (key, data) => {
        calls.push(["set", key, data]);
        return "OK";
      }
    }
  });

  assert.deepEqual(await store.getPortfolioData(), expectedData);
  assert.deepEqual(await store.setPortfolioData(expectedData), expectedData);
  assert.deepEqual(calls, [
    ["get", "portfolio:test"],
    ["set", "portfolio:test", expectedData]
  ]);
});
