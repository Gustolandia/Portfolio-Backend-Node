import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { PROFESSIONAL_JOB_IDS, PROFESSIONAL_SKILLS_MIGRATION_ID, migrateProfessionalSkillsRedis,
  planProfessionalSkillsMigration } from "../src/content/professionalSkillsMigration.js";
import { normalizePortfolioData } from "../src/validation/portfolioData.js";
import { runProfessionalSkills } from "../scripts/migrate-professional-skills.js";

const sha = value => createHash("sha256").update(value).digest("hex");
const protectedIds = [PROFESSIONAL_JOB_IDS[1], PROFESSIONAL_JOB_IDS[5]];
const mask = value => {
  const copy = structuredClone(value);
  copy.jobs.forEach(row => { if (PROFESSIONAL_JOB_IDS.includes(row.id) && !protectedIds.includes(row.id)) delete row.skills; });
  return copy;
};

/** Builds all twelve persisted identities plus protected research and unrelated metadata. */
function fixture() {
  const current = normalizePortfolioData({
    profile: { name: "PRIVATE_PAYLOAD_SENTINEL", location: "", availability: "Retain availability" },
    research: { thesisTitle: "Original thesis", thesisMethods: ["Original method"] },
    jobs: PROFESSIONAL_JOB_IDS.map((id, index) => ({ id, title: `Existing role ${index}`, company: `Existing employer ${index}`,
      category: index === 11 ? "teaching" : "industry", start: "2020", end: String(2000 + index),
      location: "Original location", mapLocation: "Original map", featuredOrder: index + 1,
      skills: index === 1 ? ["Node.js", "TypeScript", "Software Testing", "Cloud Computing"] : index === 5 ? []
        : ["Python", "SQL", "JavaScript", "React", "TypeScript", "AWS", "Software Testing", "Git"],
      duties: ["Original duty"], imageUrls: ["/original.gif", "/second.png"], imageTitles: ["", "Original credit"],
      imageDescriptions: ["Original caption", "Second caption"], imageBackupDescriptions: ["Original backup", "Second backup"] })),
    education: [{ degree: "Existing study", skills: ["Statistics", "R"], courses: ["Original course"] }],
    projects: [{ id: "project-one", name: "Original work", category: "research", skills: ["Physics", "Python"],
      authors: ["Author One", "Author Two"], collaborators: ["Collaborator"], relatedRoleIds: [PROFESSIONAL_JOB_IDS[0]],
      collections: ["Owner collection"], links: ["/original.pdf"], linksTitles: ["Original title"],
      linksDescriptions: ["Original description"], linksBackupDescriptions: ["Original backup"] }]
  });
  current.jobs.reverse();
  current.jobs.splice(3, 0, { id: "research-one", category: "research", title: "Research role", skills: ["Original research skill"],
    duties: ["Original research duty"], privateMetadata: { preserve: ["Original", "order"] } });
  current.privateMetadata = { preserve: "Original raw metadata" };
  const plan = { version: 1, migrationId: PROFESSIONAL_SKILLS_MIGRATION_ID,
    patches: current.jobs.filter(row => PROFESSIONAL_JOB_IDS.includes(row.id)).map(row => ({
      match: Object.fromEntries(["id", "category", "title", "company"].map(field => [field, row[field]])),
      expectedSkills: [...row.skills], expectedDuties: [...row.duties],
      skills: protectedIds.includes(row.id) ? [...row.skills] : ["Python", "SQL"], evidence: []
    })) };
  return { current, plan };
}

/** Simulates the independent atomic Redis ledger/CAS without network or credentials. */
function redisFixture() {
  const { current, plan } = fixture(); const raw = JSON.stringify(current, null, 2); const key = "portfolio:professional-test";
  const values = new Map([[key, raw], [key + ":migrations:education-skills-2026-10-16-v1", "Retain education ledger"]]);
  const backups = new Map(); let writes = 0;
  const redis = { get: async target => values.get(target) ?? null, eval: async (script, keys, args) => {
    assert.match(script, /redis.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
    if (values.has(keys[1])) return 2;
    if (values.get(keys[0]) !== args[0]) return 0;
    values.set(keys[2], args[0]); values.set(keys[0], args[1]); values.set(keys[1], args[2]); writes += 1; return 1;
  } };
  const options = { redis, key, plan, dryRun: false, expectedHash: sha(raw),
    expectedCandidateHash: planProfessionalSkillsMigration(current, plan).candidateHash,
    backupDirectory: "private-content/professional-test", verifyDeployment: async () => {},
    backupWriter: async (path, value) => backups.set(path, value), backupReader: async path => backups.get(path) };
  return { current, plan, raw, key, values, backups, redis, options, writes: () => writes };
}

test("professional preview changes exactly ten skill arrays, preserving every other raw/public field and input", () => {
  const { current, plan } = fixture(); const original = structuredClone(current);
  const result = planProfessionalSkillsMigration(current, plan);
  assert.deepEqual(current, original);
  assert.deepEqual(mask(result.data), mask(current));
  assert.deepEqual(mask(normalizePortfolioData(result.data)), mask(normalizePortfolioData(current)));
  assert.equal(result.report.roles.length, 12); assert.equal(result.report.changes.length, 10);
  assert.equal(result.report.rawBeforeOccurrences, 84); assert.equal(result.report.rawAfterOccurrences, 24);
  assert.equal(result.candidateHash, sha(JSON.stringify(result.data)));
  assert.deepEqual(result.data.jobs.map(row => row.id), current.jobs.map(row => row.id));
  assert.equal(result.data.profile.location, "");
  for (const id of [...protectedIds, "research-one"]) {
    assert.deepEqual(result.data.jobs.find(row => row.id === id), current.jobs.find(row => row.id === id));
  }
  assert.deepEqual(result.data.jobs.find(row => row.id === PROFESSIONAL_JOB_IDS[11]).category, "teaching");
  assert.deepEqual(result.data.jobs.find(row => row.id === PROFESSIONAL_JOB_IDS[10]).category, "industry");
});

test("professional reductions distinguish raw from canonical counts and reject apparent duplicate-only reductions", () => {
  const f = fixture(); const patch = f.plan.patches.find(row => !protectedIds.includes(row.match.id));
  const row = f.current.jobs.find(row => row.id === patch.match.id);
  row.skills.push("Python", "Unit Testing"); patch.expectedSkills = [...row.skills];
  const result = planProfessionalSkillsMigration(f.current, f.plan);
  assert.equal(result.report.rawBeforeOccurrences, 86); assert.equal(result.report.normalizedBeforeOccurrences, 84);
  row.skills = ["Python", "Python", "SQL"]; patch.expectedSkills = [...row.skills];
  assert.throws(() => planProfessionalSkillsMigration(f.current, f.plan), /canonical reductions/);
});

test("every approved new broad professional label needs its exact role-local skills and recorded duty evidence", () => {
  const storage = "Integrated AWS storage for remote access and optimised MongoDB for time-series data.";
  const infrastructure = "Managed AWS infrastructure for mobile applications and implemented CI/CD pipelines.";
  const rules = [
    [0, "Cloud Computing", ["AWS"], ["Improved production reliability through Jest tests, AWS EC2 support, PM2, cron automation, nginx routing and logging."]],
    [2, "Cloud Computing", ["AWS"], [storage]],
    [2, "Database Management", ["MongoDB"], [storage]],
    [2, "DevOps", ["Docker", "CI/CD"], ["Deployed and managed containerised applications using Docker.",
      "Automated CI/CD workflows with Jenkins and tested backend APIs using Jest and Supertest."]],
    [3, "Web Development", ["React", "HTML", "CSS", "Bootstrap", "JavaScript"], [
      "Helped migrate the Portal website to React and built reusable components for the DattoUI Storybook."]],
    [4, "Statistics", ["Data Analysis", "Python", "SQL"], [
      "Used Python (NumPy and SciPy) and SQL for hypothesis testing, regression and ANOVA to investigate content-quality errors."]],
    [8, "Cloud Computing", ["AWS"], [infrastructure]], [8, "DevOps", ["AWS"], [infrastructure]],
    [8, "API Development", [], ["Developed REST APIs and internal tools."]],
    [8, "Automation", [], ["Automated routine tasks with shell scripts."]]
  ];
  for (const [index, skill, sourceSkills, sourceDuties] of rules) {
    const f = fixture(); const patch = f.plan.patches.find(row => row.match.id === PROFESSIONAL_JOB_IDS[index]);
    const row = f.current.jobs.find(row => row.id === patch.match.id);
    row.skills = [...new Set([...row.skills, ...sourceSkills])]; row.duties.push(...sourceDuties);
    patch.expectedSkills = [...row.skills]; patch.expectedDuties = [...row.duties];
    patch.skills = ["Python", skill]; patch.evidence = [{ skill, sourceSkills, sourceDuties }];
    assert.deepEqual(planProfessionalSkillsMigration(f.current, f.plan).report.roles.find(role => role.id === row.id).summaryLabels, [skill]);
    row.duties = ["Original duty"]; patch.expectedDuties = [...row.duties];
    assert.throws(() => planProfessionalSkillsMigration(f.current, f.plan), /record-local/);
  }
});

test("invented labels, languages, proficiency, foreign or missing evidence cannot add claims", () => {
  for (const change of [
    patch => { patch.skills = ["Python", "Machine Learning"]; },
    patch => { patch.skills = ["Python", "Bash"]; },
    patch => { patch.skills = ["Python", "Expert Cloud Computing"]; },
    patch => { patch.skills = ["Python", "Cloud Computing"]; patch.evidence = []; },
    patch => { patch.skills = ["Python", "Cloud Computing"]; patch.evidence = [{ skill: "Cloud Computing", sourceSkills: ["AWS"], sourceDuties: ["Original duty"] }]; },
    patch => { patch.evidence = [{ skill: "Python", sourceSkills: [], sourceDuties: ["Original duty"] }]; },
    patch => { patch.skills = ["Python", "Statistics"]; patch.evidence = [{ skill: "Statistics", sourceSkills: ["Data Analysis"], sourceDuties: [] }]; }
  ]) {
    const f = fixture(); change(f.plan.patches.find(row => row.match.id === PROFESSIONAL_JOB_IDS[0]));
    const before = structuredClone(f.current);
    assert.throws(() => planProfessionalSkillsMigration(f.current, f.plan), /evidence|labels/);
    assert.deepEqual(f.current, before);
  }
});

test("professional plans reject stale, duplicate, missing, research and out-of-scope targets", () => {
  for (const change of [
    f => { f.plan.extra = []; }, f => { f.plan.patches.pop(); },
    f => { f.plan.patches[0].values = { collections: ["Invented"] }; },
    f => { f.plan.patches[0].match.category = "research"; },
    f => { f.plan.patches[0].match.id = "research-one"; },
    f => { f.plan.patches[0].match.title = "Changed role"; },
    f => { f.plan.patches[0].expectedSkills.pop(); }, f => { f.plan.patches[0].expectedDuties = []; },
    f => { f.plan.patches[1] = structuredClone(f.plan.patches[0]); },
    f => { f.current.jobs.push(structuredClone(f.current.jobs[0])); },
    f => { f.current.jobs.splice(0, 1); }, f => { f.current.jobs[0].skills = null; },
    f => { f.current.profile = null; }, f => { f.current.education = {}; }
  ]) {
    const f = fixture(); change(f); const original = structuredClone(f.current);
    assert.throws(() => planProfessionalSkillsMigration(f.current, f.plan)); assert.deepEqual(f.current, original);
  }
});

test("protected Invertase/Covalen skills, canonical order and six-tag maximum cannot be weakened", () => {
  for (const change of [
    f => { f.plan.patches.find(row => row.match.id === PROFESSIONAL_JOB_IDS[1]).skills = ["Node.js"]; },
    f => { const p = f.plan.patches.find(row => row.match.id === PROFESSIONAL_JOB_IDS[5]);
      const row = f.current.jobs.find(row => row.id === p.match.id); row.skills = ["Trust and Safety"]; p.expectedSkills = [...row.skills]; p.skills = [...row.skills]; },
    f => { f.plan.patches[0].skills = []; }, f => { f.plan.patches[0].skills = ["Python", "Python"]; },
    f => { f.plan.patches[0].skills = ["Unit Testing"]; }, f => { f.plan.patches[0].skills = [" "]; },
    f => { f.plan.patches[0].skills = f.plan.patches[0].expectedSkills.slice(0, 7); }
  ]) { const f = fixture(); change(f); assert.throws(() => planProfessionalSkillsMigration(f.current, f.plan), /canonical reductions/); }
});

test("professional ledger-aware repeats retain later edits, deletions and unrelated collection updates", () => {
  const f = fixture(); const later = planProfessionalSkillsMigration(f.current, f.plan).data;
  later.jobs = later.jobs.filter(row => row.id !== PROFESSIONAL_JOB_IDS[0]);
  later.jobs[0].skills = ["Later owner choice"]; later.projects[0].collections = ["Later collection"];
  const result = planProfessionalSkillsMigration(later, null, { alreadyApplied: true });
  assert.deepEqual(result.data, later); assert.equal(result.report.changed, false); assert.equal(result.report.alreadyApplied, true);
});

test("professional Redis defaults/previews are read-only with a separate ledger and no backup writes", async () => {
  const f = redisFixture();
  for (const dryRun of [undefined, true]) {
    const result = await migrateProfessionalSkillsRedis({ ...f.options, dryRun });
    assert.equal(result.applied, false); assert.equal(result.snapshotHash, sha(f.raw));
    assert.equal(result.ledgerKey, f.key + ":migrations:" + PROFESSIONAL_SKILLS_MIGRATION_ID);
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.values.size, 2);
    assert.equal(f.backups.size, 0); assert.equal(f.writes(), 0);
  }
});

test("professional apply atomically preserves exact backups and later repeats never rewrite edited data", async () => {
  const f = redisFixture(); const result = await migrateProfessionalSkillsRedis(f.options);
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
  assert.equal(f.backups.get(result.backupPath), f.raw); assert.equal(f.values.get(f.key), JSON.stringify(result.data));
  assert.deepEqual(mask(JSON.parse(f.values.get(f.key))), mask(f.current));
  assert.equal(f.values.get(f.key + ":migrations:education-skills-2026-10-16-v1"), "Retain education ledger");
  const later = JSON.parse(f.values.get(f.key)); later.jobs.pop(); later.jobs[0].skills = ["Later owner choice"];
  const laterRaw = JSON.stringify(later); f.values.set(f.key, laterRaw);
  const repeat = await migrateProfessionalSkillsRedis(f.options);
  assert.equal(repeat.applied, false); assert.equal(repeat.report.alreadyApplied, true);
  assert.equal(f.values.get(f.key), laterRaw); assert.equal(f.writes(), 1);
});

test("professional source/candidate/deployment/backup guards abort before Redis writes", async () => {
  for (const overrides of [
    { expectedHash: "0".repeat(64) }, { expectedCandidateHash: undefined }, { expectedCandidateHash: "0".repeat(64) },
    { backupDirectory: undefined }, { verifyDeployment: undefined },
    { backupWriter: async () => { throw new Error("Backup failure"); } },
    { verifyDeployment: async () => { throw new Error("Deployment failure"); } },
    { backupFile: "private-content/professional-test/source.json", backupReader: async () => "{}" }
  ]) {
    const f = redisFixture(); await assert.rejects(migrateProfessionalSkillsRedis({ ...f.options, ...overrides }));
    assert.equal(f.values.get(f.key), f.raw); assert.equal(f.writes(), 0);
  }
});

test("professional prepared backups require exact source bytes, not only parsed equality", async () => {
  const f = redisFixture();
  await assert.rejects(migrateProfessionalSkillsRedis({ ...f.options, backupFile: "private-content/source.json",
    backupReader: async () => JSON.stringify(f.current) }), /exact raw source bytes/);
  assert.equal(f.writes(), 0);
  const result = await migrateProfessionalSkillsRedis({ ...f.options, backupFile: "private-content/source.json", backupReader: async () => f.raw });
  assert.equal(result.applied, true); assert.equal(f.values.get(result.backupKey), f.raw);
});

test("a concurrent professional admin edit fails CAS without overwriting live content", async () => {
  const f = redisFixture(); const concurrent = JSON.stringify({ ...f.current, concurrentOwnerEdit: true });
  await assert.rejects(migrateProfessionalSkillsRedis({ ...f.options, verifyDeployment: async () => { f.values.set(f.key, concurrent); } }), /admin changed/);
  assert.equal(f.values.get(f.key), concurrent); assert.equal(f.writes(), 0); assert.equal(f.values.size, 2);
});

test("professional CLI and runner reject ambiguous modes before file or Redis access", async () => {
  for (const dryRun of [null, "false", 0]) await assert.rejects(migrateProfessionalSkillsRedis({ dryRun }), /boolean/);
  for (const args of [[], ["--unknown"], ["--dry-run", "--dry-run"], ["--plan", "unread.json", "--apply"],
    ["--plan", "unread.json", "--apply", "--input", "unread.json"], ["--plan", "unread.json", "--apply", "--dry-run"],
    ["--plan", "unread.json", "--apply", "--expected-hash", "0".repeat(64), "--expected-candidate-hash", "0".repeat(64)]]) {
    await assert.rejects(runProfessionalSkills(args), /option|Supply/);
  }
});

test("offline professional CLI reports counts/hashes without exposing private source or changing files", async t => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-professional-preview-"));
  t.after(async () => { assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("portfolio-professional-preview-")); await rm(directory, { recursive: true, force: true }); });
  const f = fixture(); const input = join(directory, "source.json"); const plan = join(directory, "plan.json");
  await writeFile(input, JSON.stringify(f.current)); await writeFile(plan, JSON.stringify(f.plan));
  const result = spawnSync(process.execPath, ["scripts/migrate-professional-skills.js", "--input", input, "--plan", plan, "--dry-run"],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false); assert.equal(report.rawBeforeOccurrences, 84); assert.equal(report.rawAfterOccurrences, 24);
  assert.match(report.candidateHash, /^[a-f0-9]{64}$/); assert.equal(result.stdout.includes("PRIVATE_PAYLOAD_SENTINEL"), false);
  assert.equal(result.stdout.includes("Original duty"), false); assert.equal(result.stdout.includes("Retain availability"), false);
});
