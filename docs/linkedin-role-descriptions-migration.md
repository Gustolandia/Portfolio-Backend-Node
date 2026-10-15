# Reviewed Existing Role Descriptions

Publication note: the maintenance tools/docs/tests are now included in the
reviewed release. See [the maintenance guide](maintenance-tools.md). The applied
verification below remains a historical record; publishing does not rerun it.

The user explicitly requested updated descriptions for the roles already in
the portfolio. The signed-in [LinkedIn experience profile](https://www.linkedin.com/in/gricou/details/experience/)
was read on 2026-10-15. The reviewed text consists of concise factual paraphrases,
not copied profile markup or unsupported claims about metrics, publications,
conferences or achieved research results.

## Exact Scope

Only `jobs[].duties` for the thirteen original roles changes. The immutable
ID-to-ordered-string-array mapping is `LINKEDIN_ROLE_DUTY_UPDATES` in
`src/content/linkedInRoleDescriptionsMigration.js`. The four recently added
BoscaSports, Invertase, Xerotech and Covalen roles are not targets.

The planner clones the complete raw snapshot and locates rows using their
currently returned stable IDs in source order. It never resorts jobs, persists
the three remaining computed legacy IDs/categories or changes any other field.
Duties are not inputs to legacy identity hashing, so those IDs remain stable.
Titles, dates, categories, companies, locations, skills, media/maps, all pages,
profile, education, projects, ordered authors and thesis stay unchanged. Unknown
raw fields are preserved. The expected source has 17 jobs, 7 education records
and 15 projects with exactly the reviewed job identity set; a missing/ambiguous
target or unexpected scope fails closed.

## Separate Preview And Application

The one-time identity is `linkedin-role-descriptions-2026-10-15-v1`. Neither the
completed research ledger nor `linkedin-content-2026-10-15-v1` is reused,
reset or modified. Existing descriptions are never reseeded by GET/PUT. The
current raw Redis value is the only source, not the older local seed.

```powershell
npm run migrate:role-descriptions -- --dry-run --report private-content/role-descriptions-dry-run.json
npm run migrate:role-descriptions -- --input private-content/backups/original.json --dry-run
```

The CLI is the existing LinkedIn tooling with explicit `--role-descriptions`
mode. File inputs remain preview-only. The report shows only reviewed duty
diffs, counts, the exact original raw SHA-256 and exact candidate SHA-256; it does
not print credentials, full content or contact details. Preserve complete
original/candidate files and reports under ignored `private-content/backups/`.

After independent review of both hashes and the complete original backup:

```powershell
npm run migrate:role-descriptions -- --apply --expected-hash REVIEWED_RAW_SHA256 --expected-candidate-hash REVIEWED_CANDIDATE_SHA256
```

Application requires both hashes. A changed planner/wording is rejected before
backups or Redis writes, even if the raw source has not changed. The shared
complete-file backup, deployment verification and atomic Lua source-CAS guard
then writes the exact original Redis backup, replacement and new ledger
together. Concurrent editing, failed/incomplete backups or stale source hashes
abort without Redis writes. `--backup-file` can use a complete already retained
private original file, checked against the source before application. Repeating
with the applied descriptions ledger is a complete no-op, preserving later
administrator edits/deletions rather than restoring old descriptions.

## Verification And Frontend

Verify exact full backups and resulting raw hash, then compare the complete raw
before/after payload with only those thirteen duty arrays excluded. Everything
else must be identical, including job order and unknown fields. Public GET must
match the normalized saved value, return 17/7/15, keep all existing identities,
five research roles, skills and ordered media, and leave all four new roles and
both previous ledgers untouched. Retain a private receipt. A repeat read-only
preview must report the applied ledger, no updates and `changed: false`.

`test/linkedInRoleDescriptionsMigration.test.js` covers the exact duties-only
scope, normalized/raw preservation, computed identity stability, immutable new
roles, unexpected targets, independent ledger, complete backups, candidate and
source guards, concurrency, no-op repeats and CLI restrictions. Tests are local
and use isolated Redis mocks, never live writes. Existing security and earlier
migration tests continue to run.

No frontend code change or redeployment is needed: public/admin payloads already
contain `duties: string[]`, role detail dialogs/CV render those arrays, and the
admin editor already edits them through the authenticated complete-payload PUT.
Frontend readback/dialog checks follow the approved data-only update. Netlify
endpoints, cookies, exact admin CORS, CSRF and uploads remain unchanged. Tooling,
docs and tests were originally left uncommitted pending separate authorization;
their later publication does not change the data-only nature of that update.

## Applied Verification Record

The duties-only update was applied and independently verified on 2026-10-15.
The complete original raw value was 73,702 bytes with SHA-256
`028aaf26ea9bd87e41f0e5e03001c0f720cfbb370837c44ead24e7daf7a91e97`.
The resulting value was 63,629 bytes with SHA-256
`8fa5d8602d139f6a66dca1d2b0a6151b8877e556689e173e3f0a00a92a2a5662`,
exactly the independently reconstructed reviewed candidate. Complete original
file and Redis backups were verified, and both previous migration ledgers
remained byte-for-byte unchanged.

All thirteen approved arrays matched exactly: 84 old duty bullets became 36
reviewed bullets. The complete raw payload compared identically after excluding
only those arrays. All 17 job IDs/order, four newer roles, every other job field,
unknown raw content, skills, media, pages, profile, 7 education entries, 15
projects, ordered authors and thesis were preserved. All five research roles
retained their placement. Skills remained 677 occurrences/214 distinct labels.
Public readback matched the exact normalized duties-only candidate. Repeat
preview reported an applied ledger, zero updates and `changed: false`.

All 116 backend tests and 54 JavaScript syntax checks passed, with zero audit
vulnerabilities. Public GET and all four approved admin-origin checks passed;
preflight retained CSRF support. Independent frontend verification opened all
13 existing dialogs (5 research and 8 industry/teaching), checked every approved
string and close/Escape behavior, and verified desktop (1280 pixels) and mobile
(390 pixels) without horizontal overflow. Original CEA media and both reviewed
CEA duties worked on mobile; the thesis remained above the Research tabs.
Thirty focused frontend tests in five suites passed. No frontend code change or
deployment was required. At that time, migration tooling/docs/tests were left
uncommitted pending the separate maintenance-publication authorization now given.

The complete original, candidate, field diff and attributed verification
receipt are retained privately under ignored `private-content/backups/` with
prefix `linkedin-role-descriptions-2026-10-15-v1-028aaf26ea9b`.
