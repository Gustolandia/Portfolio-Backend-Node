import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stageImageKitAssets } from "../src/media/stageImageKitAssets.js";

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-stage-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("selected test image");
  const source = join(directory, "source.png");
  await writeFile(source, bytes);
  const asset = { id: "selected", localPath: source, sha256: createHash("sha256").update(bytes).digest("hex"),
    mime: "image/png", bytes: bytes.length, width: 20, height: 10, target: "photos" };
  const provider = { fileId: "file-one", size: bytes.length,
    url: "https://ik.imagekit.io/test/Portfolio-Website/Photos/selected.png" };
  let posts = 0;
  const options = { manifest: { assets: [asset] }, selectedDirectory: directory,
    receiptDirectory: join(directory, "receipts"), privateKey: "private_fixture_not_real",
    urlEndpoint: "https://ik.imagekit.io/test", folders: { photos: "/Portfolio-Website/Photos", snippets: "/Portfolio-Website/Snippets" },
    inspectImage: async () => ({ width: 20, height: 10, pages: 1, format: "png", nonblank: true }),
    fetchImpl: async (url, request) => {
      if (request.method === "POST") {
        posts++;
        assert.equal(request.body.get("overwriteFile"), "false");
        assert.equal(request.body.get("useUniqueFileName"), "true");
        assert.equal(request.body.get("isPrivateFile"), "false");
        assert.equal(url, "https://upload.imagekit.io/api/v1/files/upload");
        return Response.json(provider);
      }
      return new Response(bytes, { headers: { "Content-Type": "image/png" } });
    } };
  return { options, asset, provider, bytes, posts: () => posts };
}

test("staging verifies originals and delivery, resumes without another POST and writes no credentials", async (t) => {
  const f = await fixture(t);
  const [receipt] = await stageImageKitAssets(f.options);
  assert.equal(receipt.status, "verified");
  assert.equal(receipt.originalVerification.sha256, f.asset.sha256);
  assert.equal(f.posts(), 1);
  await stageImageKitAssets(f.options);
  assert.equal(f.posts(), 1);
  const raw = await readFile(join(f.options.receiptDirectory, "selected.stage.json"), "utf8");
  assert.ok(!raw.includes(f.options.privateKey));
  assert.ok(!raw.includes("Authorization"));
});

test("staging reuses a verified known upload rather than uploading it again", async (t) => {
  const f = await fixture(t);
  const [receipt] = await stageImageKitAssets({ ...f.options, existingUploads: { selected: f.provider } });
  assert.equal(receipt.reused, true);
  assert.equal(f.posts(), 0);
});

test("reused and resumed upload receipts discard credential/debug fields and non-scalar provider metadata", async (t) => {
  const f = await fixture(t);
  const provider = { ...f.provider, Authorization: f.options.privateKey, privateKey: f.options.privateKey,
    name: { credential: f.options.privateKey }, width: { debug: f.options.privateKey } };
  const [receipt] = await stageImageKitAssets({ ...f.options, existingUploads: { selected: provider } });
  assert.deepEqual(receipt.provider, f.provider);
  const path = join(f.options.receiptDirectory, "selected.stage.json");
  await writeFile(path, JSON.stringify({ ...receipt, privateKey: f.options.privateKey, debug: { Authorization: f.options.privateKey }, provider }));
  const [resumed] = await stageImageKitAssets(f.options);
  assert.deepEqual(resumed.provider, f.provider);
  assert.equal(f.posts(), 0);
  const raw = await readFile(path, "utf8");
  assert.equal(raw.includes(f.options.privateKey), false);
  assert.equal(raw.includes("Authorization"), false);
});

test("decoded metadata cannot overwrite computed hashes/status/size or leak debug fields", async (t) => {
  const f = await fixture(t);
  const [receipt] = await stageImageKitAssets({ ...f.options, inspectImage: async () => ({
    width: 20, height: 10, pages: 1, format: "png", nonblank: true,
    sha256: "forged", status: 401, bytes: 0, privateKey: f.options.privateKey, debug: { Authorization: f.options.privateKey }
  }) });
  for (const verification of [receipt.originalVerification, receipt.deliveryVerification]) {
    assert.equal(verification.sha256, f.asset.sha256);
    assert.equal(verification.status, 200);
    assert.equal(verification.bytes, f.asset.bytes);
  }
  assert.equal(JSON.stringify(receipt).includes(f.options.privateKey), false);
});

test("source frame counts must be positive integers before upload", async (t) => {
  const f = await fixture(t);
  for (const pages of [undefined, 0, -1, 1.5, "65"]) {
    await assert.rejects(stageImageKitAssets({ ...f.options,
      inspectImage: async () => ({ width: 20, height: 10, pages, format: "png", nonblank: true }) }), /dimensions or content/);
  }
  assert.equal(f.posts(), 0);
});

test("staging validates every source before making any upload", async (t) => {
  const f = await fixture(t);
  const bad = { ...f.asset, id: "changed", sha256: "0".repeat(64) };
  await assert.rejects(stageImageKitAssets({ ...f.options, manifest: { assets: [f.asset, bad] } }), /bytes differ/);
  assert.equal(f.posts(), 0);
});

test("staging refuses uncertain upload outcomes on resumption", async (t) => {
  const f = await fixture(t);
  let attempts = 0;
  const options = { ...f.options, fetchImpl: async () => { attempts++; throw new Error("connection lost"); } };
  await assert.rejects(stageImageKitAssets(options), /connection lost/);
  await assert.rejects(stageImageKitAssets(options), /automatic re-upload is prohibited/);
  assert.equal(attempts, 1);
});

test("a rejected upload persists its status without response bodies and is not automatically retried", async (t) => {
  const f = await fixture(t);
  let attempts = 0;
  const options = { ...f.options, fetchImpl: async () => { attempts++; return new Response(f.options.privateKey, { status: 429 }); } };
  await assert.rejects(stageImageKitAssets(options), /HTTP 429/);
  await assert.rejects(stageImageKitAssets(options), /automatic re-upload is prohibited/);
  assert.equal(attempts, 1);
  const raw = await readFile(join(f.options.receiptDirectory, "selected.stage.json"), "utf8");
  assert.equal(JSON.parse(raw).httpStatus, 429);
  assert.equal(raw.includes(f.options.privateKey), false);
});

test("staging rejects provider responses outside the configured account", async (t) => {
  const f = await fixture(t);
  await assert.rejects(stageImageKitAssets({ ...f.options,
    existingUploads: { selected: { ...f.provider, url: "https://other.example/image.png" } } }), /approved account/);
  assert.equal(f.posts(), 0);
});

test("staging rejects original-byte mismatches and does not retry a successful POST", async (t) => {
  const f = await fixture(t);
  const fetchImpl = async (url, request) => request.method === "POST" ? f.options.fetchImpl(url, request)
    : new Response("different source", { headers: { "Content-Type": "image/png" } });
  await assert.rejects(stageImageKitAssets({ ...f.options, fetchImpl }), /Stored original differs/);
  assert.equal(f.posts(), 1);
  await stageImageKitAssets(f.options);
  assert.equal(f.posts(), 1);
});

test("staging rejects selected SVG active content before network access", async (t) => {
  const f = await fixture(t);
  const bytes = Buffer.from('<svg onload="alert(1)"></svg>');
  await writeFile(f.asset.localPath, bytes);
  const asset = { ...f.asset, mime: "image/svg+xml", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex") };
  await assert.rejects(stageImageKitAssets({ ...f.options, manifest: { assets: [asset] } }), /active or external/);
  assert.equal(f.posts(), 0);
});

test("staging preserves multi-frame delivery using the original URL", async (t) => {
  const f = await fixture(t);
  f.asset.mime = "image/gif";
  const [receipt] = await stageImageKitAssets({ ...f.options,
    inspectImage: async () => ({ width: 20, height: 10, format: "gif", pages: 65, nonblank: true }) });
  assert.equal(new URL(receipt.deliveryUrl).searchParams.get("tr"), "orig-true");
  assert.equal(receipt.deliveryVerification.pages, 65);
});

test("staging rejects lost GIF frames even with an explicit delivery transformation", async (t) => {
  const f = await fixture(t);
  f.asset.mime = "image/gif";
  f.asset.deliveryTransform = "w-200";
  let inspected = 0;
  await assert.rejects(stageImageKitAssets({ ...f.options, inspectImage: async () => ({
    width: 20, height: 10, pages: ++inspected === 3 ? 1 : 65, format: "gif", nonblank: true
  }) }), /lost animation frames/);
  assert.equal(f.posts(), 1);
});

test("staging rejects a declared MIME type that differs from the decoded format", async (t) => {
  const f = await fixture(t);
  await assert.rejects(stageImageKitAssets({ ...f.options,
    inspectImage: async () => ({ width: 20, height: 10, pages: 1, format: "svg", nonblank: true }) }), /dimensions or content/);
  assert.equal(f.posts(), 0);
});
