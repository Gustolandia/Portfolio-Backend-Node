import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("dependency manifest and committed lockfile agree on all dependency groups and supported engines", async () => {
  const manifest = await readJson("../package.json");
  const lock = await readJson("../package-lock.json");
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.ok(lock.packages?.[""], "A root package entry is required for reproducible installs");
  for (const key of ["dependencies", "devDependencies", "optionalDependencies", "engines"]) {
    assert.deepEqual(lock.packages[""][key] || {}, manifest[key] || {}, `${key} must match the committed manifest`);
  }
});

test("locked registry packages retain HTTPS sources without embedded credentials and SHA-512 integrity", async () => {
  const lock = await readJson("../package-lock.json");
  const entries = Object.entries(lock.packages).filter(([path]) => path !== "");
  assert.ok(entries.length > 0);
  for (const [path, entry] of entries) {
    assert.equal(typeof entry.version, "string", `${path} must have a pinned version`);
    const source = new URL(entry.resolved);
    assert.equal(source.protocol, "https:", `${path} must use HTTPS`);
    assert.equal(source.hostname, "registry.npmjs.org", `${path} must use the reviewed public registry`);
    assert.ok(source.username === "" && source.password === "" && source.search === "", `${path} must not embed credentials`);
    assert.match(entry.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/, `${path} requires SHA-512 integrity`);
    assert.equal(Buffer.from(entry.integrity.slice(7), "base64").length, 64, `${path} requires a complete digest`);
  }
});

test("repeatable dependency audit checks the complete tree without severity suppression or forced fixes", async () => {
  const manifest = await readJson("../package.json");
  assert.equal(manifest.scripts.audit, "npm audit");
});

test("committed dependencies contain no declared package deprecations", async () => {
  const lock = await readJson("../package-lock.json");
  for (const [path, entry] of Object.entries(lock.packages)) {
    assert.ok(!entry.deprecated, `${path || "root"} declares a deprecated package`);
  }
});
