import assert from "node:assert/strict";
import { test } from "node:test";
import { PortfolioService } from "../src/services/portfolioService.js";

test("portfolio service loads data through storage and normalizes the payload", async () => {
  const service = new PortfolioService({
    store: {
      getPortfolioData: async () => ({
        pages: {
          home: {
            title: "Home"
          }
        },
        jobs: "not-an-array"
      })
    }
  });

  const data = await service.getPortfolioData();

  assert.deepEqual(data.pages.home, {
    title: "Home",
    description: "",
    imageUrl: ""
  });
  assert.deepEqual(data.jobs, []);
  assert.deepEqual(data.education, []);
  assert.deepEqual(data.projects, []);
});
