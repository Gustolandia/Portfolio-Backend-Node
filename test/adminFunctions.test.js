import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler as createAdminFilesHandler } from "../netlify/functions/admin-files.js";
import { createHandler as createAdminImagesHandler } from "../netlify/functions/admin-images.js";
import { createHandler as createLoginHandler } from "../netlify/functions/admin-login.js";
import { createHandler as createLogoutHandler } from "../netlify/functions/admin-logout.js";
import { createHandler as createAdminPhotosHandler } from "../netlify/functions/admin-photos.js";
import { createHandler as createAdminDataHandler } from "../netlify/functions/admin-portfolio-data.js";
import { createHandler as createSessionHandler } from "../netlify/functions/admin-session.js";
import { createHandler as createAdminSnippetsHandler } from "../netlify/functions/admin-snippets.js";
import { createAdminSessionService } from "../src/admin/adminSessionService.js";
import { ImageKitMediaPathError } from "../src/media/imageKitMediaService.js";
import { PortfolioService } from "../src/services/portfolioService.js";

const origin = "http://localhost:3000";
const sessionSecret = "a-long-test-secret-for-admin-session-signing";
const allowedOrigins = [
  "http://localhost:3000",
  "https://gustavopedroricou.netlify.app",
  "https://gustavopedroricou.com",
  "https://www.gustavopedroricou.com"
];

function completePortfolioPayload(overrides = {}) {
  return {
    pages: {
      home: {
        title: "Home",
        description: "Home page",
        imageUrl: "https://example.com/home.jpg"
      },
      experience: {
        title: "Experience",
        description: "",
        imageUrl: ""
      },
      education: {
        title: "Education",
        description: "",
        imageUrl: ""
      },
      projects: {
        title: "Projects",
        description: "",
        imageUrl: ""
      },
      contact: {
        title: "Contact",
        description: "",
        imageUrl: ""
      }
    },
    jobs: [],
    education: [],
    projects: [],
    ...overrides
  };
}

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

function authenticatedSession() {
  return {
    authenticated: true,
    csrfToken: "csrf",
    user: {
      email: "admin@example.com"
    }
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
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  assert.match(response.headers["Set-Cookie"], /HttpOnly/);
  assert.match(response.headers["Set-Cookie"], /Secure/);
  assert.match(response.headers["Set-Cookie"], /SameSite=None/);
  assert.equal(body.authenticated, true);
  assert.equal(body.user.email, "admin@example.com");
  assert.equal(typeof body.csrfToken, "string");
});

test("admin session CORS echoes each approved frontend origin", async () => {
  const handler = createSessionHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: false
      })
    }
  });

  for (const allowedOrigin of allowedOrigins) {
    const response = await handler(
      event({
        headers: {
          origin: allowedOrigin
        },
        method: "GET"
      })
    );

    assert.equal(response.statusCode, 401);
    assert.equal(response.headers["Access-Control-Allow-Origin"], allowedOrigin);
    assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  }
});

test("admin endpoint with unapproved origin does not return wildcard CORS", async () => {
  const handler = createSessionHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: false
      })
    }
  });

  const response = await handler(
    event({
      headers: {
        origin: "https://evil.example.com"
      },
      method: "GET"
    })
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.notEqual(response.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(response.headers["Access-Control-Allow-Credentials"], undefined);
});

test("admin server errors include CORS for approved origins without leaking details", async () => {
  const handler = createSessionHandler({
    logger: {
      error: () => {}
    },
    sessionService: {
      readSession: async () => {
        throw new Error("secret provider detail");
      }
    }
  });

  const response = await handler(event({ method: "GET" }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 500);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  assert.deepEqual(body, {
    error: "Internal Server Error"
  });
});

test("admin preflight for portfolio save includes credentialed exact-origin CORS", async () => {
  const handler = createAdminDataHandler();
  const response = await handler(
    event({
      headers: {
        "access-control-request-headers": "Content-Type, X-CSRF-Token",
        "access-control-request-method": "PUT",
        origin
      },
      method: "OPTIONS"
    })
  );

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  assert.equal(response.headers["Access-Control-Allow-Headers"], "Content-Type, X-CSRF-Token");
  assert.equal(response.headers["Access-Control-Allow-Methods"], "GET, POST, PUT, OPTIONS");
  assert.equal(response.headers.Allow, "GET, PUT, OPTIONS");
  assert.equal(response.body, "");
});

test("admin media endpoints require a session", async () => {
  const handler = createAdminImagesHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: false
      })
    }
  });

  const response = await handler(event({ method: "GET" }));

  assert.equal(response.statusCode, 401);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
});

test("admin photos endpoint returns ImageKit photo assets for authenticated sessions", async () => {
  const handler = createAdminPhotosHandler({
    imageKitMediaService: {
      listPhotos: async (query) => ({
        limit: 100,
        path: query.path,
        photos: [
          {
            fileId: "photo_1",
            name: "Photo.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Photo.jpg"
          }
        ],
        skip: 0,
        sort: "ASC_CREATED"
      })
    },
    sessionService: {
      readSession: async () => authenticatedSession()
    }
  });

  const response = await handler({
    ...event({ method: "GET" }),
    queryStringParameters: {
      path: "/Portfolio Website/Photos"
    }
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.photos[0].fileId, "photo_1");
  assert.equal(body.path, "/Portfolio Website/Photos");
});

test("admin snippets endpoint returns ImageKit snippet assets for authenticated sessions", async () => {
  const handler = createAdminSnippetsHandler({
    imageKitMediaService: {
      listSnippets: async (query) => ({
        images: [
          {
            fileId: "snippet_1",
            name: "Snippet.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Snippet.jpg"
          }
        ],
        limit: 100,
        path: query.path,
        snippets: [
          {
            fileId: "snippet_1",
            name: "Snippet.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Snippet.jpg"
          }
        ],
        skip: 0,
        sort: "ASC_CREATED"
      })
    },
    sessionService: {
      readSession: async () => authenticatedSession()
    }
  });

  const response = await handler({
    ...event({ method: "GET" }),
    queryStringParameters: {
      path: "/Portfolio Website/Snippets"
    }
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.snippets[0].fileId, "snippet_1");
  assert.equal(body.path, "/Portfolio Website/Snippets");
});

test("admin images endpoint remains a compatibility alias for snippets", async () => {
  const handler = createAdminImagesHandler({
    imageKitMediaService: {
      listImages: async () => ({
        images: [
          {
            fileId: "snippet_alias",
            name: "Snippet.jpg",
            url: "https://ik.imagekit.io/Gustolandia/Snippet.jpg"
          }
        ],
        limit: 100,
        path: "/Portfolio Website/Snippets",
        skip: 0,
        sort: "ASC_CREATED"
      })
    },
    sessionService: {
      readSession: async () => authenticatedSession()
    }
  });

  const response = await handler(event({ method: "GET" }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.images[0].fileId, "snippet_alias");
});

test("admin files endpoint returns ImageKit non-image assets for authenticated sessions", async () => {
  const handler = createAdminFilesHandler({
    imageKitMediaService: {
      listFiles: async () => ({
        files: [
          {
            fileId: "file_1",
            name: "Article.pdf",
            url: "https://ik.imagekit.io/Gustolandia/Article.pdf"
          }
        ],
        limit: 100,
        path: "/Portfolio Website",
        skip: 0,
        sort: "ASC_CREATED"
      })
    },
    sessionService: {
      readSession: async () => authenticatedSession()
    }
  });

  const response = await handler(event({ method: "GET" }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.files[0].fileId, "file_1");
  assert.equal(body.path, "/Portfolio Website");
});

test("admin media endpoints return 400 for invalid ImageKit media paths", async () => {
  const handler = createAdminImagesHandler({
    imageKitMediaService: {
      listImages: async () => {
        throw new ImageKitMediaPathError("outside root");
      }
    },
    sessionService: {
      readSession: async () => authenticatedSession()
    }
  });

  const response = await handler(event({ method: "GET" }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(body, {
    error: "Invalid media path"
  });
});

test("admin preflight with unapproved origin is rejected without CORS origin", async () => {
  const handler = createAdminDataHandler();
  const response = await handler(
    event({
      headers: {
        origin: "https://evil.example.com"
      },
      method: "OPTIONS"
    })
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(response.headers.Vary, "Origin");
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

test("admin logout rejects invalid CSRF token", async () => {
  const session = {
    authenticated: true,
    csrfToken: "csrf",
    user: {
      email: "admin@example.com"
    }
  };
  const handler = createLogoutHandler({
    sessionService: {
      readSession: async () => session,
      validateCsrfToken: () => false
    }
  });

  const response = await handler(
    event({
      headers: {
        "x-csrf-token": "wrong"
      },
      method: "POST"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(body, {
    error: "Invalid CSRF token"
  });
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
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
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
});

test("admin portfolio endpoint returns data for authenticated reads", async () => {
  const handler = createAdminDataHandler({
    portfolioService: {
      getPortfolioData: async () => completePortfolioPayload()
    },
    sessionService: {
      readSession: async () => ({
        authenticated: true,
        csrfToken: "csrf",
        user: {
          email: "admin@example.com"
        }
      })
    }
  });

  const response = await handler(event({ method: "GET" }));
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.pages.home.title, "Home");
  assert.deepEqual(body.jobs, []);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
});

test("admin portfolio endpoint rejects unauthenticated writes", async () => {
  const handler = createAdminDataHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: false
      })
    }
  });

  const response = await handler(
    event({
      body: completePortfolioPayload(),
      method: "PUT"
    })
  );

  assert.equal(response.statusCode, 401);
});

test("admin portfolio endpoint rejects writes with invalid CSRF token", async () => {
  const handler = createAdminDataHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: true,
        csrfToken: "csrf",
        user: {
          email: "admin@example.com"
        }
      }),
      validateCsrfToken: () => false
    }
  });

  const response = await handler(
    event({
      body: completePortfolioPayload(),
      headers: {
        "x-csrf-token": "wrong"
      },
      method: "PUT"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 403);
  assert.deepEqual(body, {
    error: "Invalid CSRF token"
  });
});

test("admin portfolio endpoint rejects incomplete write payloads", async () => {
  const handler = createAdminDataHandler({
    sessionService: {
      readSession: async () => ({
        authenticated: true,
        csrfToken: "csrf",
        user: {
          email: "admin@example.com"
        }
      }),
      validateCsrfToken: () => true
    }
  });

  const response = await handler(
    event({
      body: {
        pages: {
          home: {
            title: "Home"
          }
        },
        jobs: []
      },
      headers: {
        "x-csrf-token": "csrf"
      },
      method: "PUT"
    })
  );
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.equal(body.error, "Invalid portfolio payload");
  assert.ok(body.details.some((detail) => detail.includes("education")));
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
        ...completePortfolioPayload(),
        jobs: [
          {
            company: "Company",
            duration: "Deprecated",
            end: "2023-01-01",
            unsafe: "remove"
          },
          {
            company: "Latest Company",
            duration: "Deprecated",
            end: "2024-01-01"
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
    description: "Home page",
    imageUrl: "https://example.com/home.jpg"
  });
  assert.deepEqual(savedData.jobs, [
    {
      title: "",
      company: "Latest Company",
      location: "",
      start: "",
      end: "2024-01-01",
      imageUrls: [],
      imageTitles: [],
      duties: [],
      skills: [],
      mapLocation: ""
    },
    {
      title: "",
      company: "Company",
      location: "",
      start: "",
      end: "2023-01-01",
      imageUrls: [],
      imageTitles: [],
      duties: [],
      skills: [],
      mapLocation: ""
    }
  ]);
  assert.equal(Object.hasOwn(savedData.jobs[0], "duration"), false);
  assert.equal(body.pages.home.title, "Home");
});
