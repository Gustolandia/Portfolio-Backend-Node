# Research And Project Skill Reduction

The owner separately authorized fewer, more relevant skills for the five current
research jobs and fifteen current projects. This one-time curation changes only
five `jobs[].skills` arrays and eleven `projects[].skills` arrays. Four already
concise paper/manuscript records stay exact in their entirety. The twelve
professional/teaching jobs and seven education records curated earlier stay
exact too. No frontend file, global alias, schema, ordinary admin tag cap,
endpoint, authentication, CORS, CSRF, upload or CV change is included.

## Reviewed Research Roles

| Role | Before | After | Retained Labels |
| --- | ---: | ---: | --- |
| TUS software engineering research | 20 | 5 | Java; Spring Boot; Microservices; Cloud Computing; SQL |
| IJL synthetic diagnostic placement | 14 | 5 | Python; Scientific Computing; Plasma Physics; Plasma Diagnostics; Data Analysis |
| CEA fusion placement | 16 | 6 | Python; MATLAB; Fortran; Scientific Computing; Plasma Physics; Plasma Diagnostics |
| IPP tokamak diagnostics placement | 12 | 5 | Python; Data Analysis; Plasma Physics; Plasma Diagnostics; Signal Processing |
| IFIMUP instrumentation placement | 16 | 5 | LabVIEW; Data Acquisition; Automated Control Systems; Experimental Physics; Materials Science |
| **Research role occurrences** | **78** | **26** | **18 distinct Research Experience filter choices** |

Every retained research-role label already occurs on that same role. Scientific
computing, plasma diagnostics/physics, signal processing and experimental
instrumentation remain distinct where relevant. No skill is inferred from an
institution, another record or a new research/proficiency claim. Duties and all
other metadata remain unchanged, including supervised-placement context.

## Reviewed Projects

| Project | Before | After | Retained/Grouped Labels |
| --- | ---: | ---: | --- |
| PFAS public-record audit | 3 | 2 | Scientific Research; Data Analysis |
| Lead-pipe funding preprint | 3 | 3 | Mathematical Modeling; Statistics; Data Analysis (unchanged) |
| Playing-time allocation preprint | 3 | 3 | Statistics; Mathematical Modeling; Data Analysis (unchanged) |
| Football exposure/injury preprint | 2 | 2 | Statistics; Data Analysis (unchanged) |
| Filebox | 12 | 6 | PHP; React; Linux; Database Management; API Development; Authentication |
| CarSurfing | 11 | 6 | Java; Spring Boot; Microservices; Database Management; API Development; Docker |
| My YouTube Bookmarks | 11 | 4 | JavaScript; Chrome Extensions; Web Development; UI/UX Design |
| Ireland's Luxury Apartments | 15 | 5 | PHP; JavaScript; Web Development; Database Management; Authentication |
| USA Manslaughter Analysis | 11 | 5 | Python; Statistics; Data Analysis; Data Cleaning; Data Visualization |
| Product Owner Role in Scrum | 10 | 3 | Agile; Project Management; Requirements Gathering |
| LinkedIn Clone | 11 | 5 | Node.js; React; Database Management; API Development; Authentication |
| Report on Reflectometry | 8 | 5 | MATLAB; Signal Processing; Plasma Diagnostics; Plasma Physics; Data Analysis |
| COMPASS disruption report | 10 | 5 | Python; Data Analysis; Plasma Physics; Plasma Diagnostics; Signal Processing |
| IFIMUP control/acquisition report | 6 | 5 | LabVIEW; Data Acquisition; Automated Control Systems; Experimental Physics; Materials Science |
| Streaming-latency manuscript | 4 | 4 | Performance Testing; Experimental Design; Statistics; Python (unchanged) |
| **Project occurrences** | **120** | **63** | **29 Research Work tags + 34 other project tags** |

Together the twenty reviewed lists change from **198 to 89** occurrences.
Research Work has 16 distinct filter choices; the non-research Projects view has
23. Scientific wording, bylines, authors/contributors, publication status, dates,
IDs/categories, relationships, featured positions, maps, collections, all media
and same-index descriptions/backups remain exact. A manuscript's artifact
release number does not establish publication status. The early-stage thesis,
questions/methods/interests and all profile fields remain untouched. Removed
fine-grained tag detail stays in the complete raw backup; detailed descriptions
are not rewritten to remove technologies or to invent new findings.

## Honest Record-Local Evidence

Apart from five explicitly reviewed broad-label occurrences, all output labels
must already exist in that same record's canonical skills:

- Filebox `Database Management`: its existing `MySQL` tag is direct evidence.
  `sourceNarrative: []` is intentional: its description does not explicitly
  name MySQL. Do not manufacture a narrative witness or a proficiency claim.
- CarSurfing `Database Management`: its existing `MySQL` tag plus its exact
  recorded MySQL-backed microservices description. `API Development`: existing
  `REST APIs` plus that description and the recorded majority-backend contribution.
- LinkedIn Clone `Database Management`: its existing `MongoDB` tag plus its
  exact recorded Express.js/MongoDB backend description. `API Development`:
  existing `REST APIs` plus the same backend description.

Filebox's existing API Development and Apartments' existing Database Management
are retained, not newly inferred labels. Loose keyword/negation matching,
cross-record/course evidence, new tools/languages, generic proficiency claims,
extra witnesses and unsupported broad labels fail. Ordinary authenticated admin
saves remain user-editable; these evidence rules apply only to this migration.

## Private Plan And Dry Run

Take a fresh complete exact-byte **raw Redis** backup and public response; verify
normalizing the raw snapshot gives that public payload. Do not use public JSON
as a raw backup or assume a previous hash is still current. The historical local
seed is never used to replace edited live content.

The root has exactly `version: 1`,
`migrationId: "research-project-skills-2026-10-16-v1"` and `patches`. Exactly
twenty allow-listed persisted IDs must appear once, with no inferred identity:

```text
collection: jobs | projects
match: id/category/title/company (jobs), id/category/name (projects)
expectedSkills: complete original raw skill array in order
expectedNarrative: { duties } (jobs), { description, contribution } (projects)
skills: reviewed canonical reduction, or exact protected project list
evidence: [{ skill, sourceSkills, sourceNarrative: [{ field, value }] }]
```

Categories are pinned by ID, including the original research/software/data/
coursework distinctions. Stale narratives/identities/arrays, duplicate/missing/
ambiguous targets, unknown fields and out-of-scope collections fail without
mutation. Raw and normalized counts are checked separately; duplicates cannot
hide an increase. Changed lists have one to six canonical labels in this reviewed
plan only. API normalization must not re-expand or rewrite them.

```powershell
node scripts/migrate-research-project-skills.js --input private-content/research-project-skills-2026-10-16/source.original.json --plan private-content/research-project-skills-2026-10-16/reviewed-plan.json --dry-run
node scripts/migrate-research-project-skills.js --plan private-content/research-project-skills-2026-10-16/reviewed-plan.json --dry-run
```

File input is preview-only. The second command reads raw Redis and its separate
ledger using securely loaded backend variables. No new environment variable is
needed. Counts, IDs, hashes and backup references may be reported, never complete
source/narrative or credentials. Keep backups, plans, candidate snapshots and
receipts under ignored `private-content/`, excluded from Git/deployment.

## Confirm, Apply And Verify

Publishing maintenance code is not approval to apply its preview. Independently
confirm the exact candidate/hash and complete field-scope proof first. Verify all
checks and actual deployment, then freshly read the complete live raw/public
source immediately before applying. If the source differs, stop for a new review;
do not silently regenerate a different candidate or force an old plan through.

```powershell
node scripts/migrate-research-project-skills.js --plan private-content/research-project-skills-2026-10-16/reviewed-plan.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-raw-candidate-sha256> --backup-file private-content/research-project-skills-2026-10-16/source.original.json
```

Both hashes, an exact-byte prepared complete original and deployed API check are
required. One existing Lua CAS atomically compares the original raw value and
writes its exact Redis backup, candidate and independent ledger
`<portfolio-key>:migrations:research-project-skills-2026-10-16-v1`. Failed backups,
changed candidates, stale source and concurrent admin edits cannot overwrite
content. No previous skills/research/content migration is replayed by this tool,
GET, startup, deployment or tests. Inspect raw/ledger after an uncertain result;
never blindly retry a write.

Verify exact candidate bytes in Redis, complete local/Redis original backups,
ledger, and uncached plus ordinary public readback. Deep-compare full raw/public
objects masking **only** the sixteen approved skill arrays. Check the four entire
protected project records, all twelve professional jobs, all seven education
records and every other field/order. Repeat through the ledger-aware wrapper:
it must make zero extra CAS calls/writes and retain later edits/deletions. Reload
frontend memory and reset stale admin drafts, without an unnecessary admin save.
No upload, asset deletion or collection assignment belongs to this operation.

## Current Status And Tests

The 2026-10-16 private preview has the exact counts and lists above, with raw/public
scope proof, original backup readback and all protected records unchanged.
Record counts stay 17 jobs, 7 education and 15 projects. This is preview evidence,
not a claim of live application. Private artifacts remain under
`private-content/research-project-skills-2026-10-16/`.

`test/researchProjectSkillsMigration.test.js` covers all twenty identities,
sixteen-array scope, unchanged scientific wording/bylines/status/media/order,
professional/education/four-project preservation, honest skill-only and exact
narrative evidence, canonical/raw counts, stale/foreign/ambiguous operations,
input immutability, strict CLI modes/private output, default previews, both
hashes, exact backups, deployment failures, concurrency and independent-ledger
no-op repeats. All Redis applies in tests are mocked; no test writes live content.
