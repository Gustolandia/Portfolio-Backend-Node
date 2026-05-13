import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler } from "../netlify/functions/portfolio-data.js";

test("portfolio-data function returns the full payload for GET requests", async () => {
  const handler = createHandler({
    portfolioService: {
      getPortfolioData: async () => ({
        pages: {
          home: {
            title: "Home",
            description: "",
            imageUrl: ""
          }
        },
        jobs: [],
        education: [],
        projects: []
      })
    }
  });

  const response = await handler({
    httpMethod: "GET",
    headers: {}
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(response.headers["Access-Control-Allow-Credentials"], undefined);
  assert.equal(body.pages.home.title, "Home");
  assert.deepEqual(body.jobs, []);
});

test("portfolio-data function handles CORS preflight requests", async () => {
  const handler = createHandler();
  const response = await handler({
    httpMethod: "OPTIONS",
    headers: {}
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers.Allow, "GET, OPTIONS");
  assert.equal(response.body, "");
});

test("portfolio-data function requires auth before non-GET methods", async () => {
  const handler = createHandler({
    authService: {
      authenticateEvent: async () => ({
        authenticated: false
      })
    }
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {}
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 401);
  assert.equal(body.error, "Unauthorized");
});

test("portfolio-data function rejects authenticated unsupported methods", async () => {
  const handler = createHandler({
    authService: {
      authenticateEvent: async () => ({
        authenticated: true,
        principal: {
          subject: "admin"
        }
      })
    }
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {}
  });

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "GET, OPTIONS");
});
