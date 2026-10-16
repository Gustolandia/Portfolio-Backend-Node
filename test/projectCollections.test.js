import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler as createAdminHandler } from "../netlify/functions/admin-portfolio-data.js";
import { createHandler as createPublicHandler } from "../netlify/functions/portfolio-data.js";
import { createAdminSessionService } from "../src/admin/adminSessionService.js";
import { PortfolioService } from "../src/services/portfolioService.js";
import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";

const origin = "http://localhost:3000";
const withoutCollections = (data) => {
  const copy = structuredClone(data);
  copy.projects.forEach((project) => delete project.collections);
  return copy;
};

/** Creates complete legacy content with independently ordered media metadata. */
function legacyPayload() {
  return withoutCollections(normalizePortfolioData({
    profile: { name: "Example Researcher", location: "", availability: "Explicit availability" },
    research: { thesisTitle: "Explicit research aim", thesisSupervisor: "Example supervisor" },
    jobs: [{ id: "role-one", title: "Research role", company: "Example lab", category: "research" }],
    education: [{ degree: "Example degree", institution: "Example university", programme: "Example programme" }],
    projects: [
      {
        id: "project-one", category: "research", name: "First output", dateOfCompletion: "2025-03-01",
        featuredOrder: 2, outputType: "preprint", status: "preprint", authors: ["First Author", "Second Author"],
        relatedRoleIds: ["role-one"], contribution: "Explicit contribution", collaborators: ["Collaborator"],
        affiliations: ["Example lab"], skills: ["Python", "Statistics"],
        imageUrls: ["/first.png", "/second.png"], imageTitles: ["First", "Second"],
        imageDescriptions: ["First", "Second"], imageBackupDescriptions: ["First backup", "Second backup"],
        links: ["/first.pdf", "https://example.org/second.pdf"], linksTitles: ["Report", "Code"],
        linksDescriptions: ["Report", "Code"], linksBackupDescriptions: ["Report backup", "Code backup"]
      },
      { id: "project-two", category: "software", name: "Second output", dateOfCompletion: "2024-01-01" }
    ]
  }));
}

/** Exercises real cookie/CSRF handlers with an isolated in-memory Redis client. */
async function setup(seed = legacyPayload()) {
  let stored = structuredClone(seed);
  let reads = 0;
  const writes = [];
  const portfolioService = new PortfolioService({ store: new RedisPortfolioStore({
    key: "portfolio:collections-test",
    redis: {
      get: async () => { reads += 1; return structuredClone(stored); },
      set: async (key, value) => {
        writes.push({ key, value: structuredClone(value) });
        stored = structuredClone(value);
      }
    }
  }) });
  const sessionService = createAdminSessionService({
    getSessionSecret: () => "project-collections-test-signing-secret",
    secure: true,
    sameSite: "None"
  });
  const session = await sessionService.createSession({ email: "admin@example.test" });
  const admin = createAdminHandler({ portfolioService, sessionService });
  const publicHandler = createPublicHandler({ portfolioService });
  const event = (method, body, { authenticated = true, csrf = session.csrfToken } = {}) => ({
    httpMethod: method,
    headers: {
      origin,
      ...(authenticated ? { cookie: session.cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {})
    },
    body: body === undefined ? "" : JSON.stringify(body)
  });
  return { admin, publicHandler, event, writes, getStored: () => structuredClone(stored), getReads: () => reads };
}

test("legacy projects default to empty collections without classification, writes or mutation", () => {
  const source = legacyPayload();
  const before = structuredClone(source);
  const normalized = normalizePortfolioData(source);
  assert.deepEqual(normalized.projects.map((project) => project.collections), [[], []]);
  assert.deepEqual(withoutCollections(normalized), before);
  assert.deepEqual(source, before);
  assert.equal(Object.hasOwn(normalized.jobs[0], "collections"), false);
  assert.equal(Object.hasOwn(normalized.education[0], "collections"), false);
});

test("collection labels trim and deduplicate exactly while preserving case and first occurrence order", () => {
  const source = legacyPayload();
  const labels = [" Machine learning ", "", "Scientific computing", "Machine learning", "machine learning", "  "];
  source.projects[0].collections = labels;
  const normalized = normalizePortfolioData(source);
  assert.deepEqual(normalized.projects[0].collections, ["Machine learning", "Scientific computing", "machine learning"]);
  assert.deepEqual(source.projects[0].collections, labels);
  assert.deepEqual(normalizePortfolioData(normalized), normalized);
});

test("malformed stored collections sanitize safely without inventing labels", () => {
  for (const value of [null, "Research", 12, {}, false]) {
    const source = legacyPayload();
    source.projects[0].collections = value;
    assert.deepEqual(normalizePortfolioData(source).projects[0].collections, []);
  }
  const source = legacyPayload();
  source.projects[0].collections = [null, " A ", 2, "", {}, "A", "B"];
  assert.deepEqual(normalizePortfolioData(source).projects[0].collections, ["A", "B"]);
});

test("collections do not alter stable IDs, categories, chronological order, bylines or media tuples", () => {
  const source = legacyPayload();
  const expected = normalizePortfolioData(source);
  source.projects[0].collections = ["Software", "Methods"];
  source.projects[1].collections = ["Research", "Methods"];
  source.projects.reverse();
  const result = normalizePortfolioData(source);
  assert.deepEqual(withoutCollections(result), withoutCollections(expected));
  assert.deepEqual(result.projects.map((project) => project.id), ["project-one", "project-two"]);
  assert.deepEqual(result.projects.map((project) => project.category), ["research", "software"]);
  const legacy = { projects: [{ name: "Legacy title", dateOfCompletion: "2020" }] };
  const id = normalizePortfolioData(legacy).projects[0].id;
  legacy.projects[0].collections = ["Any explicit label"];
  assert.equal(normalizePortfolioData(legacy).projects[0].id, id);
});

test("PUT validation accepts missing or string-array collections and rejects all supplied non-string-array types", () => {
  const body = legacyPayload();
  assert.equal(validateCompletePortfolioPayload(body).valid, true);
  for (const valid of [[], [""], ["A", " A ", "B"]]) {
    body.projects[0].collections = valid;
    assert.equal(validateCompletePortfolioPayload(body).valid, true);
  }
  for (const invalid of [null, "A", 2, false, {}, [2], [null], ["A", {}]]) {
    body.projects[0].collections = invalid;
    const result = validateCompletePortfolioPayload(body);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes("projects[0].collections")));
  }
});

test("public and admin GETs provide collections defaults without persisting a Redis migration", async () => {
  const seed = legacyPayload();
  const h = await setup(seed);
  const publicResponse = await h.publicHandler({ httpMethod: "GET", headers: {} });
  const adminResponse = await h.admin(h.event("GET"));
  assert.equal(publicResponse.statusCode, 200);
  assert.equal(publicResponse.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(publicResponse.headers["Set-Cookie"], undefined);
  assert.deepEqual(JSON.parse(publicResponse.body), JSON.parse(adminResponse.body));
  assert.deepEqual(JSON.parse(publicResponse.body).projects.map((project) => project.collections), [[], []]);
  assert.deepEqual(h.getStored(), seed);
  assert.equal(h.writes.length, 0);
});

test("authenticated PUT stores normalized collections and public GET returns the same complete payload", async () => {
  const h = await setup();
  const body = JSON.parse((await h.admin(h.event("GET"))).body);
  const before = structuredClone(body);
  body.projects[0].collections = [" Machine learning ", "Scientific computing", "Machine learning", ""];
  body.projects[1].collections = ["Scientific computing"];
  const response = await h.admin(h.event("PUT", body));
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  const saved = JSON.parse(response.body);
  assert.deepEqual(saved.projects[0].collections, ["Machine learning", "Scientific computing"]);
  assert.deepEqual(withoutCollections(saved), withoutCollections(before));
  assert.deepEqual(h.getStored(), saved);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].key, "portfolio:collections-test");
  assert.deepEqual(JSON.parse((await h.publicHandler({ httpMethod: "GET" })).body), saved);
});

test("legacy omission retains collections by stable ID through rename and reorder with one storage read", async () => {
  const seed = legacyPayload();
  seed.projects[0].collections = ["Methods", "Research"];
  seed.projects[1].collections = ["Software"];
  const h = await setup(seed);
  const body = withoutCollections(JSON.parse((await h.admin(h.event("GET"))).body));
  body.projects[0].name = "Renamed output";
  body.projects[0].dateOfCompletion = "2022";
  body.projects.reverse();
  const beforeReads = h.getReads();
  const response = await h.admin(h.event("PUT", body));
  assert.equal(response.statusCode, 200);
  assert.equal(h.getReads() - beforeReads, 1);
  const saved = JSON.parse(response.body);
  assert.deepEqual(saved.projects.find((project) => project.id === "project-one").collections, ["Methods", "Research"]);
  assert.deepEqual(saved.projects.find((project) => project.id === "project-two").collections, ["Software"]);
  assert.equal(saved.projects[0].id, "project-two");
});

test("explicit empty collections clear assignments and later legacy omission never rehydrates them", async () => {
  const seed = legacyPayload();
  seed.projects[0].collections = ["Methods"];
  const h = await setup(seed);
  const body = JSON.parse((await h.admin(h.event("GET"))).body);
  body.projects[0].collections = [];
  const cleared = await h.admin(h.event("PUT", body));
  assert.equal(cleared.statusCode, 200);
  const legacy = withoutCollections(JSON.parse(cleared.body));
  const saved = await h.admin(h.event("PUT", legacy));
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(JSON.parse(saved.body).projects[0].collections, []);
  assert.deepEqual(h.getStored().projects[0].collections, []);
});

test("invalid collection writes return readable 400 CORS responses without changing storage", async () => {
  const h = await setup();
  const initial = h.getStored();
  for (const invalid of [null, "Methods", 3, false, {}, [null], ["Methods", 4]]) {
    const body = normalizePortfolioData(initial);
    body.projects[0].collections = invalid;
    const response = await h.admin(h.event("PUT", body));
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
    assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
    assert.ok(JSON.parse(response.body).details.some((error) => error.includes("collections")));
  }
  assert.deepEqual(h.getStored(), initial);
  assert.equal(h.writes.length, 0);
});

test("collection writes preserve cookie authentication, CSRF, methods and preflight protections", async () => {
  const h = await setup();
  const body = normalizePortfolioData(legacyPayload());
  body.projects[0].collections = ["Methods"];
  assert.equal((await h.admin(h.event("PUT", body, { authenticated: false }))).statusCode, 401);
  assert.equal((await h.admin(h.event("GET", undefined, { authenticated: false }))).statusCode, 401);
  assert.equal((await h.admin(h.event("PUT", body, { csrf: null }))).statusCode, 403);
  assert.equal((await h.admin(h.event("PUT", body, { csrf: "wrong" }))).statusCode, 403);
  assert.equal((await h.admin(h.event("PATCH", body))).statusCode, 405);
  const allowed = await h.admin(h.event("OPTIONS", undefined, { authenticated: false, csrf: null }));
  assert.equal(allowed.statusCode, 204);
  assert.equal(allowed.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(allowed.headers["Access-Control-Allow-Credentials"], "true");
  assert.equal(allowed.headers["Set-Cookie"], undefined);
  const denied = h.event("OPTIONS");
  denied.headers.origin = "https://unapproved.example.test";
  const response = await h.admin(denied);
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["Access-Control-Allow-Origin"], undefined);
  assert.equal(h.writes.length, 0);
});

test("unmatched collection-omitting legacy records fail safely when stored assignments exist", async () => {
  const seed = legacyPayload();
  seed.projects[0].collections = ["Methods"];
  for (const id of [undefined, "unknown-project"]) {
    const h = await setup(seed);
    const body = normalizePortfolioData(seed);
    delete body.projects[0].collections;
    if (id === undefined) delete body.projects[0].id;
    else body.projects[0].id = id;
    const response = await h.admin(h.event("PUT", body));
    assert.equal(response.statusCode, 400);
    assert.ok(JSON.parse(response.body).details.some((error) => error.includes("collections")));
    assert.deepEqual(h.getStored(), seed);
    assert.equal(h.writes.length, 0);
  }
});

test("new explicit-empty projects and intentional record deletion do not restore old memberships", async () => {
  const seed = legacyPayload();
  seed.projects[0].collections = ["Methods"];
  const h = await setup(seed);
  const body = normalizePortfolioData(seed);
  body.projects = body.projects.filter((project) => project.id !== "project-one");
  body.projects.push({ id: "new-project", name: "New output", authors: [], collections: [] });
  const response = await h.admin(h.event("PUT", body));
  assert.equal(response.statusCode, 200);
  const saved = JSON.parse(response.body);
  assert.equal(saved.projects.some((project) => project.id === "project-one"), false);
  assert.deepEqual(saved.projects.find((project) => project.id === "new-project").collections, []);
  assert.equal(saved.projects.some((project) => project.collections.includes("Methods")), false);
});
