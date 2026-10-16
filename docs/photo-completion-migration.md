# Append-Only Context Image Completion

The owner requested an appropriate image for the five previously logo-only
entries. This separately reviewed operation appends one complete media tuple
to four industry jobs and the exact EPICODE 2020 education period. It never
replaces/crops an original logo, reorders media, changes maps or invents a
historic workplace. Frontend enlarged logos, one-line captions and gallery
modals are a separate presentation release, not backend data mutations.

## Fixed Targets And Reviewed Context

| Target | Approved Image | Honest Scope |
| --- | --- | --- |
| BoscaSports | Leopardstown Racecourse, 2009 | General racing-industry context; not a BoscaSports installation or evidence of the owner's attendance |
| Invertase | Official Firebase Genkit Developer UI, pinned 2024 source | Tooling context for a remote role, not the owner's individual changes |
| Xerotech | Battery-electrode winding at Argonne, 2011 | General industry context, not Xerotech premises or the owner's hardware/work |
| Vertu | Signature S handset, 2017 | Historical product context, not an Athens office, a new product or a claim the owner designed it |
| EPICODE | HTML/JavaScript programming photograph, 2016 | Generic programming-study context, not course material, the owner's code, a cohort photograph or in-person attendance |

Job IDs are pinned to the four approved persisted identities and `industry`
category. EPICODE must exactly match `degree`, `institution`, `start`, `end`,
including its existing 2020-04-01 through 2020-10-01 period. No degree/provider
history is rewritten or inferred. All other jobs/education and every project,
scientific figure, reviewed narrative, curated skill, course, status/byline,
map, collection, CV, thesis/profile and original record order stay exact.

The first official BoscaSports, Xerotech press and later EPICODE institutional
photos remained permission-required and were **not uploaded**. The replacement
manifest uses photo-specific reviewed source notices: Sarah777's public-domain
release; the official Genkit Apache-2.0 screenshot; the explicitly marked DOE/
Argonne photograph with Wes Agresta credit; the CC0 Tinh Te handset photograph;
and Martin Vorel's CC BY-SA 4.0 programming image. An official website or national
laboratory association alone never establishes a photograph's reuse rights.

Full credits, context, source links, licences and notices remain in the complete
caption/provenance. Invertase includes the public bundled exact Apache notice at
`https://gustavopedroricou.com/media/genkit-Apache-2.0-LICENSE.txt`; trademarks do
not imply endorsement. Short paired backup descriptions are the independently
approved one-line context labels. The frontend decides how those labels and the
full information panel appear; the backend does not truncate or discard credits.

## Staging And Delivery

Save/read back a fresh complete exact-byte raw Redis original and public response
before each upload batch. Confirm the raw normalized projection matches public
data. Independently review each exact asset/hash, source rights and contextual
caption before staging. Keep all complete source/receipt proofs private.

Use existing `stageImageKitAssets` for only the selected still JPEG/PNG/WebP
originals under `/Portfolio-Website/Photos`, with a real decoder/nonblank check.
The private operator uses bundled Sharp, not a new app dependency. The helper
records a durable intent before its single uniquely named non-overwriting POST,
then verifies exact stored original bytes/dimensions and decoded delivery.
Do not list or delete ImageKit assets. Known successes are verified/reused, not
reposted; an uncertain outcome requires inspection before any further action.

Full source originals remain stored unchanged. The reviewed BoscaSports,
Xerotech and Vertu delivery links use width-only `w-1600` downsizing to reduce
large transfers. These preserve full aspect, subject and watermarks: no crop,
recolour, format override or upscale is allowed. Receipts bind the exact delivery
URL/dimensions/hash; derivative provenance is explicit. Genkit and the CC BY-SA
programming image use `tr=orig-true`, preserving their exact original bytes and
the programming caption's unmodified declaration. Every full-size original stays
available separately; resizing a delivery is never mistaken for source-byte proof.

## Strict Plan

The root has exactly `version: 1`, migration ID
`photo-completion-2026-10-16-v1` and five unique `assets`. Each asset supplies:

```text
id, collection, match, sha256, bytes, width, height, mime
caption, backupDescription, expectedMedia
provenance: { sourcePage, rights, credit, context, scopeNote }
deliveryTransform?: reviewed width-only downsize, e.g. w-1600
```

`expectedMedia` contains every original `imageUrls`, `imageTitles`,
`imageDescriptions`, `imageBackupDescriptions` value/index. Complete raw arrays
must align before append. Every original four-array prefix, including explicit
blank strings/GIF URLs, stays exact; one paired URL/title/description/backup tuple
is appended. Public alias behavior for old blanks stays unchanged. No promotion,
retirement, replacement, caption edit or map update is supported here.

Allowed context kinds are target-specific organisation/industry/tooling/product/
online-learning context, never an inferred workplace or attendance. Nonempty
rights/credit/scope evidence is mandatory, but the pure planner checks structure,
scope and identity, **not factual truth or permission**. Exact owner/parent
source review and candidate confirmation remain separate prerequisites.

The planner requires all five verified staging receipts. Missing/duplicate/
uncertain receipts, wrong folders/hosts, altered originals, animation, malformed
MIME/dimensions, unapproved transformations or duplicate existing canonical URLs
fail. A duplicate/missing/ambiguous record, changed identity/category, stale old
array or unapproved field fails without mutation. No project/global alias/schema/
endpoint/authentication/CORS/CSRF behavior changes.

## Preview And Apply

Store plans, source assets, full snapshots, candidates, safe success IDs/URLs,
provenance and receipts under ignored `private-content/`, outside Git/deployment.
No frontend secret or new env var is needed; load backend Redis variables securely.
The command never uploads and defaults to preview. File input is always offline
preview-only; reports expose only IDs/fields/counts/hashes/backup references.

```powershell
node scripts/migrate-photo-completion.js --input private-content/photo-completion-2026-10-16/source.original.json --plan private-content/photo-completion-2026-10-16/reviewed-plan.json --receipts private-content/photo-completion-2026-10-16/verified-upload-receipts.json --dry-run
node scripts/migrate-photo-completion.js --plan private-content/photo-completion-2026-10-16/reviewed-plan.json --receipts private-content/photo-completion-2026-10-16/verified-upload-receipts.json --dry-run
```

Independently confirm the exact five-source plan/candidate hash and full raw/public
mask proof. Publish checked code and confirm the actual deployment. Verify the
frontend's required public licence notice. Immediately before the separate Redis
save, freshly read complete raw/public data and preserve/read back a new complete
original. Abort on drift; never force an old snapshot or silently replan.

```powershell
node scripts/migrate-photo-completion.js --plan private-content/photo-completion-2026-10-16/reviewed-plan.json --receipts private-content/photo-completion-2026-10-16/verified-upload-receipts.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-candidate-sha256> --backup-file private-content/photo-completion-2026-10-16/source.original.json
```

Both exact hashes, byte-identical complete original backup and deployment check
guard the existing Lua CAS. It atomically writes original Redis backup, candidate
and a new independent ledger `<portfolio-key>:migrations:photo-completion-2026-10-16-v1`.
No historical workplace/scientific/narrative ledger is reused or reset. Failed
backups or concurrent edits cannot overwrite live content. Inspect raw/ledger
after an uncertain result rather than blindly retrying.

Verify exact stored candidate bytes, local/Redis originals, ledger and uncached/
ordinary public response. Compare all raw/public fields except only the four
target jobs/one education record's media arrays, and verify each complete old
prefix independently. Read back selected deliveries and full-size original hashes.
An immediate repeat must make zero extra CAS calls and retain later owner edits,
removed photos and deleted records. Reload frontend memory/reset stale drafts
without another admin save. Browser appearance and backend readback are separate.

## Prepared Status And Tests

Five rights-reviewed originals are staged in two batches with five total POSTs;
the two initial successes were not reposted. Zero held official-photo uploads,
asset deletions or live Redis writes occurred during preparation. The exact
append-only preview, concise backup labels, source/delivery readbacks and complete
prefix/non-media preservation proofs remain private. This describes preparation,
not a claim of live application; publishing code alone never applies the plan.

`test/photoCompletionMigration.test.js` covers all five exact targets, untouched
projects/scientific figures/narrative/skills/maps/CV, original tuple prefixes,
blank raw/public alias behavior, context/identity/type/scope guards, exact staging
receipts, width-only aspect-preserving delivery, forbidden transforms, default
previews, strict/private CLI output, both hashes, complete exact backups, failed
deployment, concurrency and independent-ledger no-op repeats preserving later
edits/deletions. Tests mock Redis/receipts and never upload or write live content.
