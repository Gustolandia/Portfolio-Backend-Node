import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import {
  ImageKitMediaPathError,
  ImageKitMediaService
} from "../src/media/imageKitMediaService.js";

test("ImageKit media service creates upload authentication for direct browser uploads", () => {
  const service = new ImageKitMediaService({
    getPrivateKey: () => "private_test_key",
    getPublicKey: () => "public_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

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
  const service = new ImageKitMediaService({
    getPrivateKey: () => "private_test_key",
    getPublicKey: () => "public_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  const result = service.getUploadAuthentication();

  assert.equal(result.folder, "/Portfolio Website/Snippets");
});

test("ImageKit media service rejects upload folders outside the configured media root", () => {
  const service = new ImageKitMediaService({
    getPrivateKey: () => "private_test_key",
    getPublicKey: () => "public_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  assert.throws(
    () => service.getUploadAuthentication({ path: "/Other Folder" }),
    ImageKitMediaPathError
  );
});

test("ImageKit media service rejects configured folders outside the media root", () => {
  assert.throws(
    () => new ImageKitMediaService({
      fileFolder: "/Other Folder",
      getPrivateKey: () => "private_test_key",
      getPublicKey: () => "public_test_key",
      getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
      mediaRoot: "/Portfolio Website"
    }),
    ImageKitMediaPathError
  );
});
