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
        duration: "Deprecated",
        unknown: "discard"
      }
    ]
  });
  const readData = await service.getPortfolioData();

  assert.equal(savedData.pages.home.title, "Updated");
  assert.deepEqual(readData.jobs[0], {
    title: "",
    company: "Company",
    location: "",
    start: "",
    end: "",
    imageUrls: [],
    imageTitles: [],
    duties: [],
    skills: [],
    mapLocation: ""
  });
  assert.equal(Object.hasOwn(readData.jobs[0], "duration"), false);
});

test("portfolio service persists entries ordered by most recent end date", async () => {
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
    jobs: [
      {
        company: "Older",
        end: "2020-01-01"
      },
      {
        company: "Latest",
        end: "2024-01-01"
      }
    ],
    education: [
      {
        degree: "Older",
        end: "2018-06-01"
      },
      {
        degree: "Latest",
        end: "2022-06-01"
      }
    ],
    projects: [
      {
        dateOfCompletion: "2019",
        name: "Older"
      },
      {
        dateOfCompletion: "Feb 2025",
        name: "Latest"
      }
    ]
  });

  assert.equal(savedData.jobs[0].company, "Latest");
  assert.equal(storedData.education[0].degree, "Latest");
  assert.equal(storedData.projects[0].name, "Latest");
});
