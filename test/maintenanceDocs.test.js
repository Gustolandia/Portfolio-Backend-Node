import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const prose = (text) => text.replace(/\r\n/g, "\n").replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, "");

test("README table of contents lists every current section in order with valid anchors", async () => {
  const text = prose(await readFile(join(root, "README.md"), "utf8"));
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]).filter((title) => title !== "Table Of Contents");
  const toc = text.split("## Table Of Contents\n\n")[1]?.split("\n## ")[0];
  assert.ok(toc, "Table of contents must remain at the start");
  const links = [...toc.matchAll(/^- \[([^\]]+)\]\(#([^)]+)\)$/gm)].map((match) => [match[1], match[2]]);
  assert.deepEqual(links, headings.map((title) => [title, title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/ /g, "-")]));
  assert.equal(new Set(links.map((link) => link[1])).size, links.length);
  assert.ok(text.indexOf("## Table Of Contents") < text.indexOf("## Endpoint"));
});

test("README and maintenance guide have no missing local documentation links", async () => {
  for (const name of ["README.md", "docs/maintenance-tools.md", "docs/linkedin-content-migration.md",
    "docs/linkedin-role-descriptions-migration.md", "docs/media-recovery.md", "docs/workplace-content-migration.md",
    "docs/editorial-metadata.md", "docs/website-review-migration.md", "docs/dependency-security.md",
    "docs/education-skills-migration.md", "docs/professional-skills-migration.md", "docs/research-project-skills-migration.md"]) {
    const path = join(root, name);
    const text = prose(await readFile(path, "utf8"));
    for (const [, target] of text.matchAll(/\[[^\]]+\]\(([^\s)]+)\)/g)) {
      if (/^[a-z]+:|^#/i.test(target)) continue;
      await assert.doesNotReject(access(resolve(dirname(path), decodeURIComponent(target.split("#")[0]))), `${name}: ${target}`);
    }
  }
});

test("Git ignores private backups and dotenv variants but keeps the placeholder example publishable", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-ignore-"));
  t.after(async () => {
    const target = resolve(directory);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("portfolio-ignore-"));
    await rm(target, { recursive: true, force: true });
  });
  const init = spawnSync("git", ["init", "--quiet"], { cwd: directory, encoding: "utf8" });
  assert.equal(init.status, 0, "Git must be available for release-ignore verification");
  await writeFile(join(directory, ".gitignore"), await readFile(join(root, ".gitignore"), "utf8"));
  const protectedPaths = [".env", ".env.local", ".env.production", "nested/.env.preview", "private-content/source.json", "private-content/uploads/receipt.json"];
  for (const path of protectedPaths) {
    const result = spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", path], { cwd: directory, encoding: "utf8" });
    assert.equal(result.status, 0, `${path} must remain ignored`);
  }
  const example = spawnSync("git", ["check-ignore", "--no-index", "--quiet", "--", ".env.example"], { cwd: directory, encoding: "utf8" });
  assert.equal(example.status, 1, "Placeholder example must not be ignored");
  const template = await readFile(join(root, ".env.example"), "utf8");
  for (const line of template.split(/\r?\n/)) {
    if (/^(?:ADMIN_PASSWORD_HASH|AUTH_JWT_SECRET|ADMIN_API_KEY|UPSTASH_REDIS_REST_TOKEN|IMAGEKIT_PRIVATE_KEY)=/.test(line)) {
      assert.match(line, /=replace-with-/);
    }
  }
});
