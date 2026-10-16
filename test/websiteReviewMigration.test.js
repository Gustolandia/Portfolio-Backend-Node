import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createWebsiteReviewPlan, WEBSITE_FEATURED_JOBS, WEBSITE_FEATURED_PROJECTS, WEBSITE_PROJECT_COPY, WEBSITE_ROLE_LINKS } from "../src/content/websiteReviewContent.js";
import { migrateWebsiteReviewRedis, planWebsiteReviewMigration, WEBSITE_REVIEW_MIGRATION_ID } from "../src/content/websiteReviewMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runWebsiteReview } from "../scripts/migrate-website-review.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const skillSet = data => [...new Set(["jobs", "education", "projects"].flatMap(key => data[key].flatMap(row => row.skills)))].sort();

function contentFixture() {
  const jobIds = [...new Set([...Object.keys(WEBSITE_FEATURED_JOBS), ...Object.values(WEBSITE_ROLE_LINKS)])];
  const institutions = ["Trinity College Dublin", "Technological University of the Shannon", "Atlantic Technological University", "EPICODE", "Universite de Lorraine", "Universität Stuttgart", "Universidade do Porto"];
  const linkCounts = { "project-1930afed6e1b31fc8e95b24e": 3, "project-e5a9d2ac9375ff84851016ad": 3, "project-38981053924e2c7d93a437c8": 2, "research-zenodo-22044877": 3, "research-arxiv-2608-27736": 2, "research-eartharxiv-15189": 3 };
  return normalizePortfolioData({
    profile: { name: "Fixture public name", email: "public@example.org", portraitUrl: "/portrait.jpg" },
    research: { thesisTitle: "Thesis aim", thesisStatus: "in-progress", thesisSupervisor: "Confirmed supervisor", thesisStart: "2026-09-25", thesisEnd: "2027-04-19", thesisQuestions: ["Can transfer be predicted?"] },
    jobs: jobIds.map(id => ({ id, title: "Fixture role", company: "Fixture company", category: "research", duties: ["Original duty"], skills: ["Python", "Java", "Unique job skill"], imageUrls: ["/job.gif"], imageTitles: ["Existing credited caption"], mapLocation: "Original location" })),
    education: institutions.map((institution, index) => ({ degree: "Fixture degree", institution, start: `201${index}`, end: institution === "Trinity College Dublin" ? "2027-10-01" : `202${index}`, grade: "Original grade", status: institution === "Trinity College Dublin" ? "in-progress" : "not-completed", courses: ["Module A", "Module A", "Module B"], activities: ["Basketball", "Basketball", "One Fusion-EP programme: original factual context"], skills: ["Python", "Statistics", "Java", `Unique ${institution} skill`] })),
    projects: Object.keys(WEBSITE_PROJECT_COPY).map(id => ({ id, name: `Fixture title ${id}`, category: id.startsWith("research-") ? "research" : "other", status: id === "research-zenodo-22044877" ? "in-preparation" : id.startsWith("research-") ? "preprint" : "", outputType: id === "research-zenodo-22044877" ? "manuscript" : "", dateOfCompletion: "", authors: ["First author", "Second author"], collaborators: ["Contributor"], affiliations: ["Institution"], description: "Original copy", contribution: "Original contribution", skills: ["Python", "Java", "Microservices", "Unique project skill"], imageUrls: ["/preview.gif", "/preview.jpg"], imageTitles: ["", "Full original attribution and licence"], links: Array.from({ length: linkCounts[id] || 1 }, (_, i) => `/legacy-${i}.pdf`), linksTitles: Array.from({ length: linkCounts[id] || 1 }, (_, i) => `Original label ${i}`) }))
  });
}

test("reviewed website proposal applies confirmed facts and selections without changing research evidence or media", () => {
  const current = contentFixture();
  current.futureTopLevel = { preserve: true };
  current.projects[0].futureMetadata = "preserve";
  const original = structuredClone(current);
  const plan = createWebsiteReviewPlan(current);
  const result = planWebsiteReviewMigration(current, plan);
  const after = normalizePortfolioData(result.data);
  assert.deepEqual(current, original);
  assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  assert.equal(result.data.futureTopLevel.preserve, true);
  assert.equal(result.data.projects[0].futureMetadata, "preserve");
  assert.match(after.profile.availability, /July 2027/);
  assert.match(after.profile.academicStatus, /Trinity College Dublin/);
  assert.equal(after.profile.email, current.profile.email);
  assert.deepEqual(after.research.thesisQuestions, current.research.thesisQuestions);
  assert.equal(after.research.thesisEnd, "2027-04-19");
  assert.equal(after.research.thesisStatus, "in-progress");
  for (const section of ["jobs", "education", "projects"]) {
    assert.equal(after[section].length, current[section].length);
    result.data[section].forEach((row, i) => {
      for (const field of ["id", "imageUrls", "imageTitles", "links", "authors", "status", "outputType", "dateOfCompletion", "collaborators", "affiliations", "mapLocation", "courses"]) {
        let expected = current[section][i][field];
        if (row.id === "research-zenodo-22044877" && field === "links") expected = [2, 1, 0].map(index => current[section][i].links[index]);
        if (row.id === "project-e5a9d2ac9375ff84851016ad" && field === "imageTitles") expected = expected.map((text, index) => index === 0 ? "CarSurfing landing page" : text);
        assert.deepEqual(row[field], expected);
      }
      for (const field of ["imageDescriptions", "imageBackupDescriptions"]) {
        assert.equal(row[field].length, row.imageUrls.length);
        assert.ok(row[field].every(text => text.length > 0));
      }
    });
  }
  assert.deepEqual(skillSet(after), skillSet(current), "No distinct expertise is deleted");
  for (const [id, order] of Object.entries(WEBSITE_FEATURED_PROJECTS)) assert.equal(after.projects.find(row => row.id === id).featuredOrder, order);
  for (const [id, order] of Object.entries(WEBSITE_FEATURED_JOBS)) assert.equal(after.jobs.find(row => row.id === id).featuredOrder, order);
  for (const [id, role] of Object.entries(WEBSITE_ROLE_LINKS)) assert.ok(after.projects.find(row => row.id === id).relatedRoleIds.includes(role));
  const tcd = after.education.find(row => row.institution === "Trinity College Dublin");
  assert.equal(tcd.end, "Present");
  assert.match(tcd.grade, /provisional/);
  assert.match(tcd.activities.at(-1), /May or June 2027/);
  for (const institution of ["Universite de Lorraine", "Universität Stuttgart"]) {
    const row = after.education.find(row => row.institution === institution);
    assert.equal(row.programme, "Fusion-EP");
    assert.match(row.activities[0], /^One Fusion-EP/);
    assert.equal(row.activities.filter(text => text === "Basketball").length, 2);
  }
  assert.equal(after.projects.filter(row => row.category === "software").length, 5);
  assert.equal(after.projects.find(row => row.name === "CarSurfing").contribution, "Developed most of the Spring Boot backend for CarSurfing, a microservices-based carpooling service.");
  for (const field of ["imageTitles", "imageDescriptions", "imageBackupDescriptions"]) {
    assert.equal(after.projects.find(row => row.name === "CarSurfing")[field][0], "CarSurfing landing page");
  }
  assert.equal(after.projects.find(row => row.name === "Filebox").contribution, "Original contribution");
  assert.equal(JSON.stringify(result.report).includes(current.profile.email), false);
});

function fixture() {
  const current = normalizePortfolioData({ profile: { availability: "" }, research: {},
    jobs: [{ id: "role-1", title: "Research intern", skills: ["Python"], duties: ["Original duty"] }],
    education: [{ degree: "Coursework", institution: "University", start: "2013", end: "2014", activities: ["Sport", "Sport"], skills: ["Python", "Statistics"], courses: ["Module"] }],
    projects: [{ id: "project-1", name: "Old title", status: "in-preparation", category: "research", authors: ["Author A", "Author B"], imageUrls: ["/a.gif", "/b.jpg"], imageTitles: ["Credit A", "Credit B"], links: ["/old.pdf"], linksTitles: ["Old archive"], relatedRoleIds: ["role-1"], skills: ["Python"] }]
  });
  const make = (collection, row, values, identity = {}) => ({ collection, ...identity,
    expected: Object.fromEntries(Object.keys(values).map(field => [field, row[field] ?? null])), values, evidence: ["Explicit owner confirmation"] });
  const match = Object.fromEntries(["degree", "institution", "start", "end"].map(field => [field, current.education[0][field]]));
  const plan = { version: 1, migrationId: WEBSITE_REVIEW_MIGRATION_ID, patches: [
    make("profile", current.profile, { availability: "Approved availability" }),
    make("pages", current.pages.education, { description: "Approved introduction" }, { page: "education" }),
    make("jobs", current.jobs[0], { featuredOrder: 1 }, { id: "role-1" }),
    make("education", current.education[0], { programme: "Fusion-EP", activities: ["Programme context", "Sport", "Sport"], skills: ["Python"] }, { match }),
    make("projects", current.projects[0], { name: "New title", featuredOrder: 2, imageBackupDescriptions: ["Alt A", "Alt B"], linksTitles: ["Restricted archive"] }, { id: "project-1" })
  ] };
  return { current, plan };
}

test("website planner rejects stale, ambiguous, duplicate and out-of-scope operations without mutation", () => {
  for (const change of [
    f => { f.plan.patches[0].expected.availability = "stale"; },
    f => { f.plan.patches.push(f.plan.patches[0]); },
    f => { f.plan.patches[0].evidence = []; },
    f => { f.plan.patches[1].page = "unknown"; },
    f => { f.plan.patches[2].id = "missing"; },
    f => { f.plan.patches[3].match = { institution: "University" }; },
    f => { f.current.education.push(structuredClone(f.current.education[0])); },
    f => { f.plan.patches[4].values.authors = ["Invented author"]; f.plan.patches[4].expected.authors = f.current.projects[0].authors; },
    f => { f.plan.patches[4].values.links = ["/replacement.pdf"]; f.plan.patches[4].expected.links = f.current.projects[0].links; },
    f => { f.plan.patches[4].values.status = "published"; f.plan.patches[4].expected.status = "in-preparation"; },
    f => { f.plan.patches[4].values.imageTitles = ["Lost attribution"]; f.plan.patches[4].expected.imageTitles = f.current.projects[0].imageTitles; }
  ]) {
    const f = fixture(); change(f);
    const original = structuredClone(f.current);
    assert.throws(() => planWebsiteReviewMigration(f.current, f.plan));
    assert.deepEqual(f.current, original);
  }
});

test("website arrays reject dropped activities, new skill claims, misaligned text and lost relationships", () => {
  for (const change of [
    f => { f.plan.patches[3].values.activities = ["Sport"]; },
    f => { f.plan.patches[3].values.skills = ["Invented expertise"]; },
    f => { f.plan.patches[4].values.imageBackupDescriptions.pop(); },
    f => { f.plan.patches[4].values.linksTitles.push("Extra label"); },
    f => { f.plan.patches[4].values.relatedRoleIds = []; f.plan.patches[4].expected.relatedRoleIds = ["role-1"]; },
    f => { f.plan.patches[4].values.relatedRoleIds = ["role-1", "missing-role"]; f.plan.patches[4].expected.relatedRoleIds = ["role-1"]; },
    f => { f.plan.patches[2].values.featuredOrder = 0; },
    f => { f.plan.patches[4].values.category = "invented"; f.plan.patches[4].expected.category = "research"; }
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => planWebsiteReviewMigration(f.current, f.plan));
  }
});

test("website legacy rename pins the original deterministic identity and never rewrites other IDs", () => {
  const f = fixture(); delete f.current.projects[0].id;
  const oldId = normalizePortfolioData(f.current).projects[0].id;
  f.plan.patches[4].id = oldId;
  const result = planWebsiteReviewMigration(f.current, f.plan);
  assert.equal(result.data.projects[0].id, oldId);
  assert.equal(normalizePortfolioData(result.data).projects[0].id, oldId);
  assert.equal(Object.hasOwn(f.current.projects[0], "id"), false);
  assert.equal(result.data.jobs[0].id, "role-1");
});

test("only latency links permit the approved complete tuple permutation with reviewed paired labels", () => {
  const current = contentFixture();
  const plan = createWebsiteReviewPlan(current);
  const patch = plan.patches.find(row => row.id === "research-zenodo-22044877");
  const after = planWebsiteReviewMigration(current, plan).data.projects.find(row => row.id === patch.id);
  const before = current.projects.find(row => row.id === patch.id);
  assert.deepEqual(after.links, [before.links[2], before.links[1], before.links[0]]);
  for (const field of ["linksTitles", "linksDescriptions", "linksBackupDescriptions"]) {
    assert.deepEqual(after[field], ["Current manuscript", "Code and analysis", "Older restricted archive"]);
  }
  for (const change of [
    p => { delete p.linkOrder; }, p => { p.linkOrder = [1, 2, 0]; },
    p => { p.values.links.reverse(); },
    p => { delete p.values.linksBackupDescriptions; delete p.expected.linksBackupDescriptions; },
    p => { p.values.links[0] = "/replacement.pdf"; }
  ]) {
    const bad = structuredClone(plan);
    change(bad.patches.find(row => row.id === patch.id));
    assert.throws(() => planWebsiteReviewMigration(current, bad), /tuple permutation/);
  }
});

function redisFixture() {
  const f = fixture();
  const key = "portfolio:test";
  const values = new Map([[key, JSON.stringify(f.current, null, 2)], [key + ":migrations:previous", "preserve"]]);
  const backups = [];
  let writes = 0;
  const redis = { get: async key => values.get(key) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2;
    if (values.get(keys[0]) !== args[0]) return 0;
    writes++; values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); return 1;
  } };
  const options = { redis, key, plan: f.plan, dryRun: false, expectedHash: sha(values.get(key)),
    expectedCandidateHash: planWebsiteReviewMigration(f.current, f.plan).candidateHash, verifyDeployment: async () => {},
    backupDirectory: "private-content/test-website-review", backupWriter: async (path, raw) => backups.push(raw) };
  return { ...f, options, values, key, backups, writes: () => writes };
}

test("website Redis preview is read-only; apply atomically backs up exact raw bytes with a separate ledger", async () => {
  const f = redisFixture(); const original = f.values.get(f.key);
  assert.equal((await migrateWebsiteReviewRedis({ ...f.options, dryRun: undefined })).applied, false);
  assert.equal(f.writes(), 0); assert.deepEqual(f.backups, []);
  const result = await migrateWebsiteReviewRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.writes(), 1);
  assert.equal(f.values.get(result.backupKey), original); assert.deepEqual(f.backups, [original]);
  assert.equal(result.ledgerKey, `${f.key}:migrations:${WEBSITE_REVIEW_MIGRATION_ID}`);
  assert.equal(f.values.get(f.key + ":migrations:previous"), "preserve");
  const later = JSON.parse(f.values.get(f.key)); later.projects = []; later.profile.availability = "";
  f.values.set(f.key, JSON.stringify(later));
  const repeat = await migrateWebsiteReviewRedis(f.options);
  assert.equal(repeat.applied, false); assert.deepEqual(repeat.data, later); assert.equal(f.writes(), 1);
});

test("website guards block stale hashes, nonexact backups, failed deployment and concurrent edits", async () => {
  const f = redisFixture();
  for (const overrides of [
    { expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupFile: "private-content/source.json", backupReader: async () => JSON.stringify(f.current) },
    { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } }
  ]) await assert.rejects(migrateWebsiteReviewRedis({ ...f.options, ...overrides }));
  await assert.rejects(migrateWebsiteReviewRedis({ ...f.options, verifyDeployment: async () => {
    f.values.set(f.key, JSON.stringify({ ...f.current, concurrent: true }));
  } }), /admin changed/);
  assert.equal(f.writes(), 0);
});

test("website CLI rejects ambiguous modes, duplicate flags and unsafe input/apply before access", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateWebsiteReviewRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--apply", "--plan", "not-read.json"], ["--plan", "not-read.json", "--apply", "--input", "not-read.json"], ["--dry-run", "--dry-run"]]) {
    await assert.rejects(runWebsiteReview(args), /option|Supply/);
  }
});

test("offline website CLI preview emits paths/hashes but no private payload or credentials", async t => {
  const dir = await mkdtemp(join(tmpdir(), "portfolio-website-preview-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(basename(dir).startsWith("portfolio-website-preview-"));
    await rm(dir, { recursive: true, force: true });
  });
  const f = fixture(); f.current.privateNote = "PRIVATE_FIXTURE_VALUE";
  const input = join(dir, "source.json"); const plan = join(dir, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-website-review.js", "--input", input, "--plan", plan, "--dry-run"], { encoding: "utf8", cwd: fileURLToPath(new URL("../", import.meta.url)) });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).applied, false);
  assert.match(JSON.parse(result.stdout).candidateHash, /^[a-f0-9]{64}$/);
  assert.equal(result.stdout.includes("PRIVATE_FIXTURE_VALUE"), false);
});
