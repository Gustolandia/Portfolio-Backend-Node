import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandler as createAdminHandler } from "../netlify/functions/admin-portfolio-data.js";
import { createHandler as createPublicHandler } from "../netlify/functions/portfolio-data.js";
import { createAdminSessionService } from "../src/admin/adminSessionService.js";
import { PortfolioService } from "../src/services/portfolioService.js";
import { RedisPortfolioStore } from "../src/storage/redisPortfolioStore.js";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";
import { readFile } from "node:fs/promises";
import { DEFAULT_PORTFOLIO_DATA_PATH } from "../src/storage/jsonPortfolioStore.js";

const origin = "http://localhost:3000";

async function setup() {
  let stored = { jobs: [{ title: "Research Intern", company: "Example lab" }], projects: [{ name: "Report on Reflectometry" }] };
  const writes = [];
  const portfolioService = new PortfolioService({
    store: new RedisPortfolioStore({
      key: "portfolio:test",
      redis: {
        get: async () => structuredClone(stored),
        set: async (key, data) => {
          writes.push({ key, data: structuredClone(data) });
          stored = structuredClone(data);
        }
      }
    })
  });
  const sessionService = createAdminSessionService({ getSessionSecret: () => "academic-contract-test-signing-secret" });
  const session = await sessionService.createSession({ email: "admin@example.org" });
  const admin = createAdminHandler({ portfolioService, sessionService });
  const publicHandler = createPublicHandler({ portfolioService });
  const event = (method, body, csrf = session.csrfToken) => ({
    httpMethod: method,
    headers: { origin, cookie: session.cookie, ...(csrf === undefined ? {} : { "x-csrf-token": csrf }) },
    body: body === undefined ? "" : JSON.stringify(body)
  });
  return { admin, publicHandler, event, writes, getStored: () => stored };
}

test("legacy GETs compute stable IDs/defaults without writing Redis or requiring public auth", async () => {
  const { admin, publicHandler, event, writes } = await setup();
  const first = await publicHandler({ httpMethod: "GET", headers: {} });
  const second = await admin(event("GET"));
  const third = await publicHandler({ httpMethod: "GET", headers: {} });
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(first.headers["Set-Cookie"], undefined);
  assert.equal(second.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(second.headers["Access-Control-Allow-Credentials"], "true");
  assert.deepEqual(JSON.parse(first.body), JSON.parse(second.body));
  assert.equal(first.body, third.body);
  assert.equal(JSON.parse(first.body).profile.email, "");
  assert.equal(writes.length, 0);
});

test("academic PUT persists metadata and IDs, then public GET returns the saved payload", async () => {
  const { admin, publicHandler, event, writes, getStored } = await setup();
  const initial = JSON.parse((await admin(event("GET"))).body);
  const roleId = initial.jobs[0].id;
  const projectId = initial.projects[0].id;
  initial.profile = { name: "", headline: "", summary: "", location: "", email: "public@example.org", cvUrl: "", portraitUrl: "https://example.org/approved-portrait.jpg", researchInterests: [] };
  initial.research = {};
  initial.jobs[0].title = "Renamed role";
  Object.assign(initial.projects[0], {
    name: "Renamed report", status: "in-preparation", outputType: "manuscript",
    contribution: "Analysis", relatedRoleIds: [roleId], collaborators: ["Example Author"],
    imageUrls: ["/a.png", "", "/b.png"],
    imageDescriptions: ["A", "Discard", "B"], imageBackupDescriptions: ["Backup A", "Discard", "Backup B"],
    links: ["https://example.org/report.pdf"], linksDescriptions: ["Working manuscript"], linksBackupDescriptions: ["Report link"]
  });
  const response = await admin(event("PUT", initial));
  const saved = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key, "portfolio:test");
  assert.deepEqual(getStored(), saved);
  assert.equal(saved.jobs[0].id, roleId);
  assert.equal(saved.jobs[0].category, "research");
  assert.equal(saved.projects[0].id, projectId);
  assert.equal(saved.projects[0].status, "in-preparation");
  assert.deepEqual(saved.projects[0].relatedRoleIds, [roleId]);
  assert.deepEqual(saved.projects[0].imageDescriptions, ["A", "B"]);
  assert.deepEqual(saved.projects[0].imageBackupDescriptions, ["Backup A", "Backup B"]);
  assert.equal(saved.profile.name, "");
  assert.equal(saved.profile.portraitUrl, "https://example.org/approved-portrait.jpg");
  assert.equal(saved.research.thesisSummary, "");
  const publicResponse = await publicHandler({ httpMethod: "GET", headers: {} });
  assert.deepEqual(JSON.parse(publicResponse.body), saved);
  assert.equal(publicResponse.headers["Set-Cookie"], undefined);
});

test("legacy saves preserve existing profile/research while explicit empties clear them", async () => {
  const { admin, event } = await setup();
  const body = JSON.parse((await admin(event("GET"))).body);
  body.profile.email = "public@example.org";
  body.research.thesisTitle = "Explicit working title";
  assert.equal((await admin(event("PUT", body))).statusCode, 200);
  delete body.profile;
  delete body.research;
  const legacySaved = JSON.parse((await admin(event("PUT", body))).body);
  assert.equal(legacySaved.profile.email, "public@example.org");
  assert.equal(legacySaved.research.thesisTitle, "Explicit working title");
  const cleared = JSON.parse((await admin(event("PUT", { ...legacySaved, profile: {}, research: {} }))).body);
  assert.equal(cleared.profile.email, "");
  assert.equal(cleared.research.thesisTitle, "");
});

test("supervisor survives authenticated PUT/public GET and omitted-field legacy saves; explicit empty clears", async () => {
  const { admin, publicHandler, event, getStored, writes } = await setup();
  const body = JSON.parse((await admin(event("GET"))).body);
  Object.assign(body.research, { thesisSupervisor: "Van-Dinh Nguyen", thesisInstitution: "Trinity College Dublin", thesisStart: "2026-09-25", thesisEnd: "2027-04-19" });
  const saved = await admin(event("PUT", body));
  assert.equal(saved.statusCode, 200);
  assert.equal(getStored().research.thesisSupervisor, "Van-Dinh Nguyen");
  const publicResponse = await publicHandler({ httpMethod: "GET", headers: {} });
  assert.equal(publicResponse.headers["Access-Control-Allow-Origin"], "*");
  assert.equal(publicResponse.headers["Set-Cookie"], undefined);
  assert.equal(JSON.parse(publicResponse.body).research.thesisSupervisor, "Van-Dinh Nguyen");
  delete body.research.thesisSupervisor;
  body.research.thesisSummary = "Updated aim, not an established result.";
  const legacy = JSON.parse((await admin(event("PUT", body))).body);
  assert.equal(legacy.research.thesisSupervisor, "Van-Dinh Nguyen");
  assert.equal(legacy.research.thesisSummary, body.research.thesisSummary);
  assert.equal((await admin(event("PUT", { ...body, research: { ...body.research, thesisSupervisor: 4 } }))).statusCode, 400);
  const denied = event("PUT", body); delete denied.headers.cookie;
  assert.equal((await admin(denied)).statusCode, 401);
  assert.equal((await admin(event("PUT", body, "bad-csrf"))).statusCode, 403);
  assert.equal(writes.length, 2);
  const cleared = JSON.parse((await admin(event("PUT", { ...body, research: { ...body.research, thesisSupervisor: "" } }))).body);
  assert.equal(cleared.research.thesisSupervisor, "");
});

test("a complete frontend payload with unspecified project fields survives PUT and public GET", async () => {
  const { admin, publicHandler, event, getStored } = await setup();
  const legacy = JSON.parse(await readFile(DEFAULT_PORTFOLIO_DATA_PATH, "utf8"));
  const body = normalizePortfolioData(legacy);
  body.projects = body.projects.map((project) => ({ ...project, outputType: "", status: "" }));
  body.research.thesisStatus = "";
  assert.equal(validateCompletePortfolioPayload(body).valid, true);
  const response = await admin(event("PUT", body));
  assert.equal(response.statusCode, 200);
  const saved = JSON.parse(response.body);
  assert.deepEqual(saved, body);
  assert.deepEqual(getStored(), body);
  const publicResponse = await publicHandler({ httpMethod: "GET", headers: {} });
  assert.deepEqual(JSON.parse(publicResponse.body), body);
  assert.ok(saved.projects.every((project) => project.outputType === "" && project.status === ""));
  assert.equal(saved.research.thesisStatus, "");
});

test("invalid academic writes return 400 with CORS and never reach Redis", async () => {
  const { admin, event, writes } = await setup();
  const body = JSON.parse((await admin(event("GET"))).body);
  for (const changed of [
    { profile: { cvUrl: "javascript:alert(1)" } },
    { profile: { portraitUrl: "javascript:alert(1)" } },
    { projects: [{ status: "v1.0.0" }] },
    { jobs: [{ category: "unknown" }] },
    { projects: [{ relatedRoleIds: ["missing-role"] }] }
  ]) {
    const response = await admin(event("PUT", { ...body, ...changed }));
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["Access-Control-Allow-Origin"], origin);
    assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  }
  assert.equal(writes.length, 0);
});

test("academic writes still enforce cookie authentication, CSRF and allowed methods", async () => {
  const { admin, event, writes } = await setup();
  const body = JSON.parse((await admin(event("GET"))).body);
  const unauthenticated = event("PUT", body);
  delete unauthenticated.headers.cookie;
  assert.equal((await admin(unauthenticated)).statusCode, 401);
  const missingCsrf = event("PUT", body);
  delete missingCsrf.headers["x-csrf-token"];
  assert.equal((await admin(missingCsrf)).statusCode, 403);
  assert.equal((await admin(event("PUT", body, "bad-token"))).statusCode, 403);
  assert.equal((await admin(event("PATCH", body))).statusCode, 405);
  assert.equal(writes.length, 0);
});

test("legacy admin saves retain omitted authors by ID, explicit clears work and ID-less omissions fail safely", async () => {
  const { admin, publicHandler, event, writes } = await setup();
  const initial = JSON.parse((await admin(event("GET"))).body);
  initial.projects[0].authors = ["First Author", "Second Author"];
  initial.projects[0].collaborators = ["Separate Collaborator"];
  initial.projects[0].skills = ["React.js", "React", "An arbitrary new skill"];
  assert.equal((await admin(event("PUT", initial))).statusCode, 200);
  const legacy = structuredClone(initial);
  delete legacy.projects[0].authors;
  legacy.projects[0].name = "Renamed by old editor";
  const preserved = JSON.parse((await admin(event("PUT", legacy))).body);
  assert.deepEqual(preserved.projects[0].authors, ["First Author", "Second Author"]);
  assert.deepEqual(preserved.projects[0].collaborators, ["Separate Collaborator"]);
  assert.deepEqual(preserved.projects[0].skills, ["React", "An arbitrary new skill"]);
  assert.equal(Object.hasOwn(legacy.projects[0], "authors"), false);
  const unsupported = structuredClone(legacy);
  delete unsupported.projects[0].id;
  const count = writes.length;
  const rejected = await admin(event("PUT", unsupported));
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.headers["Access-Control-Allow-Origin"], origin);
  assert.equal(writes.length, count);
  const publicData = JSON.parse((await publicHandler({ httpMethod: "GET", headers: {} })).body);
  assert.deepEqual(publicData.projects[0].authors, ["First Author", "Second Author"]);
  preserved.projects[0].authors = [];
  const cleared = JSON.parse((await admin(event("PUT", preserved))).body);
  assert.deepEqual(cleared.projects[0].authors, []);
});
