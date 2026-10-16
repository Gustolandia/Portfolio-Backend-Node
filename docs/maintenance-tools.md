# Portfolio Maintenance Tools

These libraries and commands are separate from the public/admin APIs. None is
called by a function handler, startup, `npm test` or the Netlify build. Committing
and deploying them does **not** upload assets, seed Redis or replay old content.
Public GET, cookie sessions, exact-origin admin CORS, CSRF and the browser upload
contract are unchanged.

## Tool Index

| Tool | Entry Point | Independent Ledger / Guide |
| --- | --- | --- |
| Research additions and skills | `npm run migrate:content` | `research-content-2026-10-15-v1`; [guide](research-content-migration.md) |
| Historical LinkedIn role corrections/additions | `npm run migrate:linkedin` | `linkedin-content-2026-10-15-v1`; [guide](linkedin-content-migration.md) |
| Original-role duties only | `npm run migrate:role-descriptions` | `linkedin-role-descriptions-2026-10-15-v1`; [guide](linkedin-role-descriptions-migration.md) |
| Selected source-image staging | Import `stageImageKitAssets` from `src/media/stageImageKitAssets.js` | Durable per-asset upload receipts; [guide](media-recovery.md) |
| Media-only recovery candidate | Import `planMediaRecoveryMigration` / `migrateMediaRecoveryRedis` | `media-recovery-2026-10-15-v1`; [guide](media-recovery.md) |
| Workplace maps and appended photo tuples | Import `planWorkplaceContentMigration` / `migrateWorkplaceContentRedis` | `workplace-photos-2026-10-15-v1`; [guide](workplace-content-migration.md) |
| Academic facts and research summaries | `node scripts/migrate-academic-review.js` | `academic-review-2026-10-15-v1`; [guide](academic-review-migration.md) |
| Website editorial copy and selections | `node scripts/migrate-website-review.js` | `website-review-2026-10-16-v1`; [guide](website-review-migration.md) |

The general Redis payload-contract tool remains `npm run migrate:redis`; see
the README before using it. It is not a replacement for a scoped content plan.
Media/workplace tools intentionally have no public endpoint or generic upload
command that silently discovers files. A caller must supply the selected local
manifest, source root, actual image decoder and independently reviewed receipts.
All content ledgers are stored separately as `<portfolio-key>:migrations:<id>`.

## Preview First

All content wrappers default to read-only. The shared runner rejects non-boolean
`dryRun`, including `null`, `0` and `"false"`, before accessing Redis. Only the
boolean `false` enters the apply path; it is not sufficient without the other
review/backup checks. CLI file inputs are preview-only and never overwrite live
content. Normal local `.env` files are not implicitly loaded by maintenance
scripts: load backend-only environment variables securely when reading live Redis.

Offline examples using a **complete private raw** snapshot:

```powershell
npm run migrate:linkedin -- --input private-content/backups/original.json --dry-run
npm run migrate:role-descriptions -- --input private-content/backups/original.json --dry-run
node scripts/migrate-academic-review.js --input private-content/backups/original.json --plan private-content/academic-review-2026-10-15/plan.json --dry-run
```

These historical planners have strict source identities/scopes. A source from
after an update may deliberately fail a file-only preview. Live previews check
the independent ledger and become no-ops after application; a file snapshot
does not carry the Redis ledger. Do not reset a ledger, loosen identity checks,
or recreate a deleted role to force an old patch through. New edits require a
fresh reviewed plan and migration identity.

## Apply Requirements

Only run an apply after separate human approval of that actual content change.
Approval to publish maintenance code is not approval to upload or write data.
Read the complete raw Redis value with automatic deserialization disabled; the
normalized public endpoint is useful for comparison, not a complete raw backup.

Review the exact source SHA-256, full field diff and complete local original
backup. Media/workplace/role-description/academic-review applies also enforce
the exact reviewed candidate SHA-256. Research/LinkedIn prepared backups accept
semantically identical JSON formatting for compatibility; the media, workplace
and academic-review wrappers require byte-identical prepared backups. Every
Redis original backup preserves exact source bytes regardless of local formatting.

The common runner verifies deployment/backup, then one Lua CAS compares the
original value and atomically writes the Redis backup, candidate and independent
ledger. Concurrent admin edits abort without overwriting them. A failed backup
aborts before Redis writes. A completed ledger makes repeats read-only and
prevents later deletions/edits from being restored. Inspect the ledger after an
uncertain network outcome instead of retrying blindly.

After an authorized apply, retain private receipts and verify exact raw readback,
complete local/Redis backups, ledger, normalized public GET and a read-only no-op
repeat. Check IDs, categories, ordered authors, relationships and skill arrays.
Never replace an edited portfolio with the older tracked local seed.

## Media Safeguards

Source hashes, decoded formats/dimensions and positive integer frame counts are
checked before uploading. SVG pattern checks are an additional guard for already
reviewed sources, not a sanitizer for arbitrary untrusted SVG. No image decoder
is bundled; callers must supply one that genuinely decodes pixels.

Uploads are uniquely named, non-overwriting and sequential, with a durable intent
before each POST. Known successful uploads resume at verification. Rejected or
uncertain uploads require manual review and are never automatically posted again.
Stored and delivered images are verified separately. Only primitive allow-listed
provider/decoder fields reach receipts, including reused/resumed receipts; debug
objects cannot override computed byte hashes/status or carry credentials along.

URL/title/description/backup arrays are indivisible ordered tuples. Existing raw
strings, including explicit empty titles/captions, are preserved at their original
indexes. Missing legacy text uses existing normalizer padding/aliases; surplus
metadata without a URL is rejected for review. GIF frame checks apply even when
the manifest requests a delivery transformation. Browser appearance and signed-in
admin upload/save are separate checks, not implied by mocked backend tests.

## Release Checklist

The [dependency security review](dependency-security.md) documents the full-tree
audit command, lockfile safeguards and the boundary between project dependencies
and separately managed build/development tools.

1. Run `npm test`, JavaScript syntax checks, dependency audit and `git diff --check`.
2. Review staged paths/diffs explicitly. Exclude `.env`, local `.env.*`,
   `private-content/`, local source assets, complete backups, upload receipts,
   provider tokens and account/session configuration. `.env.example` contains
   placeholders only. Ignore rules cannot protect a file already tracked in Git.
3. Scan the exact staged tree for credentials. Keep any scanner findings redacted;
   never paste a discovered secret into commit messages, logs or chat.
4. Verify the README contents and local documentation links. Earlier rollout
   sections retain their historical counts/commit IDs and are not current audits.
5. Commit only the reviewed release and push normally. Keep `npm test` as Netlify's
   build gate; maintenance commands must never be the deployment build command.
6. Prefer Git-based deployment from the reviewed repository. For manual deploys,
   inspect a clean publish directory first; Git ignore rules do not establish what
   a hosting upload will contain. Do not deploy this workspace with private data.

No live Redis mutation, ImageKit upload or credential/configuration change is
performed by this maintenance publication. The updated tests use mocks or
temporary files only. See each historical guide for its separately authorized
earlier content application and any remaining browser-verification limits.

## Publication Verification

The later [editorial metadata contract](editorial-metadata.md) adds explicit
academic status/availability, optional selected ranks and education grouping.
Its schema publication does not apply a content migration. Its tests cover
legacy retention and explicit clears while preserving existing chronology,
media associations and security behavior. The counts below describe the
earlier maintenance publication, not the current suite size.

For this maintenance release, the complete backend suite passed **179 tests**,
including all existing API/auth/CORS/CSRF/storage tests and the new maintenance
regressions. All **65 JavaScript files** passed syntax checks. The production
dependency audit reported zero known vulnerabilities; whitespace checks passed.
README contents and local guide links are tested, as are Git's actual exclusion
of dotenv variants/private backups and inclusion of the placeholder example.

The new safety regressions cover ambiguous shared dry-run modes, strict original
LinkedIn scope, offline CLI previews without exposing private source fields,
sanitized reused/resumed receipts, decoder hash/status override attempts, GIF
frame retention with transformations, exact existing metadata empties and surplus
unpaired metadata rejection. No live migration or upload was run for this release.
