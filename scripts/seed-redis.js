import { JsonPortfolioStore } from "../src/storage/jsonPortfolioStore.js";
import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";

const jsonStore = new JsonPortfolioStore();
const redisStore = new RedisPortfolioStore();

const portfolioData = normalizePortfolioData(await jsonStore.getPortfolioData());
await redisStore.setPortfolioData(portfolioData);

console.log(
  `Seeded ${redisStore.key} with ${portfolioData.jobs.length} jobs, ` +
    `${portfolioData.education.length} education entries, and ` +
    `${portfolioData.projects.length} projects.`
);
