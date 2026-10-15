import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  ImageKitMediaPathError,
  ImageKitMediaService
} from "../src/media/imageKitMediaService.js";

function createFixture(options = {}) {
  // Explicit folder inputs keep unit fixtures independent of deployment env vars.
  return new ImageKitMediaService({
    getPrivateKey: () => "private_test_key",
    getPublicKey: () => "public_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website",
    fileFolder: "",
    photosFolder: "",
    snippetsFolder: "",
    ...options
  });
}

test("ImageKit media service creates upload authentication for direct browser uploads", () => {
  const service = createFixture();

  const result = service.getUploadAuthentication({
    target: "photos"
  });
  const expectedSignature = createHmac("sha1", "private_test_key")
    .update(`${result.token}${result.expire}`)
    .digest("hex");

  assert.equal(result.publicKey, "public_test_key");
  assert.equal(result.urlEndpoint, "https://ik.imagekit.io/Gustolandia/");
  assert.equal(result.uploadEndpoint, "https://upload.imagekit.io/api/v1/files/upload");
  assert.equal(result.folder, "/Portfolio Website/Photos");
  assert.deepEqual(result.folders, {
    files: "/Portfolio Website",
    photos: "/Portfolio Website/Photos",
    snippets: "/Portfolio Website/Snippets"
  });
  assert.equal(result.signature, expectedSignature);
  assert.equal(typeof result.token, "string");
  assert.equal(typeof result.expire, "number");
});

test("ImageKit media service defaults upload authentication to snippets", () => {
  const service = createFixture();

  const result = service.getUploadAuthentication();

  assert.equal(result.folder, "/Portfolio Website/Snippets");
});

test("ImageKit media service rejects upload folders outside the configured media root", () => {
  const service = createFixture();

  assert.throws(
    () => service.getUploadAuthentication({ path: "/Other Folder" }),
    ImageKitMediaPathError
  );
});

test("ImageKit media service rejects configured folders outside the media root", () => {
  assert.throws(
    () => createFixture({ fileFolder: "/Other Folder" }),
    ImageKitMediaPathError
  );
});

test("ImageKit unit fixtures remain isolated from incompatible ambient upload folders", (t) => {
  const ambient = {
    IMAGEKIT_MEDIA_FOLDER: "/Portfolio-Website",
    IMAGEKIT_FILES_FOLDER: "/Portfolio-Website",
    IMAGEKIT_PHOTOS_FOLDER: "/Portfolio-Website/Photos",
    IMAGEKIT_SNIPPETS_FOLDER: "/Portfolio-Website/Snippets",
    IMAGEKIT_IMAGES_FOLDER: "/Legacy-Ambient/Snippets"
  };
  for (const [key, value] of Object.entries(ambient)) {
    const before = process.env[key];
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
    process.env[key] = value;
  }
  assert.deepEqual(createFixture().uploadFolders(), {
    files: "/Portfolio Website", photos: "/Portfolio Website/Photos", snippets: "/Portfolio Website/Snippets"
  });
  assert.throws(() => createFixture({ fileFolder: "/Other Folder" }), ImageKitMediaPathError);
});
