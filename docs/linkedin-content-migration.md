# Reviewed LinkedIn Content Update

Publication note: these tools/docs/tests are now included in the reviewed
maintenance release. See [maintenance boundaries and release checks](maintenance-tools.md).
This publishes tooling only; it does not replay the historical data update below.

The user's signed-in profile was read on 2026-10-15 at
[experience](https://www.linkedin.com/in/gricou/details/experience/) and
[education](https://www.linkedin.com/in/gricou/details/education/). The user
authorized verified factual updates to the live portfolio. LinkedIn was read
only; no profile edits or bulk cookie transfer are part of this migration.

This is a separate, explicitly applied content update with ledger identity
`linkedin-content-2026-10-15-v1`. It does not reuse or reset the completed
`research-content-2026-10-15-v1` ledger. GET/PUT never automatically import jobs.
No endpoint, cookie, CORS, CSRF, Redis credential or ImageKit contract changes.

## Exact Scope

Four industry roles are added with explicit stable IDs:

| Employer | Title | Start | End | Location |
| --- | --- | --- | --- | --- |
| BoscaSports | Software Engineer | 2025-09-01 | Present | Dublin, Ireland (remote) |
| Invertase (Client: Google) | Software Engineer | 2024-10-01 | 2025-01-01 | Manchester, UK (remote) |
| Xerotech | Full-Stack Developer - Industrial Automation | 2024-01-01 | 2025-01-01 | Galway, Ireland (remote) |
| Covalen (Client: Meta) | Community Operations Analyst | 2019-09-01 | 2020-04-01 | Dublin, Ireland |

LinkedIn supplies month precision. The ISO first-of-month day is a storage
convention, not a claim about the exact employment day. Overlapping roles stay
as documented. `end: "Present"` is supported and sorts ongoing work first; jobs
have no separate status field. Duties are concise faithful paraphrases of the
reviewed source. Skills use the existing canonicalizer; no existing skills are
rewritten. Covalen has no inferred skills. New media arrays are empty and
`mapLocation` is empty: no logos, office coordinates or photos are invented.

Ten existing roles have reviewed title corrections, matched by their pre-edit
stable IDs; Arvato's start is additionally corrected to June 2017. The exact
titles and field list are in `LINKEDIN_JOB_CORRECTIONS` in
`src/content/linkedInContentMigration.js`. Existing IDs and categories are
pinned before renaming because some legacy values are still computed on GET.
This protects research placement when a new title omits the word Research.
No existing duties, skills, dates outside the one correction, relationships or
same-index media metadata are changed.

Exactly one TCD education record is matched by its original institution
`Trinity College, Dublin`, start `2024-09-01` and end `2027-10-01`. Only these
fields change:

- Institution: `Trinity College Dublin`.
- Degree: `MSc in Statistics and Data Science`.
- Grade: `80% (current mark as of June 2026; not a final degree result)`.
- Status: `in-progress`.

The expected end date remains unchanged; it does not establish degree
completion. Other institutions, grades, dates, courses and media remain intact.
Only `profile.location` becomes `Galway, Ireland`; academic headline, summary,
contact, portrait, CV and research interests are preserved.

Only the experience and education page descriptions are updated to the
reviewed factual introductions. All page titles/images and the other pages
stay unchanged. Papers, their ordered authors/statuses, all projects, thesis,
other education, certifications and unrelated raw content are outside scope.
Travel/career breaks, humorous profile wording and volunteer governance are not
imported as paid jobs. An EFSET certificate has no appropriate current
collection and is deliberately omitted.

## Preview And Backup

The source is always the complete current raw Redis value, never the older
tracked local seed. The expected reviewed inventory is 13 jobs, 7 education
entries and 15 projects; application adds only four jobs, giving 17/7/15.
Missing/ambiguous correction targets, duplicate employers or a different scope
must be reviewed before applying. Unknown raw fields are retained, while the
normalized candidate is checked against the existing API validator.

With the existing backend-only Upstash configuration available securely:

```powershell
npm run migrate:linkedin -- --dry-run --report private-content/linkedin-dry-run.json
```

A complete private file snapshot can also be previewed without Redis writes:

```powershell
npm run migrate:linkedin -- --input private-content/backups/original.json --dry-run
```

File input is preview-only. Reports include the exact raw SHA-256, proposed
professional field diff, identity/category pinning and counts; they never print
credentials or the complete content. Keep snapshots, reports and receipts
inside ignored `private-content/`, not committed files or chat output.

## Reviewed Application

Only after the fresh raw diff/hash and complete backup are reviewed:

```powershell
npm run migrate:linkedin -- --apply --expected-hash REVIEWED_RAW_SHA256
```

The shared `migratePortfolioContentRedis` guard requires a compatible deployed
academic/authors contract and a complete original file backup before writing.
The raw hash is checked again. One Lua compare-and-set transaction writes the
exact original Redis backup, replacement and separate LinkedIn ledger
together. Concurrent edits abort without Redis writes. A failed or incomplete
backup aborts before application. The prepared `--backup-file` option supports
an already retained outside-Git backup and verifies its complete JSON content.
This is the same tested guard used by the research migration, with separate
planners and ledger identities.

An existing LinkedIn ledger makes the update a complete no-op, so later edited
or deleted jobs/pages/contact values are never restored. Do not use the general
seed command or rerun a stale reviewed patch to overwrite the current portfolio.
Netlify production secrets can be masked; use legitimately available configured
development credentials only after verifying the target raw content matches
the normalized production response. Do not weaken secret settings or expose
credentials. On packaged Windows, a separate application settings copy can hide
a completed CLI login; do not ask users to repeat a confirmed login or copy
tokens into chat.

## Verification

After an approved write, verify full file/Redis backups and retain a receipt
with the original and resulting hashes, backup keys, ledger, deployment identity
and counts. Public GET must match the normalized saved data, return 17/7/15,
keep all original IDs/categories and media associations, and preserve every
unapproved field. Verify ongoing ordering, overlapping dates, provisional TCD
status/grade and literal ampersands in titles. A repeat read-only preview must
have `alreadyApplied: true`, no additions/updates and `changed: false`.

`test/linkedInContentMigration.test.js` covers the exact field scope, additions,
legacy identity/category pinning, ordered media, conservative status/dates,
source ambiguity, separate ledger, complete backups, stale hashes, concurrent
editing, idempotence and CLI restrictions. The existing research-migration and
security tests also run. Tests never write live Redis. Frontend validation of
Experience, Research Experience, Education and CV follows the content write;
data-only updates require no new frontend build.

## Applied Verification Record

The reviewed live update was applied and independently verified on 2026-10-15.
The original complete raw value was 71,284 bytes with SHA-256
`485eec6128ebf4bd4c32ede70f1edde5fbbcd48c2e5fea7a94664621615fa923`.
The resulting value was 73,702 bytes with SHA-256
`028aaf26ea9bd87e41f0e5e03001c0f720cfbb370837c44ead24e7daf7a91e97`,
exactly matching the reviewed candidate. Complete original file and Redis
backups were verified; the research migration ledger remained unchanged.

Public readback returned 17 jobs, 7 education entries and 15 projects. Exact
field-scope comparisons retained every original role ID/category, all existing
skills and ordered media, other education, papers and thesis. The five research
roles stayed in Research Experience. Four preprints and one manuscript in
preparation retained their ordered authors/statuses. Skills now have 677
occurrences and 214 distinct labels: only the 18 approved new-role tags were
added. The repeat preview reported an applied ledger, no changes and no
additions/updates. Public GET and all four approved admin-origin checks passed.

All 106 backend tests and 52 JavaScript syntax checks passed; the dependency
audit reported zero vulnerabilities. Independent frontend verification passed
on desktop (1265 pixels) and mobile (390 pixels), including role/dialog display,
provisional TCD status/grade, Research tabs/thesis, unchanged media and no
horizontal overflow. This was a data-only live update; no new deployment was
required. New tooling/docs/tests were deliberately left uncommitted and
unpushed pending separate user authorization.

The private original, proposed value, dry-run report and receipt are retained
under ignored `private-content/backups/` with prefix
`linkedin-content-2026-10-15-v1-485eec6128eb`. They are not committed or printed.
