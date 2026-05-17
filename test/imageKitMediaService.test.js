import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ImageKitMediaPathError,
  ImageKitMediaService,
  normalizeImageKitAsset
} from "../src/media/imageKitMediaService.js";

test("normalizes ImageKit assets without exposing provider credentials", () => {
  assert.deepEqual(
    normalizeImageKitAsset(
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        fileId: "file_123",
        filePath: "/Portfolio Website/Snippets/Profile Photo.jpg",
        fileType: "image",
        height: 200,
        name: "Profile Photo.jpg",
        privateKey: "should-not-leak",
        size: 12345,
        thumbnail: "https://ik.imagekit.io/demo/thumb.jpg",
        updatedAt: "2026-01-02T00:00:00.000Z",
        width: 300
      },
      {
        urlEndpoint: "https://ik.imagekit.io/Gustolandia/"
      }
    ),
    {
      fileId: "file_123",
      id: "file_123",
      name: "Profile Photo.jpg",
      filePath: "/Portfolio Website/Snippets/Profile Photo.jpg",
      url: "https://ik.imagekit.io/Gustolandia/Portfolio%20Website/Snippets/Profile%20Photo.jpg",
      thumbnailUrl: "https://ik.imagekit.io/demo/thumb.jpg",
      fileType: "image",
      mime: "",
      size: 12345,
      width: 300,
      height: 200,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z"
    }
  );
});

test("ImageKit media service lists photo assets from the configured folder", async () => {
  let requestUrl;
  let authorizationHeader;
  const service = new ImageKitMediaService({
    fetcher: async (url, options) => {
      requestUrl = url;
      authorizationHeader = options.headers.Authorization;

      return {
        json: async () => [
          {
            fileId: "photo_1",
            filePath: "/Portfolio Website/Photos/photo.jpg",
            fileType: "image",
            name: "photo.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Portfolio%20Website/Photos/photo.jpg"
          }
        ],
        ok: true
      };
    },
    getPrivateKey: () => "private_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  const result = await service.listPhotos({
    folder: "Photos",
    limit: "10",
    skip: "5",
    sort: "DESC_CREATED"
  });

  assert.equal(requestUrl.searchParams.get("fileType"), "image");
  assert.equal(requestUrl.searchParams.get("path"), "/Portfolio Website/Photos");
  assert.equal(requestUrl.searchParams.get("limit"), "10");
  assert.equal(requestUrl.searchParams.get("skip"), "5");
  assert.equal(requestUrl.searchParams.get("sort"), "DESC_CREATED");
  assert.match(authorizationHeader, /^Basic /);
  assert.equal(result.photos[0].fileId, "photo_1");
});

test("ImageKit media service lists snippet image assets from the configured folder", async () => {
  let requestUrl;
  const service = new ImageKitMediaService({
    fetcher: async (url) => {
      requestUrl = url;

      return {
        json: async () => [
          {
            fileId: "snippet_1",
            filePath: "/Portfolio Website/Snippets/image.jpg",
            fileType: "image",
            name: "image.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Portfolio%20Website/Snippets/image.jpg"
          }
        ],
        ok: true
      };
    },
    getPrivateKey: () => "private_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  const result = await service.listSnippets();

  assert.equal(requestUrl.searchParams.get("fileType"), "image");
  assert.equal(requestUrl.searchParams.get("path"), "/Portfolio Website/Snippets");
  assert.equal(result.snippets[0].fileId, "snippet_1");
  assert.equal(result.images[0].fileId, "snippet_1");
});

test("ImageKit media service lists non-image file assets", async () => {
  const service = new ImageKitMediaService({
    fetcher: async (url) => ({
      json: async () => [
        {
          fileId: "file_1",
          filePath: "/Portfolio Website/Article.pdf",
          fileType: "non-image",
          name: "Article.pdf",
          url: "https://ik.imagekit.io/Gustolandia/Portfolio%20Website/Article.pdf"
        }
      ],
      ok: true,
      requestUrl: url
    }),
    getPrivateKey: () => "private_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  const result = await service.listFiles();

  assert.equal(result.path, "/Portfolio Website");
  assert.equal(result.files[0].fileId, "file_1");
});

test("ImageKit media service rejects paths outside the configured media root", async () => {
  const service = new ImageKitMediaService({
    fetcher: async () => {
      throw new Error("fetcher should not be called");
    },
    getPrivateKey: () => "private_test_key",
    getUrlEndpoint: () => "https://ik.imagekit.io/Gustolandia/",
    mediaRoot: "/Portfolio Website"
  });

  await assert.rejects(
    () => service.listImages({ path: "/Other Folder" }),
    ImageKitMediaPathError
  );
});
