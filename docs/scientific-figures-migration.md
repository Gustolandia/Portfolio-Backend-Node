# Original Scientific Figures And Gallery Order

This separately approved media-only operation promotes four real-source PNGs
and one existing Filebox navigation screenshot. It does not generate/redraw
plots, recolour/crop the approved originals, replace/delete assets, list ImageKit,
change an API/schema or modify narrative, scientific claims, skills or status.
Staging uploads and the later Redis save are explicitly separate operations.

## Approved Originals

| Asset / Target | Reviewed Source | Original PNG SHA-256 |
| --- | --- | --- |
| Lead-pipe figure / `research-arxiv-2608-27736` | Figure 1, arXiv:2608.27736v2, PDF page 8 | `9457c0ac4f13519ef4cf7c6ee0141db972c81c77e41848985508e9eede877927` |
| Football figure / `research-arxiv-2608-11228` | Figure 4, arXiv:2608.11228v3, PDF page 23; original caption page 26 | `d20af1a0f472753426457391f258ad0497f254f69336a9bfd40d823f7d906404` |
| Latency measurement model / `research-zenodo-22044877` | Original `measurement_model.png`, source repository commit `721ae959f3fd3b0c190279b02a74abdc17c257a6` | `555a609627a82da42a5731f63adee9c0a4820113d56ea9fe4bf3e98fb36e10c0` |
| CarSurfing architecture / `project-e5a9d2ac9375ff84851016ad` | Exact embedded Figure 4, team report PDF page 3 | `84f68c66a60fe826d23132a42495747481fce6509ae3b06079ab6baa020ba7ad` |

The approved rendered/extracted source artwork was visually reviewed before
upload; none is an invented result. White scientific backgrounds remain intact.
CarSurfing retains its native 944x754 transparent PNG, not the separate white
QA render. The frontend must provide a white artboard before this gallery update
is applied. The image itself is not flattened or recoloured in the backend.

Credits retain all named authors/team members. New captions use the approved
content-first sentence followed by full source credit; fallback descriptions
remain paired. Publication-status phrases are not redundantly added to the new
captions. Existing covers, captions and warnings remain untouched as later gallery
items, including the manuscript's in-preparation/restricted-archive context.
The CarSurfing team report does not establish individual illustration authorship
or prove a currently operating public cloud deployment.

Owner-authorized source artwork is not a claim of a general public reuse licence.
The arXiv distribution licence is not silently treated as Creative Commons.
Full source PDF/vector/render provenance, hashes, source credits and licence
receipts are preserved privately. The latency repository's entire MIT copyright/
permission/disclaimer notice is retained, with the explicit manuscript carve-out;
the manuscript is not declared MIT licensed. The frontend separately publishes
the exact artwork licence notice and provenance link. No private credential or
provider file ID needs to be public for that attribution.

## Staging Safeguards

Before any upload, save/read back a fresh complete raw Redis original and public
response and verify their normalized projection matches. Use the existing
`stageImageKitAssets` helper with only the four approved local files/hashes,
actual image decoder and `/Portfolio-Website/Snippets` destination. No source PDF,
QA preview or licence file is an upload candidate. The private operator workflow
uses bundled Sharp for real decoding/nonblank checks, not a new app dependency.

The existing helper checks every selected source before its first POST, records
a durable per-asset intent, uploads uniquely without overwrite, then verifies
original bytes/dimensions and decoded normal delivery separately. Preserve safe
success receipts/URLs/file IDs privately. An uncertain outcome must be inspected,
not automatically retried. No deletion is part of cleanup. Known success resumes
at verification only; never blindly repost a file.

Each saved CDN link explicitly uses `?tr=orig-true`. Normal delivery may optimize
PNG bytes (observed for CarSurfing), so its hash need not be the source hash.
The selected original URLs are independently fetched and must match the exact
approved hashes, dimensions and transparency. There is no delivery crop, format
conversion, recolouring or generated replacement.

## Exact Tuple Plan

The pure `planScientificFiguresMigration` accepts a strict version-1 plan with
independent ID `scientific-figures-2026-10-16-v1`, exactly four `assets` and the
explicit `filebox` operation. Each asset includes the pinned source identity/hash,
positive bytes/width/height, exact project `match: {id, category, name}`, approved
caption/backup description and complete `expectedMedia` arrays. Existing guarded
staging receipts are required for every source; QA hashes, unapproved folders,
duplicate/missing receipts, stale identities/arrays and altered originals fail.

All four media arrays are indivisible tuples:

```text
imageUrls[index] <-> imageTitles[index] <-> imageDescriptions[index] <-> imageBackupDescriptions[index]
```

Each new figure tuple is appended and then promoted first, yielding `[new, ...old]`.
Every old complete tuple stays an exact suffix, including explicit blank strings,
original GIF URLs and cover/status captions. Public alias normalization of old
blanks stays the same without shifting associations. Filebox has no upload:
the independently confirmed `File Navigation UI` at old index 2 moves first by
the exact four-array permutation `[2,0,1,3,4]`; all five original tuples remain.

Every other raw/public value stays exact: all jobs/education and other media,
the newly polished narrative, curated skills, courses, IDs/categories/record order,
dates/status/bylines/authors/collaborators, maps, collections, CV and thesis/profile.
Full raw/public comparisons mask only the five target projects' four media arrays.

## Preview, Confirm And Apply

Keep raw/public backups, full plan/candidates, stage receipts and provenance under
ignored `private-content/`, excluded from Git/deployment. File input is preview-only.
CLI reports only IDs/fields/hashes/counts/backup references, not complete content,
captions, provider success IDs, provenance or credentials. No new env var is needed;
load backend-only Redis variables securely, never frontend-provided credentials.

```powershell
node scripts/migrate-scientific-figures.js --input private-content/scientific-figures-2026-10-16/source.original.json --plan private-content/scientific-figures-2026-10-16/reviewed-plan.json --receipts private-content/scientific-figures-2026-10-16/verified-upload-receipts.json --dry-run
node scripts/migrate-scientific-figures.js --plan private-content/scientific-figures-2026-10-16/reviewed-plan.json --receipts private-content/scientific-figures-2026-10-16/verified-upload-receipts.json --dry-run
```

Independently confirm exact candidate/hash, captions and full scope proof. Publish
checked maintenance code and verify the actual frontend white-artboard release
is ready **before** the Redis save. Freshly reread the complete raw/public source
immediately before apply; abort if it differs. Do not overwrite concurrent edits,
reuse pre-narrative snapshots or reset any older media/content ledger.

```powershell
node scripts/migrate-scientific-figures.js --plan private-content/scientific-figures-2026-10-16/reviewed-plan.json --receipts private-content/scientific-figures-2026-10-16/verified-upload-receipts.json --apply --expected-hash <raw-source-sha256> --expected-candidate-hash <compact-candidate-sha256> --backup-file private-content/scientific-figures-2026-10-16/source.original.json
```

Both hashes, byte-identical complete original backup and deployment callback guard
the existing Lua CAS. It atomically writes exact original Redis backup/candidate/
independent ledger `<portfolio-key>:migrations:scientific-figures-2026-10-16-v1`.
Failed backups, stale candidates or concurrent changes cannot overwrite content.
Inspect raw/ledger after uncertain outcomes; do not blindly retry writes.

Verify exact stored bytes, both original backups, ledger, original image hashes,
uncached and ordinary public response, and complete raw/public field-scope equality.
An immediate ledger repeat must make zero extra CAS calls and retain later edits/
deletions. Reload frontend memory/reset stale drafts without another admin save.
Browser appearance, original image-byte proof and Redis readback are distinct checks.

## Verified Application

The four sources, complete captions/credits, exact candidate and Filebox tuple
permutation were independently reviewed and confirmed. A fresh complete raw/public
backup was saved/read back before any upload. The existing guarded staging helper
made exactly four non-overwriting original PNG uploads, zero QA uploads and zero
deletions. Original-byte CDN readbacks matched all four approved hashes/dimensions;
actual decoding/nonblank checks passed. The selected `tr=orig-true` URLs were fetched
again and matched every original byte before and after the separate Redis save.

All **289 backend tests**, **87 JavaScript syntax checks**, documentation links/
README contents, dependency-tree and whitespace checks passed. A clean install
produced no dependency deprecation warnings; the full audit reported zero known
vulnerabilities. Maintenance commit `0b2fdfe` was published ready on 2026-10-16.
No app dependency, upload helper, runtime API or auth/CORS/CSRF/schema changed.

Redis application waited for the frontend white-artboard release. The actual
published frontend was confirmed ready and a descendant of the approved release;
current public HTML/CSS was structurally parsed to verify a white, contained
`.project-media img` display. The publicly served full latency artwork licence
notice matched the exact original licence bytes. Thus the native transparent
CarSurfing PNG was not promoted onto the old dark image background.

Immediately before applying, fresh full raw/public reads still matched the exact
confirmed post-narrative source. A new complete original backup was saved and
read back byte-for-byte. One Lua CAS atomically wrote the exact reviewed candidate,
original Redis backup and independent ledger. Stored bytes, both original backups,
and uncached plus ordinary public responses were verified exactly. Complete
raw/public mask proof changed only five projects' four media arrays: four new
first tuples with every old complete tuple retained as an exact suffix, and the
five-item Filebox permutation. Every non-media field and other media/order stayed
exact, including polished copy, curated skills and manuscript/publication status.
Counts remained 17 jobs, 7 education and 15 projects.

The immediate wrapper repeat returned `applied: false`, `alreadyApplied: true`,
`changed: false`, made zero extra CAS calls, and preserved raw bytes/ledger.
Private complete originals/candidates/plans, provenance/full licence/source PDFs,
safe success file IDs/URLs, upload intents/receipts, CAS intent, Redis backup/
ledger readbacks and application/no-op receipts remain under ignored
`private-content/scientific-figures-2026-10-16/`, outside Git/deployment inputs.
No ImageKit listing, deletion, repeated upload, unnecessary admin save or old
migration replay occurred. Browser appearance and backend readback remain
independent evidence; the frontend owns its final visual/interaction checks.

These release-specific hashes must not be assumed current for a later update.
Raw hashes cover exact Redis UTF-8 bytes; canonical public hashes recursively
sort object keys while preserving every array order.

| Snapshot | SHA-256 |
| --- | --- |
| Original post-narrative raw Redis | `2680f73eea3c5266855c337e742eed56cc6ff31c97a97ad3f81d3da83597d0a8` |
| Stored approved media candidate | `77a462a0b7a463096f8910d714b061146a51e46af12dec6a16681a96ebb16958` |
| Original canonical public | `5aacde32c80d00fb371d37fb724a2206210b7b4d0b31731819861b484cad9a9e` |
| Verified canonical public | `d2365a018fc5973d65b17724d8d178c4e90f5e314ea094eb0c53b136f602b972` |

## Tests

`test/scientificFiguresMigration.test.js` covers exact originals/receipts/folders,
old tuple suffixes, Filebox permutation, raw blanks/public aliases, optimized
normal versus original delivery, protected narrative/skills/status/media/GIFs,
identity/alignment/scope rejection, default previews, strict/private CLI output,
both hashes, exact backups, failed deployment, concurrency and independent-ledger
repeats. Tests use isolated Redis/receipt fixtures and never upload or write live.
