# Reviewed Portfolio Narrative Polish

This separately approved editorial update makes existing work more legible and
specific without adding unconfirmed results, metrics or qualifications. It is a
maintenance operation, not a new endpoint, schema, authentication/CORS/CSRF rule,
seed, global skill alias or automatic GET/startup behavior. Real paper figures
are a separate review; this operation cannot change media or captions.

## Exact Scope

The reviewed candidate has fourteen operations changing twenty-two fields:

| Section | Allowed Fields / Targets |
| --- | --- |
| `profile` | `headline`, `summary`, `academicStatus` |
| `pages` | `description` only, on the existing home/experience/education/projects/contact pages |
| `research` | `summary`, `thesisSummary`, `thesisQuestions` |
| Four research projects | `description`, `contribution` on the exact PFAS, lead-pipe, football exposure/injury and streaming-latency IDs |
| Three other projects | `description` only on the exact Filebox, CarSurfing and USA Manslaughter Analysis IDs |

Home uses `profile.summary`; changing only `pages.home.description` would not
deliver the approved Home copy. The profile now explicitly connects research
with the already-recorded BoscaSports backend integrations/live-data pipelines.
The MSc remains in progress. Existing two First Class Honours entries support
the education overview; provisional marks are not upgraded to a degree result.

The thesis still compares two tasks learned **simultaneously on the same inputs**
with a shared trunk/separate heads against matched single-task networks.
Predicting transfer is an aim, not an established result. Title, status, methods,
institution, supervisor, dates and availability stay exact. The approved question
revision clarifies comparison against the baseline without adding a new finding.

Copy review retains the lead-pipe within-model/not-field-tested distinction,
PFAS documented-traceability versus inaction/performance/health distinction,
and the observational/noncausal injury caveat. Named coauthor roles match the
existing bylines and previously credited responsibilities. Latency copy says
coauthored without inventing an individual division of responsibilities; its
`in-preparation` status and older-restricted-archive warning remain unchanged.
CarSurfing's frontend credit and majority-backend contribution are preserved.

Every other raw field remains exact: all jobs/education/courses/curated skills,
IDs/names/categories, author order/collaborators, dates/publication states,
relationships/ranks/collections, thesis methods, CV/current residence/portrait,
maps, page images, original GIFs/photos and same-index URLs/titles/descriptions/
backup descriptions. No record is inserted, removed or reordered.

## Plan And Preview

Use a fresh complete raw Redis snapshot with automatic deserialization disabled,
save/read back exact original bytes and retain the public response separately.
Confirm normalization of the raw source matches public data. A previous hash or
the historical local seed must never replace an edited live portfolio.

The strict root has `version: 1`, migration ID
`presentation-review-2026-10-16-v1` and `patches`. Every patch has `collection`,
`expected`, `values`, and nonempty private `evidence` references. Page patches
also require `page`; project patches require exact persisted `match` fields
`id`, `category`, `name`. Unknown fields, unsupported records, duplicate paths,
stale source values/identities and wrong replacement types fail without mutation.
Only `research.thesisQuestions` accepts an array; other replacements are strings.

```powershell
node scripts/migrate-presentation-review.js --input private-content/presentation-review-2026-10-16/source.original.json --plan private-content/presentation-review-2026-10-16/reviewed-plan.json --dry-run
node scripts/migrate-presentation-review.js --plan private-content/presentation-review-2026-10-16/reviewed-plan.json --dry-run
```

File inputs are offline previews only. The second command reads raw Redis and
the independent ledger using securely loaded backend variables. No new variable
is needed. Reports contain fields/IDs/hashes/backup references, not the complete
source, approved copy, evidence narratives or credentials. Keep plans, full
snapshots, candidates and receipts under ignored `private-content/`, excluded
from Git and deployment. The planner enforces scope and preservation, not truth:
source-grounded copy and scientific limitations need independent human/editorial
review before the exact candidate hash is confirmed.

## Apply And Verify

Publishing checked maintenance code does not apply the copy. After independent
confirmation, verify the actual deployed version and freshly reread complete live
raw/public content. Abort if the approved source changed; never silently create
a different candidate or reset/replay an old migration ledger.

```powershell
node scripts/migrate-presentation-review.js --plan private-content/presentation-review-2026-10-16/reviewed-plan.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-raw-candidate-sha256> --backup-file private-content/presentation-review-2026-10-16/source.original.json
```

Both hashes, an exact-byte prepared complete original and deployment verification
are required. Existing Lua CAS atomically compares the original value and writes
its exact Redis backup, candidate and new independent ledger
`<portfolio-key>:migrations:presentation-review-2026-10-16-v1`. Concurrent edits,
failed backups, changed candidates and stale sources cannot overwrite content.
Inspect raw/ledger after uncertain outcomes; never blindly retry a write.

Verify exact candidate bytes, complete local/Redis original backups and ledger.
Compare entire raw/public objects masking only the twenty-two approved fields,
including original order and media associations. Check uncached and ordinary GET.
An immediate ledger-aware repeat must make zero extra CAS calls/writes and retain
later edits/deletions. Refresh frontend memory/reset stale drafts without an
unnecessary admin save. No ImageKit upload, caption edit or deletion is included.

## Verified Application

The exact fourteen-operation/twenty-two-field candidate and full preservation
proof were independently confirmed before applying. Maintenance commit `55b7a08`
was published ready on 2026-10-16. All **275 backend tests**, **84 JavaScript
syntax checks**, README contents/local documentation links and whitespace checks
passed. A clean install produced no dependency deprecation warnings; the full
audit reported zero known vulnerabilities and the installed tree was valid.

Fresh complete raw/public reads immediately before application still matched
the reviewed source. A newly saved complete original was read back exactly before
one Lua CAS atomically wrote the confirmed candidate, exact original Redis backup
and independent ledger. Stored bytes matched the approved compact candidate;
both local and Redis original backups matched every source byte. An immediate
wrapper repeat returned `applied: false`, `alreadyApplied: true`, `changed: false`,
made zero additional CAS calls and preserved raw bytes and the ledger exactly.

Uncached and ordinary public GET returned the exact normalized candidate. Full
raw/public comparisons masked only the twenty-two approved narrative fields;
all jobs/education/courses/curated skills, statuses/bylines, maps, ordering,
collections, CV, thesis methods/availability and every media URL/caption/backup
were unchanged. Counts remained 17 jobs, 7 education and 15 projects. Scientific
caveats and credits were checked against the existing source. No ImageKit action,
media edit, admin save, old-ledger replay or runtime API/security change occurred.

Complete private plans, full snapshots/candidates, preapply original, CAS intent,
original Redis backup readback, ledger and apply/no-op receipts remain under
ignored `private-content/presentation-review-2026-10-16/`, excluded from Git and
deployment. These release-specific hashes are not assumptions for future figure
or copy updates. Raw hashes cover exact UTF-8 Redis bytes; canonical public hashes
recursively sort object keys while preserving all array order.

| Snapshot | SHA-256 |
| --- | --- |
| Original raw Redis | `7b1884d6a9460fc1f1bf4a4cbbcf14df2328e226a298500cd108e8ddc61e568e` |
| Stored approved narrative candidate | `2680f73eea3c5266855c337e742eed56cc6ff31c97a97ad3f81d3da83597d0a8` |
| Original canonical public | `9b0754fa3426b3350e45543706d200e18d1846a0421cde659cd4d42c53b55c17` |
| Verified canonical public | `5aacde32c80d00fb371d37fb724a2206210b7b4d0b31731819861b484cad9a9e` |

## Tests

`test/presentationReviewMigration.test.js` covers raw/public field-scope equality,
source immutability, scientific wording/credit/status/ordered media preservation,
protected jobs/education/skills/CV/methods, strict identity/type/old-value guards,
private CLI output, default preview, source/candidate hashes, exact backups,
failed deployment, concurrent CAS and independent-ledger repeats preserving later
edits/deletions. Redis uses isolated mocks; tests never write live content.
