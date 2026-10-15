import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";
import { PortfolioPayloadCompatibilityError, PortfolioService } from "../src/services/portfolioService.js";
import { createHandler as createAdminHandler } from "../netlify/functions/admin-portfolio-data.js";
import { createHandler as createPublicHandler } from "../netlify/functions/portfolio-data.js";
import { createAdminSessionService } from "../src/admin/adminSessionService.js";

const payload = (overrides = {}) => ({ ...normalizePortfolioData({}), ...overrides });

test("editorial profile fields default empty, preserve explicit empties and reject non-strings", () => {
  const defaults = normalizePortfolioData({});
  assert.equal(defaults.profile.academicStatus, "");
  assert.equal(defaults.profile.availability, "");
  for (const field of ["academicStatus", "availability"]) {
    const data = payload({ profile: { [field]: "Approved explicit content" } });
    assert.equal(validateCompletePortfolioPayload(data).valid, true);
    assert.equal(normalizePortfolioData(data).profile[field], "Approved explicit content");
    assert.equal(normalizePortfolioData({ profile: { [field]: "" } }).profile[field], "");
    for (const value of [null, 2, [], {}]) assert.equal(validateCompletePortfolioPayload(payload({ profile: { [field]: value } })).valid, false);
  }
});

test("featured positions are optional positive safe integers; null clears and never appears in responses", () => {
  for (const section of ["jobs", "projects"]) {
    for (const featuredOrder of [1, 4, Number.MAX_SAFE_INTEGER]) {
      const data = payload({ [section]: [{ featuredOrder }] });
      assert.equal(validateCompletePortfolioPayload(data).valid, true);
      assert.equal(normalizePortfolioData(data)[section][0].featuredOrder, featuredOrder);
    }
    assert.equal(validateCompletePortfolioPayload(payload({ [section]: [{ featuredOrder: null }] })).valid, true);
    for (const row of [{}, { featuredOrder: null }, { featuredOrder: 0 }, { featuredOrder: "1" }]) {
      assert.equal(Object.hasOwn(normalizePortfolioData({ [section]: [row] })[section][0], "featuredOrder"), false);
    }
    for (const featuredOrder of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "2", "", true, {}, []]) {
      assert.equal(validateCompletePortfolioPayload(payload({ [section]: [{ featuredOrder }] })).valid, false);
    }
  }
});

test("programme groups explicit periods without merging records or inventing defaults", () => {
  const data = normalizePortfolioData({ education: [{ institution: "A", programme: " Fusion-EP " }, { institution: "B", programme: "Fusion-EP" }] });
  assert.equal(data.education.length, 2);
  assert.deepEqual(data.education.map(row => row.programme), ["Fusion-EP", "Fusion-EP"]);
  for (const row of [{}, { programme: "" }, { programme: "  " }]) assert.equal(Object.hasOwn(normalizePortfolioData({ education: [row] }).education[0], "programme"), false);
  assert.equal(validateCompletePortfolioPayload(payload({ education: [{ programme: "" }] })).valid, true);
  for (const programme of [null, 2, [], {}]) assert.equal(validateCompletePortfolioPayload(payload({ education: [{ programme }] })).valid, false);
});

test("featured metadata never changes main date ordering or stable identities", () => {
  const data = normalizePortfolioData({
    jobs: [{ id: "old-job", end: "2019", featuredOrder: 1 }, { id: "new-job", end: "Present", featuredOrder: 4 }],
    projects: [{ id: "old-project", dateOfCompletion: "2020", featuredOrder: 1 }, { id: "new-project", dateOfCompletion: "2025", featuredOrder: 2 }]
  });
  assert.deepEqual(data.jobs.map(row => row.id), ["new-job", "old-job"]);
  assert.deepEqual(data.projects.map(row => row.id), ["new-project", "old-project"]);
  data.jobs[0].title = "Renamed job"; data.projects[0].name = "Renamed project";
  assert.deepEqual(normalizePortfolioData(data), data);
});

async function fixture() {
  let stored = normalizePortfolioData({ profile: { academicStatus: "Current programme", availability: "Approved availability" },
    jobs: [{ id: "role-a", title: "Role", category: "industry", featuredOrder: 2 }],
    education: [{ degree: "Coursework", institution: "University", start: "2013", end: "2014", programme: "Fusion-EP", imageUrls: ["/campus.jpg"] }],
    projects: [{ id: "project-a", name: "Project", featuredOrder: 1, authors: ["First", "Second"], relatedRoleIds: ["role-a"], imageUrls: ["/a.gif", "/b.jpg"], imageDescriptions: ["A", "B"], imageBackupDescriptions: ["Alt A", "Alt B"],
      links: ["/paper.pdf", "/code"], linksTitles: ["Paper", "Code"], linksBackupDescriptions: ["Read paper", "Browse code"], affiliations: ["Lab"], collaborators: ["Colleague"] }]
  });
  const writes = [];
  let reads = 0;
  const service = new PortfolioService({ store: {
    getPortfolioData: async () => { reads += 1; return structuredClone(stored); },
    setPortfolioData: async (data) => { writes.push(structuredClone(data)); stored = structuredClone(data); }
  } });
  const sessionService = createAdminSessionService({ getSessionSecret: () => "editorial-contract-test-signing-secret" });
  const session = await sessionService.createSession({ email: "admin@example.org" });
  const admin = createAdminHandler({ portfolioService: service, sessionService });
  const publicHandler = createPublicHandler({ portfolioService: service });
  const event = (data) => ({ httpMethod: "PUT", headers: { origin: "http://localhost:3000", cookie: session.cookie, "x-csrf-token": session.csrfToken }, body: JSON.stringify(data) });
  return { service, admin, publicHandler, event, writes, current: () => structuredClone(stored), readCount: () => reads };
}

test("legacy omissions retain editorial metadata while explicit empty/null values clear through authenticated PUT", async () => {
  const f = await fixture(); const original = f.current(); const body = f.current();
  delete body.profile.academicStatus; delete body.profile.availability;
  delete body.jobs[0].featuredOrder; delete body.projects[0].featuredOrder; delete body.education[0].programme;
  assert.equal((await f.admin(f.event(body))).statusCode, 200);
  assert.deepEqual(f.current(), original);
  assert.equal(f.readCount(), 1, "All compatibility omissions share one stored read");
  body.profile.academicStatus = ""; body.profile.availability = "";
  body.jobs[0].featuredOrder = null; body.projects[0].featuredOrder = null; body.education[0].programme = "";
  const saved = await f.admin(f.event(body)); assert.equal(saved.statusCode, 200);
  const publicResponse = await f.publicHandler({ httpMethod: "GET", headers: {} });
  assert.deepEqual(JSON.parse(publicResponse.body), JSON.parse(saved.body));
  assert.equal(publicResponse.headers["Access-Control-Allow-Origin"], "*"); assert.equal(publicResponse.headers["Set-Cookie"], undefined);
  const after = f.current();
  assert.equal(after.profile.academicStatus, ""); assert.equal(after.profile.availability, "");
  for (const section of ["jobs", "projects"]) assert.equal(Object.hasOwn(after[section][0], "featuredOrder"), false);
  assert.equal(Object.hasOwn(after.education[0], "programme"), false);
  for (const field of ["imageUrls", "imageTitles", "imageDescriptions", "imageBackupDescriptions",
    "links", "linksTitles", "linksDescriptions", "linksBackupDescriptions", "authors", "relatedRoleIds", "affiliations", "collaborators"]) {
    assert.deepEqual(after.projects[0][field], original.projects[0][field]);
  }
  await f.service.updatePortfolioData(after);
  assert.deepEqual(f.current(), after, "Omitted optional values stay cleared on a later save");
});

test("editorial writes retain existing auth/CSRF/CORS and reject invalid metadata without storing", async () => {
  const f = await fixture(); const body = f.current();
  const unauth = f.event(body); delete unauth.headers.cookie;
  const noCsrf = f.event(body); delete noCsrf.headers["x-csrf-token"];
  for (const [event, status] of [[unauth, 401], [noCsrf, 403], [f.event({ ...body, jobs: [{ featuredOrder: 0 }] }), 400]]) {
    const response = await f.admin(event); assert.equal(response.statusCode, status);
    assert.equal(response.headers["Access-Control-Allow-Origin"], "http://localhost:3000");
    assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
  }
  assert.equal(f.writes.length, 0);
});

test("legacy saves cannot erase featured positions through missing IDs or ambiguous programme identities", async () => {
  const f = await fixture(); const body = f.current();
  delete body.jobs[0].id; delete body.jobs[0].featuredOrder;
  await assert.rejects(f.service.updatePortfolioData(body), PortfolioPayloadCompatibilityError);
  assert.equal(f.writes.length, 0);
  const duplicate = f.current(); duplicate.education.push(structuredClone(duplicate.education[0]));
  await f.service.updatePortfolioData(duplicate);
  const legacy = f.current(); delete legacy.education[0].programme;
  await assert.rejects(f.service.updatePortfolioData(legacy), /Ambiguous education/);
});

test("omitted singleton objects and empty profile objects follow documented compatibility rules", async () => {
  const f = await fixture();
  const original = f.current();
  const legacy = f.current();
  delete legacy.profile;
  delete legacy.research;
  await f.service.updatePortfolioData(legacy);
  assert.deepEqual(f.current(), original);

  const body = f.current();
  body.profile = {};
  await f.service.updatePortfolioData(body);
  assert.equal(f.current().profile.name, "");
  assert.equal(f.current().profile.academicStatus, original.profile.academicStatus);
  assert.equal(f.current().profile.availability, original.profile.availability);
});

test("rank omission follows stable IDs through renamed and reordered records without mutating input", async () => {
  const f = await fixture();
  const body = f.current();
  body.jobs[0].title = "Renamed role";
  body.projects[0].name = "Renamed project";
  delete body.jobs[0].featuredOrder;
  delete body.projects[0].featuredOrder;
  body.jobs.unshift({ id: "new-role", title: "New unfeatured role", end: "Present" });
  body.projects.unshift({ id: "new-project", name: "New unfeatured project", dateOfCompletion: "2026", authors: [] });
  const before = structuredClone(body);
  const saved = await f.service.updatePortfolioData(body);
  assert.deepEqual(body, before);
  assert.equal(saved.jobs.find(row => row.id === "role-a").featuredOrder, 2);
  assert.equal(saved.projects.find(row => row.id === "project-a").featuredOrder, 1);
  assert.equal(Object.hasOwn(saved.jobs[0], "featuredOrder"), false);
  assert.equal(Object.hasOwn(saved.projects[0], "featuredOrder"), false);
  assert.equal(saved.projects[1].name, "Renamed project");
});

test("explicit ranks can be changed or cleared without restoring deleted records", async () => {
  const f = await fixture();
  const body = f.current();
  body.jobs[0].featuredOrder = 7;
  body.projects[0].featuredOrder = 7;
  await f.service.updatePortfolioData(body);
  assert.equal(f.current().jobs[0].featuredOrder, 7);
  assert.equal(f.current().projects[0].featuredOrder, 7);

  const deleted = f.current();
  deleted.projects = [];
  deleted.jobs[0].featuredOrder = null;
  deleted.education[0].programme = "";
  await f.service.updatePortfolioData(deleted);
  assert.deepEqual(f.current().projects, []);
  assert.equal(Object.hasOwn(f.current().jobs[0], "featuredOrder"), false);
});

test("education identity edits require an explicit programme rather than fuzzy matching", async () => {
  const f = await fixture();
  const body = f.current();
  body.education[0].institution = "Renamed university";
  delete body.education[0].programme;
  await f.service.updatePortfolioData(body);
  assert.equal(Object.hasOwn(f.current().education[0], "programme"), false);
  body.education[0].programme = " Explicit group ";
  await f.service.updatePortfolioData(body);
  assert.equal(f.current().education[0].programme, "Explicit group");
});

test("malformed stored editorial values are sanitized on read without writes or source mutation", async () => {
  const raw = { profile: { academicStatus: 2, availability: null },
    jobs: [{ title: "Role", featuredOrder: -1, duration: "obsolete" }],
    projects: [{ name: "Project", featuredOrder: "1" }], education: [{ programme: null }] };
  const original = structuredClone(raw);
  const service = new PortfolioService({ store: {
    getPortfolioData: async () => raw,
    setPortfolioData: async () => assert.fail("GET must never write")
  } });
  const data = await service.getPortfolioData();
  assert.equal(data.profile.academicStatus, "");
  assert.equal(data.profile.availability, "");
  for (const section of ["jobs", "projects"]) assert.equal(Object.hasOwn(data[section][0], "featuredOrder"), false);
  assert.equal(Object.hasOwn(data.education[0], "programme"), false);
  assert.equal(Object.hasOwn(data.jobs[0], "duration"), false);
  assert.deepEqual(raw, original);
  assert.deepEqual(await service.getPortfolioData(), data);
});

test("compatibility failures are readable 400 admin responses without writes", async () => {
  const f = await fixture();
  for (const section of ["jobs", "projects"]) {
    const body = f.current();
    delete body[section][0].id;
    delete body[section][0].featuredOrder;
    if (section === "jobs") body.projects[0].relatedRoleIds = [];
    const response = await f.admin(f.event(body));
    assert.equal(response.statusCode, 400);
    assert.equal(response.headers["Access-Control-Allow-Origin"], "http://localhost:3000");
    assert.equal(response.headers["Access-Control-Allow-Credentials"], "true");
    assert.match(JSON.parse(response.body).details[0], /stable IDs/);
  }
  assert.equal(f.writes.length, 0);
});
