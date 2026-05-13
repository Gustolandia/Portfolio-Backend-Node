import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler as createLoginHandler } from "../netlify/functions/admin-login.js";
import { createHandler as createLogoutHandler } from "../netlify/functions/admin-logout.js";
import { createHandler as createAdminDataHandler } from "../netlify/functions/admin-portfolio-data.js";
import { createHandler as createSessionHandler } from "../netlify/functions/admin-session.js";
import { createAdminSessionService } from "../src/admin/adminSessionService.js";
import { PortfolioService } from "../src/services/portfolioService.js";

const origin = "https://portfolio.example.com";
const sessionSecret = "a-long-test-secret-for-admin-session-signing";

function event({ body, headers = {}, method = "GET" } = {}) {
  return {
    body: body ? JSON.stringify(body) : "",
    headers: {
      origin,
      ...headers
    },
    httpMethod: method
  };
}

test("admin login sets an HttpOnly session cookie and returns a CSRF token", async () => {
  const handler = createLoginHandler({
    credentialService: {
      validateCredentials: async () => ({
        authenticated: true,
        user: {
          email: "admin@example.com"
        }
      })
    },
    rateLimiter: {
      consume: async () => ({
        allowed: true
      })
    },
    sessionService: createAdminSessionService({
      getSessionSecret: () => sessionSecret
    })
  });

  const response = await handler(
    event({
      body: {
        email: "admin@example.com",
        password: "password"
      },
      method: "POST"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  assert.match(response.headers["Set-Cookie"], /HttpOnly/);
  assert.match(response.headers["Set-Cookie"], /Secure/);
  assert.match(response.headers["Set-Cookie"], /SameSite=None/);
  assert.equal(body.authenticated, true);
  assert.equal(body.user.email, "admin@example.com");
  assert.equal(typeof body.csrfToken, "string");
});

test("admin login rate limits repeated attempts", async () => {
  const handler = createLoginHandler({
    rateLimiter: {
      consume: async () => ({
        allowed: false,
        retryAfterSeconds: 60
      })
    }
  });

  const response = await handler(
    event({
      body: {
        email: "admin@example.com",
        password: "password"
      },
      method: "POST"
    })
  );

  assert.equal(response.statusCode, 429);
  assert.equal(response.headers["Retry-After"], "60");
});

test("admin session returns current user and CSRF token from cookie", async () => {
  const sessionService = createAdminSessionService({
    getSessionSecret: () => sessionSecret
  });
  const session = await sessionService.createSession({
    email: "admin@example.com"
  });
  const handler = createSessionHandler({
    sessionService
  });

  const response = await handler(
    event({
      headers: {
        cookie: session.cookie
      },
      method: "GET"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.authenticated, true);
  assert.equal(body.user.email, "admin@example.com");
  assert.equal(body.csrfToken, session.csrfToken);
});

test("admin logout requires matching CSRF token and clears cookie", async () => {
  const sessionService = createAdminSessionService({
    getSessionSecret: () => sessionSecret
  });
  const session = await sessionService.createSession({
    email: "admin@example.com"
  });
  const handler = createLogoutHandler({
    sessionService
  });

  const response = await handler(
    event({
      headers: {
        cookie: session.cookie,
        "x-csrf-token": session.csrfToken
      },
      method: "POST"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(body, {
    ok: true
  });
  assert.match(response.headers["Set-Cookie"], /Max-Age=0/);
});

test("admin portfolio endpoint requires a session for reads", async () => {
  const handler = createAdminDataHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: false
      })
    }
  });

  const response = await handler(event({ method: "GET" }));

  assert.equal(response.statusCode, 401);
});

test("admin portfolio endpoint writes normalized data with valid session and CSRF", async () => {
  const session = {
    authenticated: true,
    csrfToken: "csrf",
    user: {
      email: "admin@example.com"
    }
  };
  let savedData;
  const portfolioService = new PortfolioService({
    store: {
      getPortfolioData: async () => ({}),
      setPortfolioData: async (data) => {
        savedData = data;
      }
    }
  });
  const handler = createAdminDataHandler({
    portfolioService,
    sessionService: {
      readSession: async () => session,
      validateCsrfToken: () => true
    }
  });

  const response = await handler(
    event({
      body: {
        pages: {
          home: {
            title: "Home",
            unsafe: "remove"
          }
        },
        jobs: [
          {
            company: "Company",
            unsafe: "remove"
          }
        ]
      },
      headers: {
        "x-csrf-token": "csrf"
      },
      method: "PUT"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(savedData.pages.home, {
    title: "Home",
    description: "",
    imageUrl: ""
  });
  assert.deepEqual(savedData.jobs, [
    {
      company: "Company"
    }
  ]);
  assert.equal(body.pages.home.title, "Home");
});
