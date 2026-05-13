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

test("portfolio service writes normalized data and reads the updated content", async () => {
  let storedData = {};
  const service = new PortfolioService({
    store: {
      getPortfolioData: async () => storedData,
      setPortfolioData: async (data) => {
        storedData = data;
      }
    }
  });

  const savedData = await service.updatePortfolioData({
    pages: {
      home: {
        title: "Updated"
      }
    },
    jobs: [
      {
        company: "Company",
        unknown: "discard"
      }
    ]
  });
  const readData = await service.getPortfolioData();

  assert.equal(savedData.pages.home.title, "Updated");
  assert.deepEqual(readData.jobs[0], {
    title: "",
    company: "Company",
    duration: "",
    location: "",
    start: "",
    end: "",
    imageUrls: [],
    imageTitles: [],
    duties: [],
    skills: [],
    mapLocation: ""
  });
});
