import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PORTFOLIO_DATA_PATH = path.resolve(
  process.env.PORTFOLIO_DATA_PATH || "data/portfolio.json"
);

export class JsonPortfolioStore {
  constructor({
    filePath = DEFAULT_PORTFOLIO_DATA_PATH,
    reader = readFile,
    renamer = rename,
    writer = writeFile
  } = {}) {
    this.filePath = filePath;
    this.reader = reader;
    this.renamer = renamer;
    this.writer = writer;
  }

  async getPortfolioData() {
    const content = await this.reader(this.filePath, "utf8");

    return JSON.parse(content);
  }

  async setPortfolioData(data) {
    const temporaryFilePath = `${this.filePath}.${randomUUID()}.tmp`;
    const serializedData = `${JSON.stringify(data, null, 2)}\n`;

    await this.writer(temporaryFilePath, serializedData, "utf8");
    await this.renamer(temporaryFilePath, this.filePath);

    return data;
  }
}
