import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PROFILE, DEFAULT_RESEARCH, PROFILE_FIELDS, RESEARCH_FIELDS,
  JOB_CATEGORIES, PROJECT_CATEGORIES, PROJECT_OUTPUT_TYPES, PROJECT_STATUSES,
  EDUCATION_STATUSES, THESIS_STATUSES, normalizeProfile, normalizeResearch
} from "../src/validation/academicMetadata.js";
import { normalizePortfolioData, validateCompletePortfolioPayload } from "../src/validation/portfolioData.js";
import { isSafePublicUrl } from "../src/validation/publicUrl.js";

function payload(overrides = {}) {
  return { ...normalizePortfolioData({ profile: {}, research: {} }), ...overrides };
}

test("absent legacy objects receive the approved early-stage defaults without contact or CV fallback", () => {
  const data = normalizePortfolioData({});
  assert.deepEqual(data.profile, DEFAULT_PROFILE);
  assert.deepEqual(data.research, DEFAULT_RESEARCH);
  assert.deepEqual(Object.keys(data.profile), PROFILE_FIELDS);
  assert.deepEqual(Object.keys(data.research), RESEARCH_FIELDS);
  assert.equal(data.profile.name, "Gustavo Pedro Ricou");
  assert.equal(data.profile.email, "");
  assert.equal(data.profile.cvUrl, "");
  assert.equal(data.profile.portraitUrl, "");
  assert.equal(data.research.thesisInstitution, "");
  assert.equal(data.research.thesisSupervisor, "");
  assert.equal(data.research.thesisStart, "");
  assert.equal(data.research.thesisEnd, "");
  assert.equal(data.research.thesisStatus, "in-progress");
  assert.match(data.research.thesisSummary, /aim is to understand/);
  data.profile.researchInterests.push("Local edit");
  data.research.thesisQuestions.length = 0;
  assert.deepEqual(normalizePortfolioData({}).profile.researchInterests, DEFAULT_PROFILE.researchInterests);
  assert.deepEqual(normalizePortfolioData({}).research.thesisQuestions, DEFAULT_RESEARCH.thesisQuestions);
});

test("provided empty or partial metadata objects never rehydrate default text", () => {
  for (const profile of [{}, { name: "", headline: "", summary: "", email: "", cvUrl: "", researchInterests: [] }]) {
    const data = normalizePortfolioData({ profile, research: {} });
    assert.equal(data.profile.name, "");
    assert.equal(data.profile.headline, "");
    assert.equal(data.profile.summary, "");
    assert.deepEqual(data.profile.researchInterests, []);
    assert.equal(data.research.title, "");
    assert.equal(data.research.thesisStatus, "");
    assert.deepEqual(data.research.thesisQuestions, []);
    assert.deepEqual(normalizePortfolioData(data), data);
  }
});

test("new metadata round-trips and drops unsupported fields", () => {
  const data = normalizePortfolioData(payload({
    profile: { name: "Example Researcher", email: "public@example.org", cvUrl: "/assets/cv.pdf", researchInterests: ["Statistics", 4], secret: "discard" },
    research: { title: "Research", thesisSummary: "Prediction is an aim.", thesisMethods: ["Baselines"], thesisInstitution: "Explicit institution", secret: "discard" }
  }));
  assert.equal(data.profile.email, "public@example.org");
  assert.equal(data.profile.cvUrl, "/assets/cv.pdf");
  assert.deepEqual(data.profile.researchInterests, ["Statistics"]);
  assert.equal(data.research.thesisInstitution, "Explicit institution");
  assert.equal(Object.hasOwn(data.profile, "secret"), false);
  assert.equal(Object.hasOwn(data.research, "secret"), false);
  assert.equal(validateCompletePortfolioPayload(data).valid, true);
});

test("thesis supervisor is optional explicit public text, never inferred, and validates supplied types", () => {
  for (const thesisSupervisor of ["", "Van-Dinh Nguyen"]) {
    const body = payload({ research: { thesisSupervisor } });
    assert.equal(validateCompletePortfolioPayload(body).valid, true);
    assert.equal(normalizePortfolioData(body).research.thesisSupervisor, thesisSupervisor);
  }
  assert.equal(normalizeResearch({ thesisInstitution: "Trinity College Dublin" }).thesisSupervisor, "");
  for (const thesisSupervisor of [null, 4, [], {}]) {
    assert.equal(validateCompletePortfolioPayload(payload({ research: { thesisSupervisor } })).valid, false);
    assert.equal(normalizeResearch({ thesisSupervisor }).thesisSupervisor, "");
  }
});

test("legacy categories are conservative and research reports require exact approved names", () => {
  const reportNames = [
    "Report on Reflectometry",
    "Disruption Studies on the COMPASS Tokamak",
    "Automatic Data Control and Acquisition for the Study of Electrical Susceptibility and Thermally Stimulated Currents in Ceramics and Polarizable Films"
  ];
  const data = normalizePortfolioData({
    jobs: [
      { title: "Research Intern" }, { title: "Tutor" }, { title: "Teaching Assistant" },
      { title: "Researcher" }, { title: "Industry Research", category: "industry" }
    ],
    projects: [...reportNames.map((name) => ({ name })),
      { name: "Physics coursework with experiments" },
      { name: "Report on Reflectometry revised" },
      { name: "Streaming latency manuscript", outputType: "manuscript", status: "in-preparation" },
      { name: "Report on Reflectometry", category: "coursework", outputType: "other", status: "in-progress" }
    ],
    education: [{ degree: "Engineering Physics", grade: "", end: "2015" }]
  });
  assert.deepEqual(data.jobs.map((job) => job.category), ["research", "teaching", "teaching", "industry", "industry"]);
  assert.deepEqual(data.projects.slice(0, 3).map(({ category, outputType, status }) => ({ category, outputType, status })),
    reportNames.map(() => ({ category: "research", outputType: "report", status: "completed" })));
  assert.equal(data.projects[3].category, "other");
  assert.equal(data.projects[3].status, "");
  assert.equal(data.projects[3].outputType, "");
  assert.equal(data.projects[4].category, "other");
  assert.equal(data.projects[5].status, "in-preparation");
  assert.equal(data.projects[6].category, "coursework");
  assert.equal(data.projects[6].status, "in-progress");
  assert.equal(data.education[0].status, "");
  assert.equal(data.education[0].grade, "");
});

test("legacy IDs are deterministic, unique and retained through rename and reorder", () => {
  const legacy = { jobs: [{ title: "Research Intern", company: "A" }, { title: "Research Intern", company: "B" }], projects: [{ name: "Report on Reflectometry" }] };
  const migrated = normalizePortfolioData(legacy);
  assert.deepEqual(normalizePortfolioData(legacy), migrated);
  assert.notEqual(migrated.jobs[0].id, migrated.jobs[1].id);
  assert.match(migrated.jobs[0].id, /^job-[a-f\d]{24}$/);
  assert.match(migrated.projects[0].id, /^project-[a-f\d]{24}$/);
  const originalJob = migrated.jobs[0].id;
  const originalProject = migrated.projects[0].id;
  migrated.jobs[0].title = "Renamed role";
  migrated.jobs.reverse();
  migrated.projects[0].name = "Renamed output";
  const renamed = normalizePortfolioData(migrated);
  assert.equal(renamed.jobs[1].id, originalJob);
  assert.equal(renamed.jobs[1].category, "research");
  assert.equal(renamed.projects[0].id, originalProject);
  assert.equal(renamed.projects[0].category, "research");
  const duplicates = normalizePortfolioData({ jobs: [{ title: "Tutor" }, { title: "Tutor" }] });
  assert.equal(new Set(duplicates.jobs.map((job) => job.id)).size, 2);
  assert.deepEqual(normalizePortfolioData(duplicates), duplicates);
});

test("all supported category/status/output enums persist and invalid writes are rejected", () => {
  for (const category of JOB_CATEGORIES) {
    assert.equal(validateCompletePortfolioPayload(payload({ jobs: [{ category }] })).valid, true);
    assert.equal(normalizePortfolioData({ jobs: [{ category }] }).jobs[0].category, category);
  }
  for (const category of PROJECT_CATEGORIES) {
    assert.equal(validateCompletePortfolioPayload(payload({ projects: [{ category }] })).valid, true);
  }
  for (const outputType of PROJECT_OUTPUT_TYPES) {
    assert.equal(normalizePortfolioData({ projects: [{ outputType }] }).projects[0].outputType, outputType);
  }
  for (const status of PROJECT_STATUSES) {
    assert.equal(validateCompletePortfolioPayload(payload({ projects: [{ status }] })).valid, true);
  }
  for (const status of EDUCATION_STATUSES) {
    assert.equal(normalizePortfolioData({ education: [{ status }] }).education[0].status, status);
  }
  const invalid = validateCompletePortfolioPayload(payload({
    jobs: [{ category: "original-discovery" }],
    projects: [{ category: "unknown", status: "v1.0.0", outputType: "artifact-version" }],
    education: [{ status: "awarded" }]
  }));
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length, 5);
});

test("generated legacy IDs cannot displace an existing persisted ID", () => {
  const legacy = { title: "Tutor" };
  const existingId = normalizePortfolioData({ jobs: [legacy] }).jobs[0].id;
  const data = normalizePortfolioData({ jobs: [legacy, { ...legacy, id: existingId, company: "Existing role" }] });
  assert.equal(data.jobs[1].id, existingId);
  assert.notEqual(data.jobs[0].id, existingId);
  assert.deepEqual(normalizePortfolioData(data), data);
});

test("project editorial metadata stays unspecified unless supplied or migrated from an approved report", () => {
  const data = normalizePortfolioData({ projects: [
    { name: "Historical software", category: "software" },
    { name: "Historical software", category: "software", outputType: "", status: "" },
    { name: "Report on Reflectometry", outputType: "", status: "" },
    { name: "Report on Reflectometry" },
    { name: "Unknown metadata", outputType: "unknown", status: "unknown" }
  ] });
  for (const index of [0, 1, 2, 4]) {
    assert.equal(data.projects[index].outputType, "");
    assert.equal(data.projects[index].status, "");
  }
  assert.equal(data.projects[3].outputType, "report");
  assert.equal(data.projects[3].status, "completed");
  assert.equal(validateCompletePortfolioPayload(data).valid, true);
  assert.deepEqual(normalizePortfolioData(data), data);
  assert.equal(validateCompletePortfolioPayload(payload({ jobs: [{ category: "" }] })).valid, false);
  assert.equal(validateCompletePortfolioPayload(payload({ projects: [{ category: "" }] })).valid, false);
});

test("thesis status uses the shared optional enum and rejects unsupported saves", () => {
  assert.deepEqual(THESIS_STATUSES, ["", "in-progress", "in-preparation", "completed"]);
  for (const thesisStatus of THESIS_STATUSES) {
    const body = payload({ research: { thesisStatus } });
    assert.equal(validateCompletePortfolioPayload(body).valid, true);
    assert.equal(normalizePortfolioData(body).research.thesisStatus, thesisStatus);
  }
  assert.equal(normalizeResearch({ thesisStatus: "published" }).thesisStatus, "");
  const invalid = validateCompletePortfolioPayload(payload({ research: { thesisStatus: "published" } }));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("research.thesisStatus")));
});

test("explicit null profile/research normalizes to empty singleton fields without legacy defaults", () => {
  const profile = normalizeProfile(null);
  const research = normalizeResearch(null);
  assert.deepEqual(profile, normalizeProfile({}));
  assert.deepEqual(research, normalizeResearch({}));
  assert.ok(Object.values(profile).every((value) => value === "" || (Array.isArray(value) && value.length === 0)));
  assert.ok(Object.values(research).every((value) => value === "" || (Array.isArray(value) && value.length === 0)));
  assert.deepEqual(normalizeProfile(undefined), DEFAULT_PROFILE);
  assert.deepEqual(normalizeResearch(undefined), DEFAULT_RESEARCH);
  const data = normalizePortfolioData({ profile: null, research: null });
  assert.deepEqual(data.profile, profile);
  assert.deepEqual(data.research, research);
  assert.deepEqual(normalizePortfolioData(data), data);
});

test("portrait URLs require explicit safe content and never fall back to page photos", () => {
  const legacy = { pages: { home: { title: "Home", imageUrl: "https://example.org/legacy-photo.jpg" } } };
  const data = normalizePortfolioData(legacy);
  assert.equal(data.pages.home.imageUrl, "https://example.org/legacy-photo.jpg");
  assert.equal(data.profile.portraitUrl, "");
  for (const portraitUrl of ["", "https://example.org/portrait.jpg", "/assets/portrait.jpg"]) {
    const body = payload({ profile: { portraitUrl } });
    assert.equal(validateCompletePortfolioPayload(body).valid, true);
    assert.equal(normalizePortfolioData(body).profile.portraitUrl, portraitUrl);
  }
  const invalid = payload({ profile: { portraitUrl: "data:image/svg+xml,invalid" } });
  assert.equal(validateCompletePortfolioPayload(invalid).valid, false);
  assert.equal(normalizePortfolioData(invalid).profile.portraitUrl, "");
});

test("role relationships and contributor/media metadata survive normalization and rename", () => {
  const data = normalizePortfolioData(payload({
    jobs: [{ id: "role-a", title: "Research Intern", category: "research" }],
    projects: [{
      id: "output-a", category: "research", outputType: "manuscript", status: "in-preparation",
      name: "Working title", contribution: "Analysis and implementation", relatedRoleIds: ["role-a"],
      collaborators: ["Example Contributor"], affiliations: ["Example Institution"],
      imageUrls: ["/a.png", "javascript:alert(1)", "/b.png"],
      imageDescriptions: ["A", "Dropped", "B"], imageBackupDescriptions: ["Alt A", "Dropped", "Alt B"],
      links: ["https://example.org/a.pdf", "data:text/html,invalid", "./b.pdf"],
      linksTitles: ["A report", "Dropped", "B report"], linksBackupDescriptions: ["Backup A", "Dropped", "Backup B"]
    }]
  }));
  const project = data.projects[0];
  assert.deepEqual(project.imageUrls, ["/a.png", "/b.png"]);
  assert.deepEqual(project.imageDescriptions, ["A", "B"]);
  assert.deepEqual(project.imageBackupDescriptions, ["Alt A", "Alt B"]);
  assert.deepEqual(project.linksDescriptions, ["A report", "B report"]);
  assert.deepEqual(project.linksBackupDescriptions, ["Backup A", "Backup B"]);
  assert.deepEqual(project.collaborators, ["Example Contributor"]);
  assert.deepEqual(project.affiliations, ["Example Institution"]);
  assert.equal(project.contribution, "Analysis and implementation");
  project.name = "Renamed title";
  data.jobs[0].title = "Renamed role";
  assert.deepEqual(normalizePortfolioData(data).projects[0].relatedRoleIds, ["role-a"]);
  assert.equal(validateCompletePortfolioPayload(data).valid, true);
  project.relatedRoleIds = ["nonexistent"];
  assert.equal(validateCompletePortfolioPayload(data).valid, false);
});

test("HTTP(S) and relative public URLs are allowed while executable schemes are rejected", () => {
  for (const url of ["", "https://example.org/cv.pdf", "http://example.org/report", "/assets/cv.pdf", "./cv.pdf", "assets/report.pdf"]) {
    assert.equal(isSafePublicUrl(url), true, url);
    assert.equal(validateCompletePortfolioPayload(payload({ profile: { cvUrl: url } })).valid, true, url);
  }
  for (const url of ["javascript:alert(1)", "data:image/svg+xml,x", "vbscript:alert(1)", "//example.org/file", "\\\\example.org/file", "java\nscript:alert(1)", "https://user:password@example.org/file", "https://example.org/file\n"]) {
    assert.equal(isSafePublicUrl(url), false, url);
    const body = payload({ profile: { cvUrl: url }, projects: [{ links: [url] }] });
    body.pages.home.imageUrl = url;
    assert.equal(validateCompletePortfolioPayload(body).valid, false, url);
    const normalized = normalizePortfolioData(body);
    assert.equal(normalized.profile.cvUrl, "");
    assert.equal(normalized.pages.home.imageUrl, "");
    assert.deepEqual(normalized.projects[0].links, []);
  }
});

test("invalid object types, ID collisions and malformed relationship arrays fail validation", () => {
  for (const body of [
    payload({ profile: null }), payload({ research: [] }),
    payload({ profile: { email: "not-an-address" } }),
    payload({ profile: { researchInterests: [2] } }),
    payload({ research: { thesisTitle: 2 } }),
    payload({ jobs: [{ id: "same" }, { id: "same" }] }),
    payload({ projects: [{ id: 2 }] }),
    payload({ projects: [{ relatedRoleIds: "role-a" }] }),
    payload({ projects: [{ relatedRoleIds: [null] }] })
  ]) {
    assert.equal(validateCompletePortfolioPayload(body).valid, false);
  }
});
