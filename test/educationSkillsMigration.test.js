import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { EDUCATION_SKILLS_MIGRATION_ID, migrateEducationSkillsRedis, planEducationSkillsMigration } from "../src/content/educationSkillsMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runEducationSkills } from "../scripts/migrate-education-skills.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const mask = value => {
  const copy = structuredClone(value);
  copy.education.forEach(row => delete row.skills);
  return copy;
};

/** Builds isolated source evidence and a two-record education-only reduction. */
function fixture() {
  const current = normalizePortfolioData({
    profile: { name: "Example", location: "", availability: "Retain availability" },
    research: { thesisTitle: "Retain thesis", thesisMethods: ["Retain method"] },
    jobs: [{ id: "role-one", title: "Existing role", company: "Example", skills: ["AWS", "Java", "Statistics"] }],
    projects: [{ id: "project-one", name: "Existing work", authors: ["Author One", "Author Two"],
      category: "research", status: "in-preparation", collections: ["Explicit collection"],
      relatedRoleIds: ["role-one"], skills: ["Python", "R"], links: ["/existing.pdf"],
      linksDescriptions: ["Original report"], linksBackupDescriptions: ["Original backup"] }],
    education: [
      { degree: "Example computing degree", institution: "Example computing institution", start: "2020", end: "2022",
        grade: "Retain grade", programme: "Retain programme", location: "Retain location", mapLocation: "Retain map",
        skills: ["Java", "AWS", "MySQL", "Docker", "Kubernetes", "CI/CD", "Software Architecture", "Software Testing", "Git", "Python"],
        courses: ["Cloud systems (AWS)", "Database Technology (SQL)", "Operating Systems"],
        activities: ["Retain activity"], imageUrls: ["/original.gif", "/original.png"],
        imageTitles: ["Original credit", "Other credit"], imageDescriptions: ["Original description", "Other description"],
        imageBackupDescriptions: ["Original backup", "Other backup"] },
      { degree: "Example statistics degree", institution: "Example statistics institution", start: "2018", end: "2019",
        skills: ["Statistics", "R", "Data Analysis", "Scientific Computing", "Scientific Research", "Scientific Writing", "Probability Theory", "Linear Algebra"],
        courses: ["Existing coursework"] }
    ]
  });
  current.education[0].privateLegacyMetadata = { preserve: ["Original", "order"] };
  current.privatePayload = "PRIVATE_PAYLOAD_SENTINEL";
  const plan = { version: 1, migrationId: EDUCATION_SKILLS_MIGRATION_ID, patches: current.education.map((row, index) => ({
    match: Object.fromEntries(["degree", "institution", "start", "end"].map(field => [field, row[field]])),
    expectedSkills: [...row.skills],
    skills: index === 0 ? ["Software Architecture", "Cloud Computing", "Database Management", "Software Testing", "Java"]
      : ["Statistics", "Data Analysis", "Scientific Computing", "R"],
    evidence: index === 0 ? [
      { skill: "Cloud Computing", sourceSkills: ["AWS"], sourceCourses: ["Cloud systems (AWS)"] },
      { skill: "Database Management", sourceSkills: ["MySQL"], sourceCourses: ["Database Technology (SQL)"] }
    ] : []
  })) };
  return { current, plan };
}

/** Simulates the shared atomic Lua CAS without network or live Redis access. */
function redisFixture() {
  const { current, plan } = fixture();
  const raw = JSON.stringify(current, null, 2);
  const key = "portfolio:education-test";
  const values = new Map([[key, raw], [key + ":migrations:previous", "retain previous ledger"]]);
  const backups = new Map();
  let writes = 0;
  const redis = {
    get: async target => values.get(target) ?? null,
    eval: async (script, keys, args) => {
      assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
      if (values.has(keys[1])) return 2;
      if (values.get(keys[0]) !== args[0]) return 0;
      values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]);
      writes += 1;
      return 1;
    }
  };
  const options = { redis, key, plan, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planEducationSkillsMigration(current, plan).candidateHash,
    backupDirectory: "private-content/education-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { current, plan, raw, key, values, backups, redis, options, writes: () => writes };
}

test("education-only preview reduces tags and preserves all other raw/public content and input", () => {
  const { current, plan } = fixture();
  const original = structuredClone(current);
  const result = planEducationSkillsMigration(current, plan);
  assert.deepEqual(current, original);
  assert.deepEqual(mask(result.data), mask(current));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(current)));
  assert.deepEqual(result.data.jobs, current.jobs);
  assert.deepEqual(result.data.projects, current.projects);
  assert.equal(result.data.profile.location, "");
  assert.deepEqual(result.data.education.map(row => row.skills), plan.patches.map(patch => patch.skills));
  assert.equal(result.report.beforeOccurrences, 18);
  assert.equal(result.report.afterOccurrences, 9);
  assert.equal(result.report.changes.length, 2);
  assert.equal(result.report.changed, true);
  assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
});

test("education reduction preserves raw record and same-index media order when periods are unsorted", () => {
  const { current, plan } = fixture();
  current.education.reverse();
  const result = planEducationSkillsMigration(current, plan);
  assert.deepEqual(result.data.education.map(row => row.institution), current.education.map(row => row.institution));
  assert.deepEqual(mask(result.data), mask(current));
  assert.deepEqual(result.data.education[1].imageUrls, ["/original.gif", "/original.png"]);
  assert.deepEqual(result.data.education[1].imageTitles, ["Original credit", "Other credit"]);
  assert.deepEqual(result.data.education[1].imageBackupDescriptions, ["Original backup", "Other backup"]);
});

test("approved API Development summary requires existing REST skills and an exact HTTP or Express course", () => {
  const { current, plan } = fixture();
  current.education[0].skills.push("REST APIs");
  current.education[0].courses.push("Express and HTTP services");
  plan.patches[0].expectedSkills = [...current.education[0].skills];
  plan.patches[0].skills = ["Java", "API Development"];
  plan.patches[0].evidence = [{ skill: "API Development", sourceSkills: ["REST APIs"], sourceCourses: ["Express and HTTP services"] }];
  const result = planEducationSkillsMigration(current, plan);
  assert.deepEqual(result.data.education[0].skills, ["Java", "API Development"]);
  assert.deepEqual(result.report.changes[0].summaryLabels, ["API Development"]);
});

test("unsupported labels, cross-record evidence and invented or unrelated courses fail without mutation", () => {
  const modifications = [
    ({ plan }) => { plan.patches[0].skills.push("Unconfirmed Expert Achievement"); },
    ({ plan }) => { plan.patches[0].evidence = []; },
    ({ plan }) => { plan.patches[0].evidence[0].sourceSkills = ["Microsoft Azure"]; },
    ({ plan }) => { plan.patches[0].evidence[0].sourceCourses = ["Invented AWS coursework"]; },
    ({ plan }) => { plan.patches[0].evidence[0].sourceCourses = ["Operating Systems"]; },
    ({ plan }) => { plan.patches[0].evidence.push(structuredClone(plan.patches[0].evidence[0])); },
    ({ plan }) => { plan.patches[0].evidence[0].sourceSkills = []; },
    ({ plan }) => { plan.patches[0].evidence[0].sourceCourses = []; },
    ({ current }) => { current.education[0].courses = "Cloud systems (AWS)"; },
    ({ plan }) => { plan.patches[0].skills = ["R"]; plan.patches[0].evidence = []; }
  ];
  for (const change of modifications) {
    const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planEducationSkillsMigration(f.current, f.plan), /evidence|unsupported|reviewed/);
    assert.deepEqual(f.current, before);
  }
});

test("stale, missing, ambiguous and duplicate education targets cannot change records", () => {
  for (const change of [
    ({ plan }) => { plan.patches[0].expectedSkills.pop(); },
    ({ plan }) => { plan.patches[0].match.start = "wrong period"; },
    ({ current }) => { current.education.push(structuredClone(current.education[0])); },
    ({ plan }) => { plan.patches.push(structuredClone(plan.patches[0])); }
  ]) {
    const f = fixture(); change(f); const before = structuredClone(f.current);
    assert.throws(() => planEducationSkillsMigration(f.current, f.plan), /Stale|duplicate|missing|ambiguous/);
    assert.deepEqual(f.current, before);
  }
});

test("out-of-scope plan fields, identity changes and non-canonical or oversized labels are rejected", () => {
  for (const change of [
    ({ plan }) => { plan.jobs = []; },
    ({ plan }) => { plan.patches[0].values = { grade: "Invented distinction" }; },
    ({ plan }) => { plan.patches[0].collection = "jobs"; },
    ({ plan }) => { plan.patches[0].match.grade = "Changed"; },
    ({ plan }) => { plan.patches[0].skills = []; },
    ({ plan, current }) => { plan.patches[0].skills = [...current.education[0].skills]; },
    ({ plan }) => { plan.patches[0].skills = ["Java", "Java"]; },
    ({ plan }) => { plan.patches[0].skills = [" "]; },
    ({ plan }) => { plan.patches[0].skills = ["Unit Testing"]; },
    ({ plan }) => { plan.patches[0].evidence[0].credential = "Secret"; }
  ]) {
    const f = fixture(); change(f);
    assert.throws(() => planEducationSkillsMigration(f.current, f.plan));
  }
});

test("ledger-aware planner repeats preserve later education edits and deleted records", () => {
  const { current, plan } = fixture();
  const later = planEducationSkillsMigration(current, plan).data;
  later.education.pop(); later.education[0].skills = ["Later owner choice"];
  later.projects = [];
  const result = planEducationSkillsMigration(later, plan, { alreadyApplied: true });
  assert.deepEqual(result.data, later);
  assert.equal(result.report.changed, false);
  assert.equal(result.report.alreadyApplied, true);
});

test("education Redis migration previews without writes and uses its own independent ledger", async () => {
  const f = redisFixture();
  const result = await migrateEducationSkillsRedis({ ...f.options, dryRun: true });
  assert.equal(result.applied, false);
  assert.equal(result.snapshotHash, sha(f.raw));
  assert.equal(result.ledgerKey, f.key + ":migrations:" + EDUCATION_SKILLS_MIGRATION_ID);
  assert.equal(f.values.get(f.key), f.raw);
  assert.equal(f.values.size, 2);
  assert.equal(f.backups.size, 0);
  assert.equal(f.writes(), 0);
});

test("guarded education apply backs up exact raw bytes and later repeats never rewrite edited content", async () => {
  const f = redisFixture();
  const result = await migrateEducationSkillsRedis(f.options);
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), f.raw);
  assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data));
  assert.deepEqual(mask(JSON.parse(f.values.get(f.key))), mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:previous"), "retain previous ledger");
  const later = JSON.parse(f.values.get(f.key));
  later.education.splice(1, 1); later.education[0].skills = ["Later choice"];
  later.projects = [];
  const laterRaw = JSON.stringify(later);
  f.values.set(f.key, laterRaw);
  const repeat = await migrateEducationSkillsRedis(f.options);
  assert.equal(repeat.applied, false);
  assert.deepEqual(repeat.data, later);
  assert.equal(f.values.get(f.key), laterRaw);
  assert.equal(f.writes(), 1);
});

test("stale hashes, changed candidates, failed backups and failed deployment guards cannot apply", async () => {
  for (const overrides of [
    { expectedHash: "0".repeat(64) },
    { expectedCandidateHash: undefined },
    { expectedCandidateHash: "0".repeat(64) },
    { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/education-test/source.json", backupReader: async () => "{}" }
  ]) {
    const f = redisFixture();
    await assert.rejects(migrateEducationSkillsRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw);
    assert.equal(f.writes(), 0);
  }
});

test("prepared education backups must match every original byte, not just parsed JSON", async () => {
  const f = redisFixture();
  await assert.rejects(migrateEducationSkillsRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/);
  assert.equal(f.writes(), 0);
  const result = await migrateEducationSkillsRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true);
  assert.equal(f.values.get(result.backupKey), f.raw);
});

test("a concurrent administrator edit aborts CAS without overwriting it or creating Redis backups", async () => {
  const f = redisFixture();
  const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migrateEducationSkillsRedis({ ...f.options, verifyDeployment: async () => {
    f.values.set(f.key, concurrent);
  } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent);
  assert.equal(f.values.size, 2);
  assert.equal(f.writes(), 0);
});

test("education CLI and migration reject ambiguous write modes before accessing files or Redis", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateEducationSkillsRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "not-read.json", "--apply"],
    ["--plan", "not-read.json", "--apply", "--input", "not-read.json"],
    ["--plan", "not-read.json", "--apply", "--dry-run"]]) {
    await assert.rejects(runEducationSkills(args), /option|Supply/);
  }
});

test("offline education CLI reports counts and hashes without exposing private source payloads", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-education-preview-"));
  t.after(async () => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-education-preview-"));
    await rm(directory, { recursive: true, force: true });
  });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-education-skills.js", "--input", input, "--plan", plan, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false);
  assert.equal(report.beforeOccurrences, 18);
  assert.equal(report.afterOccurrences, 9);
  assert.match(report.candidateHash, /^[a-f0-9]{64}$/);
  assert.equal(result.stdout.includes("PRIVATE_PAYLOAD_SENTINEL"), false);
  assert.equal(result.stdout.includes("Retain availability"), false);
});
