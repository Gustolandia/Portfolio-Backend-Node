import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PORTFOLIO_DATA_PATH = path.resolve(
  currentDirectory,
  "../../data/portfolio.json"
);

export class JsonPortfolioStore {
  constructor({ filePath = DEFAULT_PORTFOLIO_DATA_PATH, reader = readFile } = {}) {
    this.filePath = filePath;
    this.reader = reader;
  }

  async getPortfolioData() {
    const content = await this.reader(this.filePath, "utf8");

    return JSON.parse(content);
  }
}
