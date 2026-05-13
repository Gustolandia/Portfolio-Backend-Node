import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPortfolioStore,
  JsonPortfolioStore,
  RedisPortfolioStore
} from "../src/storage/index.js";

test("storage factory uses local JSON by default", () => {
  const store = createPortfolioStore({
    storeType: "json"
  });

  assert.ok(store instanceof JsonPortfolioStore);
});

test("storage factory can select Redis storage", () => {
  const store = createPortfolioStore({
    redis: {
      get: async () => null,
      set: async () => "OK"
    },
    storeType: "redis"
  });

  assert.ok(store instanceof RedisPortfolioStore);
});
