# Approved Project Collection Assignments

This separate, owner-approved content update assigns broad collections to the
fifteen existing projects. The additive [collections contract](project-collections.md)
already supports reading/saving labels; it required no persistent migration.
This one-off planner is not an API restriction, automatic classification rule,
GET/startup hook, new endpoint or seed. Ordinary collection names remain
user-defined, and administrators may later rename, clear or remove memberships.

## Scope And Evidence

The approved vocabulary describes whole projects, not personal ownership of
every component or a new scientific finding. CarSurfing's web label does not
attribute its collaborator's frontend to the owner. Its backend contribution
and frontend credit remain exact. Coursework is not inferred to be original ML
research. The Scrum report receives Project Management rather than an unrelated
technical classification. Instrumentation reports retain their supervised and
limited/inconclusive wording; latency remains a manuscript in preparation.
No portfolio narrative, publication claim, LinkedIn metric or profile is edited.

The seven labels are Data Analysis & Statistics (D), Research Methods (R),
Web Development (W), Backend & APIs (B), Scientific Computing (S),
Instrumentation & Control (I), and Project Management (P). These abbreviations
are for this table only; persisted arrays contain the complete labels.

| Existing Stable Project ID | Project | Ordered Labels |
| --- | --- | --- |
| `research-eartharxiv-15189` | PFAS public-record audit | D, R |
| `research-arxiv-2608-27736` | Lead-pipe allocation analysis | D, R |
| `research-arxiv-2609-05584` | Cross-sport playing-time analysis | D, R |
| `research-arxiv-2608-11228` | Football exposure analysis | D, R |
| `project-1930afed6e1b31fc8e95b24e` | Filebox | W, B |
| `project-e5a9d2ac9375ff84851016ad` | CarSurfing | W, B |
| `project-829a53079026e22c418fda42` | My YouTube Bookmarks | W |
| `project-20e3c4c3fa44a48fd5ff553d` | Ireland's Luxury Apartments | W, B |
| `project-739137b5bba481267f708c82` | USA Manslaughter Analysis | D |
| `project-6f2264d4a653de434559ad0d` | Product Owner Role in Scrum | P |
| `project-38981053924e2c7d93a437c8` | LinkedIn Clone | W, B |
| `project-c2307a8588da6647db62d7b3` | Reflectometry report | D, S, I |
| `project-c1f062a755abff4388000db1` | COMPASS report | D, S, I |
| `project-701dc8ee8551735c9de9d27d` | IFIMUP instrumentation report | I |
| `research-zenodo-22044877` | Streaming-latency manuscript | S, R |

There are 28 memberships: D7, R5, W5, B4, S3, I3, P1. The 15 records retain
8 research, 5 software, 1 data and 1 coursework categories. Seven non-research
projects is not the same as seven software-category projects. The frontend may
also display the three explicitly instrumentation-tagged research reports in
Projects without removing them from Research, duplicating payload records,
reclassifying them or changing backend order. That display decision is separate.

## Private Reviewed Plan

Use a fresh complete raw Redis snapshot, not the normalized public response or
tracked seed. The approved source's fifteen raw projects lack the collections
property, whereas public GET already returns empty arrays. These states must
not be conflated. Each patch checks `expected.exists` separately from old labels.

The strict root is `{ version: 1, migrationId, patches }`. Each patch contains:

```js
{
  match: { id: "exact-existing-id", category: "exact-category", name: "exact-existing-name" },
  expected: { exists: false, collections: [] },
  expectedNarrative: { description: "exact existing description", contribution: "exact existing credit" },
  collections: ["full reviewed label"],
  rationale: "private source-grounded review explanation"
}
```

This is an illustrative fragment, not an executable complete plan. The planner
requires all fifteen pinned identities/categories, exact approved label order,
unchanged original identity/narrative and complete raw sections. Duplicate,
missing, foreign, reclassified, stale or ambiguous targets fail. No name-based
discovery or title inference occurs. Full raw and normalized comparisons mask
only `projects[].collections`; every other value and array order must match.
Images/links retain URL, title, description and backup-description associations.

## Preview And Guarded Apply

All commands default to preview. Unknown/duplicate flags, missing values and
conflicting modes fail before file/Redis access. File input cannot apply. Load
backend-only credentials securely; scripts do not implicitly load `.env` files.
Full originals/plans/candidates/receipts stay ignored under `private-content/`
and excluded from Git/deployment inputs. Reports contain safe IDs, field/count
changes, hashes and backup references, not complete copy or private rationale.

```powershell
node scripts/migrate-project-collections.js --input private-content/project-collections-2026-10-16/source.original.json --plan private-content/project-collections-2026-10-16/reviewed-plan.json --dry-run
node scripts/migrate-project-collections.js --plan private-content/project-collections-2026-10-16/reviewed-plan.json --dry-run
```

Independently review the full candidate and both hashes before apply. Publish
checked code and verify actual successful deployment. Immediately before any
write, reread complete raw/public data and save/read back a new byte-identical
original backup. Abort source drift; do not force, silently replan or retry.

```powershell
node scripts/migrate-project-collections.js --plan private-content/project-collections-2026-10-16/reviewed-plan.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-candidate-sha256> --backup-file private-content/project-collections-2026-10-16/source.original.json
```

Both exact hashes, complete original backup and deployment check guard the
existing atomic Lua CAS. It compares source bytes and writes original Redis
backup, candidate and independent ledger together. Ledger identity:
`<portfolio-key>:migrations:project-collections-2026-10-16-v1`. No earlier
skill/photo/narrative ledger is reused/reset. Backup failures or concurrent edits
cannot overwrite data. Inspect raw/ledger after an uncertain response rather
than retrying blindly. A completed-ledger repeat is read-only and preserves
later edits, cleared memberships and deleted records.

Verify exact stored bytes, complete local/Redis originals, ledger and both
uncached/ordinary public GET. Mask only collections; verify scientific wording,
contributions/statuses, all five prior context-photo URLs and full media prefixes,
IDs/category/order, skills, maps, courses, CV and thesis remain exact. An immediate
wrapper repeat must make zero additional CAS calls. Reload frontend memory and
reset stale drafts without saving them. No upload/listing/deletion is needed.
Public wildcard/no-cookie GET and admin cookie/exact-origin CORS/CSRF stay intact.

## Verification And Status

`test/projectCollectionAssignmentsMigration.test.js` covers exact fifteen-target
scope/labels/order, immutable input, absent versus empty/null raw values, source
identity/narrative checks, full raw/public preservation and unrestricted ordinary
API labels. Isolated Redis tests cover default preview, separate ledger, one
atomic apply, exact original backups, both hashes, failed backup/deployment,
concurrent edits, repeat preservation and safe strict offline CLI output.
Existing API/security/media/collections-compatibility tests must pass as well.
Tests never access production Redis. There is no separate package lint/build
script; successful Netlify tests/function bundling/deployment are a separate gate.

The reviewed offline candidate reproduces the approved compact raw SHA-256
`f4ecd59f12f099f2e00473b3ed0f4a1f7bb5ca79e337c07648fe655470999aab`
and public canonical SHA-256
`7bf690160ecfa74267bba0d9195e38f19d2ba1d91620110e40ef9268c99464d3`.
These are update-specific snapshots, not fixed hashes for future admin content.
Actual publication/application receipts and outcomes are recorded only after
their gates succeed; preparing or pushing the planner does not write Redis.

Pre-publication verification on 2026-10-16 passed **316 backend tests**, **93
JavaScript syntax checks**, README contents/documentation links, whitespace and
the full installed dependency tree. A clean install produced no dependency
deprecation or peer warnings. Fresh registry checks of all four exact locked
versions reported no deprecation notices; the unfiltered audit reported zero
known vulnerabilities. No dependency/lockfile, runtime handler, authentication,
CORS, CSRF, upload contract or default data changed. Independent candidate review
confirmed the exact approved bytes and all-field collections-only preservation.
