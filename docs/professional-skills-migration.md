# Professional Experience Skill Reduction

This separately reviewed one-time update reduces/group similar skill tags on
the twelve existing industry/teaching roles. It changes only ten `jobs[].skills`
arrays; Invertase's concise list and Covalen's empty list stay exactly unchanged.
All five research roles, education/project/research skills and every other field
remain exact. There is no schema, frontend, runtime tag cap, global alias,
endpoint, authentication, CORS, CSRF, upload or dependency change.

## Reviewed Candidate

| Role | Before | After | Retained/Grouped Labels |
| --- | ---: | ---: | --- |
| BoscaSports | 6 | 5 | Node.js; Cloud Computing; API Development; System Integration; Software Testing |
| Invertase (Client: Google) | 4 | 4 | Node.js; TypeScript; Software Testing; Cloud Computing (unchanged) |
| Xerotech | 8 | 6 | Node.js; React; Cloud Computing; Database Management; DevOps; Software Testing |
| Datto (Kaseya) | 35 | 5 | React; TypeScript; PHP; Web Development; Software Testing |
| TikTok | 17 | 6 | Data Analysis; Statistics; Python; SQL; Quality Assurance; Data Visualization |
| Covalen (Client: Meta) | 0 | 0 | Empty (unchanged; no invented tags) |
| Accenture (Client: Google) | 22 | 5 | JavaScript; Automation; Web Development; Content Review; Process Improvement |
| Arvato Finance (Client: Google) | 20 | 6 | JavaScript; Automation; Web Security; Code Review; Mentoring; Quality Assurance |
| Vertu | 30 | 6 | Cloud Computing; API Development; DevOps; Data Analysis; SQL; Automation |
| Teleperformance (Client: Microsoft) | 19 | 6 | Troubleshooting; SQL; Linux; Windows Server; JavaScript; Automation |
| Stuttgart Student Job | 15 | 4 | Python; Scientific Computing; Mathematics; Plasma Physics |
| AEFCUP | 18 | 4 | Tutoring; Mathematics; Physics; Python |
| **Total occurrences** | **194** | **57** | **32 distinct professional filter labels** |

Raw and normalized counts happen to match in this reviewed source; the planner
reports/checks them independently rather than assuming that aliases/duplicates
never change a count. Every changed list has at most six canonical tags and is
strictly shorter than the original normalized list. This is an approved content
curation, not a new limit on ordinary admin PUT or the public payload contract.
Stuttgart stays `industry`; AEFCUP stays `teaching`. No role is reclassified.

## Record-Local Evidence

Retained tags must already exist in that same role's canonical skills. Every
new grouped label needs a pinned per-ID rule, exact source skill witnesses and
exact already-recorded duty sentences. Cross-role/course evidence, title-only
inference, loose keyword matching, new language/expertise claims and extra
unreviewed witnesses are rejected. The reviewed summaries are:

- BoscaSports `Cloud Computing`: AWS plus its recorded AWS EC2/reliability duty.
- Xerotech `Cloud Computing` and `Database Management`: AWS/MongoDB plus its
  recorded remote storage and time-series database duty. `DevOps`: Docker and
  CI/CD plus its recorded container deployment and Jenkins testing duties.
- Datto `Web Development`: React, HTML, CSS, Bootstrap and JavaScript plus the
  recorded React portal/reusable DattoUI components duty.
- TikTok `Statistics`: Data Analysis, Python and SQL plus the recorded NumPy/
  SciPy hypothesis-testing, regression and ANOVA duty.
- Vertu `Cloud Computing` and `DevOps`: AWS plus its recorded infrastructure/
  CI/CD duty. `API Development` is supported by its existing REST API/internal
  tools duty; `Automation` by its existing shell-script duty. These last two
  are explicitly duty-only evidence, not falsely described as retained old
  tags or used to infer Bash, Node.js or an expertise level.

Full original arrays and duty text remain in the complete private raw backup
and reviewed plan. Removed tag detail is not necessarily repeated in every duty.

## Plan And Preview

Start with a fresh **complete raw Redis snapshot**, not normalized public JSON
or the historical tracked seed. Preserve a byte-identical backup and the public
response, then compare the normalized raw projection with public content.

The root plan has exactly `version: 1`,
`migrationId: "professional-skills-2026-10-16-v1"` and `patches`. Each of exactly
twelve patches contains only:

```text
match: id, category, title, company (exact persisted source strings)
expectedSkills: complete original raw skill array, in order
expectedDuties: complete original raw duty array, in order
skills: reviewed canonical target array (protected Invertase/Covalen exact)
evidence: [{ skill, sourceSkills, sourceDuties }] for each new grouped label
```

Unknown fields, research IDs/categories, duplicate/missing/ambiguous targets,
stale identities/skills/duties, unapproved evidence and noncanonical/increased
normalized lists fail without mutation. The twelve IDs are allow-listed; no
automatic discovery or name-based classification changes any content.

```powershell
node scripts/migrate-professional-skills.js --input private-content/professional-skills-2026-10-16/source.original.json --plan private-content/professional-skills-2026-10-16/reviewed-plan.json --dry-run
node scripts/migrate-professional-skills.js --plan private-content/professional-skills-2026-10-16/reviewed-plan.json --dry-run
```

File input is offline preview-only. The second command reads raw Redis and its
own ledger using securely loaded backend environment variables. No new variable
is needed. Reports contain IDs/counts/hashes/backup references, not full source
content or credentials. Keep plans, candidates, originals and receipts under
ignored `private-content/`, excluded from Git and deployment inputs.

## Confirmation And Apply

**Publishing this code does not approve or apply its candidate.** Obtain separate
confirmation of the actual mapping, source/candidate hashes and full review
output. Before an approved apply, re-read the entire live raw/public payload;
if the reviewed source changed, stop and prepare a fresh review. Do not blindly
retry, reset ledgers or overwrite newer administrator edits.

Prove complete raw/public equality masking only the ten intended skill arrays.
Specifically compare all research rows, the two unchanged professional rows,
education/projects/thesis/profile, duties, identity/category, dates, ordering,
maps, collections and same-index image/file descriptions/backups. Preserve the
blank residence and all record counts. Verify tests and actual code deployment.

Only after that separate confirmation:

```powershell
node scripts/migrate-professional-skills.js --plan private-content/professional-skills-2026-10-16/reviewed-plan.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-raw-candidate-sha256> --backup-file private-content/professional-skills-2026-10-16/source.original.json
```

Both exact hashes, a byte-identical prepared backup and healthy deployed API are
required. The existing Lua CAS atomically compares the complete source value and
writes its exact Redis backup, candidate and separate ledger
`<portfolio-key>:migrations:professional-skills-2026-10-16-v1`. No historical
education/research/website migration is replayed. Backup/deployment failures or
concurrent edits abort without overwriting data. For an uncertain network result,
inspect raw readback and this ledger before taking further action.

Read back exact stored bytes, both original backups, ledger and uncached/ordinary
public GET. Prove the same complete field-scope equality. A wrapper repeat must
make no additional CAS/write and preserve later edits/deletions. Refresh frontend
memory and reset stale admin drafts so later full-payload saves cannot restore
old tags. Tests use isolated Redis mocks and do not write live content.

## Current Status

The 2026-10-16 preview proposes **194 to 57** occurrences, ten changed arrays,
32 distinct labels and unchanged record counts of 17 jobs, 7 education and
15 projects. All five research rows and the protected Invertase/Covalen records
remain exact. Complete raw/public comparisons mask only the ten skill arrays;
every other field and all media order match. The original backup was read back.
This is a reviewed preview, **not a claim of live application**. Full private
artifacts remain under `private-content/professional-skills-2026-10-16/`.

`test/professionalSkillsMigration.test.js` covers exact scope/evidence/identity,
canonical-vs-raw counts, protected empties, preserved metadata/media/order,
immutability, strict CLI modes, private reports, dry-run defaults, both hashes,
exact prepared backups, deployment failures, atomic CAS/concurrency and independent
ledger repeats retaining later edits/deletions. Existing API/security tests are
unchanged. No frontend file, dependency or runtime behavior changes here.
