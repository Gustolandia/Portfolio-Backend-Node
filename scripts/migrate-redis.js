import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";

const redisStore = new RedisPortfolioStore();

const currentPortfolioData = await redisStore.getPortfolioData();
const normalizedPortfolioData = normalizePortfolioData(currentPortfolioData);

await redisStore.setPortfolioData(normalizedPortfolioData);

console.log(
  `Migrated ${redisStore.key}: removed deprecated fields, sorted entries, ` +
    `and saved ${normalizedPortfolioData.jobs.length} jobs, ` +
    `${normalizedPortfolioData.education.length} education entries, and ` +
    `${normalizedPortfolioData.projects.length} projects.`
);
