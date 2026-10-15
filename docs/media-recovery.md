# Reviewed Media Recovery

Publication note: the reviewed maintenance release now includes these tools,
docs and tests, with no upload or migration replay. See [the maintenance guide](maintenance-tools.md)
for current safety checks; rollout counts below describe the historical update.

## Boundaries

This maintenance workflow stages explicitly selected assets, then prepares a
separately reviewed, media-only Redis candidate. It adds no API endpoint and
does not list or browse the ImageKit library. Existing admin cookie, CORS, CSRF
and direct-browser-upload contracts remain unchanged. Public GET still returns
only portfolio content, without authentication or cookies.

Upload approval and Redis application approval are separate. Do not seed the
local default JSON over an edited live portfolio. Never overwrite, rename or
delete existing ImageKit files, including assets under `/Portfolio Website`.

## Configuration

Use the backend's existing server-only `IMAGEKIT_PRIVATE_KEY`, public
`IMAGEKIT_PUBLIC_KEY` and `IMAGEKIT_URL_ENDPOINT`. New uploads use:

```dotenv
IMAGEKIT_MEDIA_FOLDER=/Portfolio-Website
IMAGEKIT_FILES_FOLDER=/Portfolio-Website
IMAGEKIT_PHOTOS_FOLDER=/Portfolio-Website/Photos
IMAGEKIT_SNIPPETS_FOLDER=/Portfolio-Website/Snippets
```

ImageKit upload folder names allow letters, digits, slashes, underscores and
hyphens, not spaces. This is a new sibling destination, not a move of old files.
Historical CDN URLs containing encoded spaces remain valid and unchanged.
Runtime defaults were not changed by this maintenance workflow; explicitly set
all four approved folder variables. Netlify requires a successful new deployment
to activate configuration changes in Functions. Never deploy a dirty checkout
or include `private-content/` in a deploy or commit.

Sources: [ImageKit upload folder contract](https://github.com/imagekit-developer/imagekit-nodejs/blob/main/src/resources/files/files.ts),
[Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/).

## Asset Staging

`stageImageKitAssets` in `src/media/stageImageKitAssets.js` accepts a reviewed
manifest, approved local source root, ignored receipt directory, server-only
configuration and an injected image decoder. It is a maintenance library, not
a public upload proxy. The isolated test suite uses only mock HTTP and decoders.

Every manifest entry pins an asset ID, local file, MIME type, byte size, SHA-256,
dimensions, destination, paired caption/backup description, provenance and exact
portfolio operations. Source and rights records remain in the private manifest;
required visible attribution belongs in the approved caption. Empty legacy
captions remain empty when explicitly approved; no description is invented.

Before its first POST the uploader checks all paths stay inside the approved
source root, all source hashes/sizes/formats/dimensions match, and selected SVGs
contain no supported-pattern active/external content. SVG inspection is an
additional guard for already reviewed local sources, not a general sanitizer for
arbitrary untrusted SVG uploads. The injected decoder must actually decode image
bytes and report nonblank pixels, format, dimensions and frame count.

Uploads are sequential, public, uniquely named with source hash plus UUID and
`overwriteFile=false`. A durable intent precedes each POST. Successful provider
metadata is persisted before delivery verification. A known successful receipt
resumes at verification; an uncertain or rejected upload stops for inspection
without automatically sending another POST. Existing verified BoscaSports is
reused, never uploaded again. HTTP rejection, rate limiting or an uncertain
network outcome must be reviewed before an explicitly approved retry.

Verify two distinct URLs:

- Original: add `tr=orig-true`; bytes must match the source SHA-256 exactly.
- Delivery: check HTTP 200, image type, decoding and nonblank pixels. Normal CDN
  optimization may change bytes. Use only the manifest's reviewed light-backing
  transformations for dark logos. Multi-frame originals use `orig-true` delivery
  to preserve every GIF frame. Browser review remains a separate required check.

Receipts contain only allow-listed primitive provider metadata, original
verification and delivery verification, never private keys, authorization headers
or unrelated debug objects, including reused and resumed receipts. Decoder
metadata cannot override computed byte hashes, response status or size. A decoded
frame count must be a positive integer before upload. The source bytes and
provenance stay under Git-ignored `private-content/`. Keep receipts and backups
until the new URLs have been independently reviewed and live editing is checked.

Source: [ImageKit original delivery](https://imagekit.io/docs/core-delivery-features).

## Media-Only Preview

`planMediaRecoveryMigration(rawPortfolio, manifest, receipts)` is pure. Inputs
are the full raw Redis JSON, version-2 manifest and verified staging receipts.
Use `Redis({ automaticDeserialization: false })` when reading the real key.
Do not use a normalized public response as the raw backup or CAS source hash.
Verify the normalized raw read equals the live public endpoint before proceeding.

Allowed edits:

- Jobs/projects: exactly `imageUrls`, `imageTitles`, `imageDescriptions` and
  `imageBackupDescriptions`, matched by stable normalized ID.
- Education: the same four arrays, matched uniquely by all of degree,
  institution, start and end.
- Profile: explicit `portraitUrl` only.
- Pages: explicit `imageUrl` on an existing fixed page only, if separately in
  the approved manifest. Page titles/descriptions remain unchanged.

Each array index is an indivisible URL/title/description/backup tuple. Check all
expected original arrays and indexes before making changes. Replacements use
original indexes, then complete retired tuples are removed, then new tuples are
appended in manifest order. Never sort metadata arrays independently. Untouched
and archived tuples preserve every existing raw string, including explicit empty
titles/captions. Missing legacy metadata uses the existing normalizer's padding
and compatibility aliases. Surplus metadata without a URL is rejected for review.
Animation frame verification also applies to explicit delivery transformations.

Retirements archive the complete original tuple and reason in the report; they
do not delete an ImageKit asset. Existing ImageKit URLs cannot be replaced or
retired by this workflow. Unknown raw fields, dates, entry order, computed and
persisted IDs, categories, authors, skills, duties, output/publication statuses,
relationships, thesis content and contact data are preserved. An exact raw-field
scope comparison and normalized identity/contract validation precede the result.

Save the exact raw original, exact candidate JSON and report outside Git. Record
source, candidate, selected-manifest and verified-batch SHA-256 values. Have a
second reviewer independently reconstruct the approved operations and compare
the full candidate, not only counts. Preview never writes Redis.

## Guarded Application

`migrateMediaRecoveryRedis` defaults to dry run. Do not call with `dryRun:false`
without separate application approval for the exact reviewed hashes. Apply
requires both `expectedHash` (exact raw source) and `expectedCandidateHash`, a
complete private file backup and a deployment verification callback.

The shared content migration re-reads raw Redis, checks the candidate and source
hashes, verifies deployment/backup, then atomically compares the source and writes
the Redis backup, candidate and distinct ledger with Lua. A concurrent admin save
aborts without overwriting it. The ledger is
`<portfolio-key>:migrations:media-recovery-2026-10-15-v1`; earlier migration ledgers
are untouched. Once applied, repeats do not restore deleted images or later edits.

After application, compare fresh raw storage and the unauthenticated public GET
with the reviewed candidate. Recheck unchanged cookie/exact-origin admin CORS,
protected upload auth and CSRF behavior. The frontend should reload content and
inspect all affected images at desktop/mobile sizes. A Redis content update does
not require a code deployment; activating new Netlify function environment values
does. Rollback must be a separately reviewed restore of the complete backup after
checking for later administrator edits, never a blind overwrite.

## Tests And Deployment Gate

Run `npm test`. Focused suites are `test/stageImageKitAssets.test.js` and
`test/mediaRecoveryMigration.test.js`; neither accesses live Redis/ImageKit.
They cover source and receipt validation, no-overwrite/resume safety, credential
omission, animation, exact field scope, media pairing, explicit empties, stale
indexes, protected URLs, identity/academic preservation, backup/CAS and ledgers.

ImageKit unit fixtures explicitly supply all folder inputs, so deployment
environment values cannot leak into a fixture with a different explicit root.
The ambient-environment regression restores all modified variables. Deployment
tests must still run with the real configured folder variables; do not skip tests
or change the build command to force a deployment. Keep any reviewed fixture-only
deployment fix separate from uncommitted migration tools and private artifacts.

## 2026-10-15 Preview

The reviewed selection has 53 assets (52 new uploads plus the reused BoscaSports
upload), 55 explicit operations and six archived retirements. All original SHA-256
checks and delivery decodes passed; the IFIMUP GIF retains all 65 frames. Counts
remain 17 jobs, seven education entries and 15 projects. This is a staging/preview
record, not evidence that Redis application or configuration deployment completed.
Private preview/receipt files contain the exact current review hashes and state.

## Reviewed Application And Configuration Deployment

On 2026-10-15, after independent complete-candidate comparison and all 136 local
tests passed, the approved media update was applied atomically. Exact raw hashes:

```text
source:    8fa5d8602d139f6a66dca1d2b0a6151b8877e556689e173e3f0a00a92a2a5662
candidate: 79e0ca1e86f892e4b5975616e7f7f86b0784b2ff3eae4d4e176ade7f6fafada4
```

Full local and Redis original backups, raw readback, normalized public GET,
separate ledger and a read-only repeat no-op were verified. All 39 rich records
have imagery; all 38 existing working ImageKit URLs remain. Public GET returned
200 with wildcard CORS and no cookies. Unauthenticated admin session checks
returned 401 with exact-origin credentialed CORS for all four allowed origins;
PUT preflight returned 204 and allowed the CSRF header without setting cookies.
Upload authentication remains session-protected. The private
`preview-8fa5d8602d13.apply-receipt.json` records exact backup/ledger references.

The first configuration-only deployment failed because three unit fixtures
inherited ambient folder options; production remained on the previous release.
A reviewed test-only fix was independently verified on clean Git main (97 tests)
and pushed as `22dff70c3b226e6373114a149c2d1a87fa266b59`. It changes only
`test/imageKitMediaService.test.js`, not runtime behavior or the build command.
Netlify deployment `6ad03d11dec1a523ec867bc1` is ready and published with the
new configuration. All other uncommitted maintenance/media tooling and private
artifacts were excluded from that historical release. This later maintenance
publication still excludes every private artifact. The completed configuration receipt and cloud test
evidence are in the ignored upload receipt directory.

Final browser review is separate from these backend checks. Existing browser
memory and the public endpoint's unchanged 60-second cache can require a fresh
reload. A signed-in admin browser upload remains an additional end-to-end check;
do not mint a production session or expose secrets to automate that check.

Final backend verification for this rollout passed 140 tests, including 23 focused
staging/media tests, 58 JavaScript syntax checks, dependency audit (zero
vulnerabilities) and whitespace checks. A scan found no actual server credentials
in tracked/non-ignored files or the public response. Research remains four
preprints and one manuscript in preparation; skills remain 214 distinct labels
across 677 occurrences. The normalized public payload has 91 unique owned
ImageKit URLs and aligned image metadata arrays throughout.
