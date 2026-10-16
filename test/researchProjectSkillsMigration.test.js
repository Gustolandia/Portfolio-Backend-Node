import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { RESEARCH_PROJECT_SKILLS_MIGRATION_ID, RESEARCH_SKILL_JOB_IDS, SKILL_PROJECT_IDS, PROTECTED_SKILL_PROJECT_IDS,
  migrateResearchProjectSkillsRedis, planResearchProjectSkillsMigration } from "../src/content/researchProjectSkillsMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runResearchProjectSkills } from "../scripts/migrate-research-project-skills.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const mask = value => {
  const copy = structuredClone(value);
  copy.jobs.forEach(row => { if (RESEARCH_SKILL_JOB_IDS.includes(row.id)) delete row.skills; });
  copy.projects.forEach(row => { if (SKILL_PROJECT_IDS.includes(row.id) && !PROTECTED_SKILL_PROJECT_IDS.includes(row.id)) delete row.skills; });
  return copy;
};
const CAR_DESCRIPTION = "A carpooling application with Spring Boot microservices for users, rides and reviews, backed by MySQL and Docker. Gillian Middleton developed the Vue.js frontend; a recorded demonstration and project reports document the work.";
const CAR_CONTRIBUTION = "Developed most of the Spring Boot backend for CarSurfing, a microservices-based carpooling service.";
const LINKEDIN_DESCRIPTION = "A professional-networking application built with an Express.js/MongoDB backend and a React/Bootstrap frontend. Includes authentication, profiles, experience records and posts.";

/** Builds the full twenty-ID scope with twelve professional and seven education records protected. */
function fixture() {
  const categories = ["research", "research", "research", "research", "software", "software", "software", "software",
    "data", "coursework", "software", "research", "research", "research", "research"];
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", location: "", cvUrl: "/original.pdf", researchInterests: ["Original interest"] },
    research: { thesisTitle: "Prediction is an aim, not an established result", thesisQuestions: ["Original question"], thesisMethods: ["Original method"] },
    jobs: [
      ...RESEARCH_SKILL_JOB_IDS.map((id, index) => ({ id, category: "research", title: `Existing research ${index}`, company: "Original institution",
        duties: ["Supervised work, not a new original discovery"], skills: ["Python", "Statistics", "Data Analysis", "Scientific Computing",
          "Plasma Physics", "Plasma Diagnostics", "Signal Processing", "MATLAB"], start: "2018", end: String(2000 + index),
        featuredOrder: index + 1, mapLocation: "Original map", location: "Original historic location",
        imageUrls: ["/original.gif", "/second.png"], imageTitles: ["", "Original credit"], imageDescriptions: ["Original description", "Other description"],
        imageBackupDescriptions: ["Original backup", "Other backup"] })),
      ...Array.from({ length: 12 }, (_, index) => ({ id: `professional-${index}`, category: index === 11 ? "teaching" : "industry",
        title: "Original professional role", company: "Original employer", skills: index === 5 ? [] : ["Node.js", "Cloud Computing"], duties: ["Original professional duty"] }))
    ],
    education: Array.from({ length: 7 }, (_, index) => ({ degree: `Original degree ${index}`, institution: "Original institution",
      skills: ["Statistics", "R"], courses: ["Original course"], activities: ["Original activity"] })),
    projects: SKILL_PROJECT_IDS.map((id, index) => ({ id, category: categories[index], name: `Original work ${index}`,
      dateOfCompletion: String(2000 + index), outputType: "manuscript", status: "in-preparation", featuredOrder: index + 1,
      description: "Supervised analysis; nulls stay inconclusive, no causal prediction", contribution: "Original specific contribution",
      authors: ["Author One", "Author Two"], collaborators: ["Collaborator"], affiliations: ["Original institution"],
      relatedRoleIds: [RESEARCH_SKILL_JOB_IDS[0]], collections: ["Owner-selected collection"],
      skills: PROTECTED_SKILL_PROJECT_IDS.includes(id) ? ["Statistics", "Data Analysis", "Python"]
        : ["Python", "Statistics", "Data Analysis", "JavaScript", "React", "REST APIs", "MongoDB", "MySQL"],
      imageUrls: ["/work.gif"], imageDescriptions: ["Original image caption"], imageBackupDescriptions: ["Original image backup"],
      links: ["/one.pdf", "/two.pdf"], linksTitles: ["", "Original file credit"],
      linksDescriptions: ["Original file description", "Other file description"], linksBackupDescriptions: ["Original file backup", "Other file backup"] }))
  });
  current.jobs.reverse(); current.projects.reverse();
  current.privateMetadata = { preserve: ["Original", "order"] };
  current.projects[0].legacyMetadata = "Retain unknown raw metadata";
  const patches = [];
  for (const [collection, ids] of [["jobs", RESEARCH_SKILL_JOB_IDS], ["projects", SKILL_PROJECT_IDS]]) {
    for (const id of ids) {
      const row = current[collection].find(row => row.id === id);
      const fields = collection === "jobs" ? ["id", "category", "title", "company"] : ["id", "category", "name"];
      patches.push({ collection, match: Object.fromEntries(fields.map(key => [key, row[key]])), expectedSkills: [...row.skills],
        expectedNarrative: collection === "jobs" ? { duties: [...row.duties] } : { description: row.description, contribution: row.contribution },
        skills: PROTECTED_SKILL_PROJECT_IDS.includes(id) ? [...row.skills] : ["Python", "Data Analysis"], evidence: [] });
    }
  }
  return { current, plan: { version: 1, migrationId: RESEARCH_PROJECT_SKILLS_MIGRATION_ID, patches } };
}

/** Simulates raw atomic CAS and independent ledgers without network, secrets or live Redis. */
function redisFixture() {
  const { current, plan } = fixture(); const raw = JSON.stringify(current, null, 2); const key = "portfolio:research-project-test";
  const values = new Map([[key, raw], [key + ":migrations:professional-skills-2026-10-16-v1", "Retain prior ledger"]]);
  const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2;
    if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planResearchProjectSkillsMigration(current, plan).candidateHash,
    backupDirectory: "private-content/research-project-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { current, plan, raw, key, values, backups, redis, options, writes: () => writes };
}

test("research/project preview changes only sixteen skill arrays with all twenty reviewed identities and no input mutation", () => {
  const f = fixture(); const original = structuredClone(f.current); const result = planResearchProjectSkillsMigration(f.current, f.plan);
  assert.deepEqual(f.current, original); assert.deepEqual(mask(result.data), mask(original));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(original)));
  assert.equal(result.report.records.length, 20); assert.equal(result.report.changes.length, 16);
  assert.deepEqual(result.report.before, { jobs: { raw: 40, normalized: 40 }, projects: { raw: 100, normalized: 100 } });
  assert.deepEqual(result.report.after, { jobs: { raw: 10, normalized: 10 }, projects: { raw: 34, normalized: 34 } });
  assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  assert.deepEqual(result.data.jobs.map(row => row.id), original.jobs.map(row => row.id));
  assert.deepEqual(result.data.projects.map(row => row.id), original.projects.map(row => row.id));
});

test("research/project curation preserves twelve professional jobs, seven education records, scientific wording and all four concise projects", () => {
  const { current, plan } = fixture(); const { data } = planResearchProjectSkillsMigration(current, plan);
  assert.deepEqual(data.jobs.filter(row => row.category !== "research"), current.jobs.filter(row => row.category !== "research"));
  assert.equal(data.jobs.filter(row => row.category !== "research").length, 12);
  assert.deepEqual(data.education, current.education); assert.equal(data.education.length, 7);
  assert.deepEqual(data.research, current.research); assert.deepEqual(data.profile, current.profile);
  for (const id of PROTECTED_SKILL_PROJECT_IDS) assert.deepEqual(data.projects.find(row => row.id === id), current.projects.find(row => row.id === id));
  for (const project of data.projects) {
    assert.equal(project.description, "Supervised analysis; nulls stay inconclusive, no causal prediction");
    assert.equal(project.status, "in-preparation"); assert.deepEqual(project.authors, ["Author One", "Author Two"]);
    assert.deepEqual(project.links, ["/one.pdf", "/two.pdf"]); assert.deepEqual(project.linksBackupDescriptions, ["Original file backup", "Other file backup"]);
  }
});

test("research/project counts distinguish raw duplicates/aliases and prevent a normalized tag increase", () => {
  const f = fixture(); const patch = f.plan.patches[0]; const row = f.current.jobs.find(row => row.id === patch.match.id);
  row.skills.push("Python", "Python"); patch.expectedSkills = [...row.skills];
  const result = planResearchProjectSkillsMigration(f.current, f.plan);
  assert.equal(result.report.before.jobs.raw, 42); assert.equal(result.report.before.jobs.normalized, 40);
  row.skills = ["Python", "Python", "Data Analysis"]; patch.expectedSkills = [...row.skills];
  assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /canonical reductions/);
});

test("Filebox database grouping is honestly skills-only, without manufacturing a MySQL narrative", () => {
  const f = fixture(); const patch = f.plan.patches.find(row => row.match.id === SKILL_PROJECT_IDS[4]);
  const row = f.current.projects.find(row => row.id === patch.match.id);
  assert.equal(row.description.includes("MySQL"), false);
  patch.skills = ["Python", "Database Management"]; patch.evidence = [{ skill: "Database Management", sourceSkills: ["MySQL"], sourceNarrative: [] }];
  assert.deepEqual(planResearchProjectSkillsMigration(f.current, f.plan).data.projects.find(item => item.id === row.id).skills, patch.skills);
  patch.evidence[0].sourceNarrative = [{ field: "description", value: row.description }];
  assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /record-local/);
  patch.evidence[0].sourceNarrative = []; row.skills = row.skills.filter(skill => skill !== "MySQL"); patch.expectedSkills = [...row.skills];
  assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /record-local/);
});

test("CarSurfing/LinkedIn summaries require same-record database/REST tags and exact recorded backend narrative", () => {
  for (const index of [5, 10]) {
    const f = fixture(); const patch = f.plan.patches.find(row => row.match.id === SKILL_PROJECT_IDS[index]);
    const row = f.current.projects.find(row => row.id === patch.match.id);
    row.description = index === 5 ? CAR_DESCRIPTION : LINKEDIN_DESCRIPTION; row.contribution = index === 5 ? CAR_CONTRIBUTION : "";
    patch.expectedNarrative = { description: row.description, contribution: row.contribution };
    const description = { field: "description", value: row.description };
    patch.skills = ["Python", "Database Management", "API Development"];
    patch.evidence = [
      { skill: "Database Management", sourceSkills: [index === 5 ? "MySQL" : "MongoDB"], sourceNarrative: [description] },
      { skill: "API Development", sourceSkills: ["REST APIs"], sourceNarrative: index === 5 ? [description, { field: "contribution", value: row.contribution }] : [description] }
    ];
    assert.deepEqual(planResearchProjectSkillsMigration(f.current, f.plan).data.projects.find(item => item.id === row.id).skills, patch.skills);
    row.description = "Did not implement a backend"; patch.expectedNarrative.description = row.description;
    patch.evidence.forEach(witness => { witness.sourceNarrative[0] = { field: "description", value: row.description }; });
    assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /record-local/);
  }
});

test("research roles cannot gain labels, and projects reject invented, cross-record or unsupported evidence", () => {
  for (const change of [
    f => { f.plan.patches[0].skills = ["Python", "Database Management"]; },
    f => { f.plan.patches[0].skills = ["Python", "Expert Scientific Computing"]; },
    f => { f.plan.patches.find(p => p.match.id === SKILL_PROJECT_IDS[8]).skills = ["Python", "Machine Learning"]; },
    f => { f.plan.patches.find(p => p.match.id === SKILL_PROJECT_IDS[4]).skills = ["Python", "Database Management"]; },
    f => { const p = f.plan.patches.find(p => p.match.id === SKILL_PROJECT_IDS[4]); p.skills = ["Python", "Database Management"];
      p.evidence = [{ skill: "Database Management", sourceSkills: ["MongoDB"], sourceNarrative: [] }]; },
    f => { const p = f.plan.patches.find(p => p.match.id === SKILL_PROJECT_IDS[4]); p.skills = ["Python", "Database Management"];
      p.evidence = Array.from({ length: 2 }, () => ({ skill: "Database Management", sourceSkills: ["MySQL"], sourceNarrative: [] })); },
    f => { f.plan.patches[0].evidence = [{ skill: "Python", sourceSkills: [], sourceNarrative: [] }]; }
  ]) { const f = fixture(); change(f); const original = structuredClone(f.current);
    assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /evidence|labels/); assert.deepEqual(f.current, original); }
});

test("research/project scope rejects foreign identities, categories, collections and stale skills/narratives", () => {
  for (const change of [
    f => { f.plan.extra = []; }, f => { f.plan.patches.pop(); },
    f => { f.plan.patches[0].values = { status: "published" }; },
    f => { f.plan.patches[0].match.id = "professional-1"; f.plan.patches[0].match.category = "industry"; },
    f => { f.plan.patches[0].collection = "education"; }, f => { f.plan.patches[0].match.category = "industry"; },
    f => { f.plan.patches.find(p => p.match.id === SKILL_PROJECT_IDS[8]).match.category = "research"; },
    f => { f.plan.patches[0].match.title = "Different research role"; },
    f => { f.plan.patches[0].expectedSkills.pop(); }, f => { f.plan.patches[0].expectedNarrative.duties = []; },
    f => { f.plan.patches[5].expectedNarrative.description = "Invented result"; },
    f => { f.plan.patches[1] = structuredClone(f.plan.patches[0]); },
    f => { f.current.jobs.push(structuredClone(f.current.jobs.find(row => row.id === RESEARCH_SKILL_JOB_IDS[0]))); },
    f => { f.current.projects = f.current.projects.filter(row => row.id !== SKILL_PROJECT_IDS[0]); },
    f => { f.current.jobs.find(row => row.id === RESEARCH_SKILL_JOB_IDS[0]).skills = null; },
    f => { f.current.profile = null; }, f => { f.current.education = {}; }
  ]) { const f = fixture(); change(f); const original = structuredClone(f.current);
    assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan)); assert.deepEqual(f.current, original); }
});

test("protected project lists stay exact and reductions must be canonical, nonempty and within the reviewed planner limit", () => {
  for (const change of [
    f => { f.plan.patches.find(p => p.match.id === PROTECTED_SKILL_PROJECT_IDS[0]).skills = ["Python"]; },
    f => { f.plan.patches.find(p => p.match.id === PROTECTED_SKILL_PROJECT_IDS[0]).skills.reverse(); },
    f => { f.plan.patches[0].skills = []; }, f => { f.plan.patches[0].skills = ["Python", "Python"]; },
    f => { f.plan.patches[0].skills = [" "]; }, f => { f.plan.patches[0].skills = ["Unit Testing"]; },
    f => { f.plan.patches[0].skills = f.plan.patches[0].expectedSkills.slice(0, 7); }
  ]) { const f = fixture(); change(f); assert.throws(() => planResearchProjectSkillsMigration(f.current, f.plan), /canonical reductions/); }
});

test("completed research/project ledger repeats retain later skills, deleted records and owner collections", () => {
  const f = fixture(); const later = planResearchProjectSkillsMigration(f.current, f.plan).data;
  later.jobs = later.jobs.filter(row => row.id !== RESEARCH_SKILL_JOB_IDS[0]); later.projects.pop();
  later.projects[0].skills = ["Later owner choice"]; later.projects[0].collections = ["Later owner collection"];
  const result = planResearchProjectSkillsMigration(later, null, { alreadyApplied: true });
  assert.deepEqual(result.data, later); assert.equal(result.report.changed, false); assert.equal(result.report.alreadyApplied, true);
});

test("research/project Redis preview defaults are read-only with an independent ledger and no backups", async () => {
  const f = redisFixture();
  for (const dryRun of [undefined, true]) { const result = await migrateResearchProjectSkillsRedis({ ...f.options, dryRun });
    assert.equal(result.applied, false); assert.equal(result.snapshotHash, sha(f.raw));
    assert.equal(result.ledgerKey, f.key + ":migrations:" + RESEARCH_PROJECT_SKILLS_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2); assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0); }
});

test("research/project apply atomically backs up exact source and repeats never restore later owner edits", async () => {
  const f = redisFixture(); const result = await migrateResearchProjectSkillsRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw); assert.equal(f.backups.get(result.backupPath), f.raw);
  assert.equal(f.values.get(f.key), JSON.stringify(result.data)); assert.deepEqual(mask(result.data), mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:professional-skills-2026-10-16-v1"), "Retain prior ledger");
  const later = JSON.parse(f.values.get(f.key)); later.projects.pop(); later.jobs.pop(); later.projects[0].skills = ["Later choice"];
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw);
  const repeat = await migrateResearchProjectSkillsRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true); assert.equal(repeat.report.changed, false);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("research/project source/candidate/deployment/backup guard failures cannot write Redis", async () => {
  for (const overrides of [{ expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined }, { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/research-project-test/source.json", backupReader: async () => "{}" }]) {
    const f = redisFixture(); await assert.rejects(migrateResearchProjectSkillsRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.writes(), 0);
  }
});

test("research/project prepared backup must match every source byte, not parsed JSON alone", async () => {
  const f = redisFixture();
  await assert.rejects(migrateResearchProjectSkillsRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/);
  assert.equal(f.writes(), 0);
  const result = await migrateResearchProjectSkillsRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("a concurrent research/project admin edit aborts CAS without overwriting or creating Redis backups", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migrateResearchProjectSkillsRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.values.size, 2); assert.equal(f.writes(), 0);
});

test("research/project CLI rejects ambiguous write modes before accessing files or Redis", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateResearchProjectSkillsRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "unread.json", "--apply"],
    ["--plan", "unread.json", "--apply", "--input", "unread.json"], ["--plan", "unread.json", "--apply", "--dry-run"],
    ["--plan", "unread.json", "--apply", "--expected-hash", "0".repeat(64), "--expected-candidate-hash", "0".repeat(64)]]) {
    await assert.rejects(runResearchProjectSkills(args), /option|Supply/);
  }
});

test("offline research/project CLI reports safe counts/hashes without exposing source or narrative", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-research-project-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-research-project-preview-")); await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-research-project-skills.js", "--input", input, "--plan", plan, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false); assert.equal(report.before.jobs.raw, 40); assert.equal(report.after.projects.raw, 34);
  assert.match(report.candidateHash, /^[a-f0-9]{64}$/); assert.equal(result.stdout.includes("PRIVATE_PAYLOAD_SENTINEL"), false);
  assert.equal(result.stdout.includes("causal prediction"), false); assert.equal(result.stdout.includes("Original specific contribution"), false);
});
