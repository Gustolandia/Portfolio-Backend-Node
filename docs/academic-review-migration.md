# Academic Website Review

Reviewed on 2026-10-15. This update uses the existing single public payload and
admin APIs. It adds only the optional string `research.thesisSupervisor`.
Session cookies, CORS, CSRF, rate limiting and ImageKit uploads are unchanged.

## Contract And Compatibility

- `research.thesisSupervisor` defaults to `""` for legacy data and accepts only
  strings on PUT. GET/admin GET/PUT return it. It is public content, not an
  authentication value or an environment fallback.
- Older admin clients omitting this nested field retain the stored supervisor.
  Explicit `thesisSupervisor: ""` clears it. Omitting the entire research object
  retains that object as before; explicit null remains rejected by the handler.
- All existing fixed pages, stable IDs, categories, record ordering, authors,
  relationships, skills and same-index media arrays remain supported. GET does
  not insert content or write Redis. Local defaults do not invent a supervisor.

## Confirmed Content

The owner confirmed the official thesis start **2026-09-25**, submission deadline
**2027-04-19**, and supervisor **Van-Dinh Nguyen**. The existing current MSc is at
Trinity College Dublin; the [official staff profile](https://www.tcd.ie/scss/people/academic-staff/nguyenva/)
confirms the supervisor's name spelling, not the student's supervision agreement.
`thesisEnd` is a submission deadline, not a completed thesis or awarded degree.
Informal work in August is not substituted for the official start. Prediction
remains a research aim; the in-progress status and existing questions are unchanged.

The owner approved public contact `pedrorig@tcd.ie`. It is stored in
`profile.email`, independently of the admin/login email. A click-to-reveal UI
does not make a public API address private or uncrawlable.

Stuttgart and Lorraine are periods of **one Fusion-EP programme**, not two
awarded degrees. The owner completed its taught coursework but did not submit
the thesis. The positive coursework label is accompanied by the explicit detail
"Thesis not submitted; degree not awarded" and `status: "not-completed"`.
Existing institutions, study-period dates, all courses and activities are retained.
Shared programme courses are not represented as separately verified campus
transcripts. Reordered course previews preserve the complete original multiset,
including duplicates, and do not delete sports or student leadership activities.

## Research Evidence

These are concise portfolio paraphrases, not a new paper or a claim of expert
validation. Findings are attributed to the linked work with their stated limits;
no speculative scientific-discovery ranking or unsupported quantitative result
is added. Original findings receive emphasis over generic confirmations/nulls.

| Work | Responsibility / Summary Evidence | Limits |
| --- | --- | --- |
| [Lead-pipe funding v2](https://arxiv.org/html/2608.27736v2) | Explicit author-contributions statement credits Ricou with the study concept, analytical method, software, mechanism derivation and initial manuscript. Owner also confirms lead authorship. | Coauthor validation/industry review is not claimed as Ricou's exclusive work. Preprint, not peer reviewed. |
| [Football exposure v3](https://arxiv.org/html/2608.11228v3) | Explicit contributions include Ricou's data preparation, analysis, software, checks and writing. Owner confirms lead authorship. The summary separates outcome truncation from exposure-dependent minutes. | Retrospective public-record measurement, not causal injury prediction. Preprint. |
| [Playing-time allocation](https://arxiv.org/html/2609.05584v1) | Sole-author cross-sport analysis of rule constraints, withdrawal timing and competition behaviour. | Boundaries/exceptions prevent a claim that a single substitution identity holds without qualification for every sport. Preprint. |
| [PFAS audit](https://eartharxiv.org/repository/view/15189/) | Sole-author registered public-source relationship audit; supports reproducible inspection of documentation handoffs. | A documentation result, not evidence of inaction, treatment effectiveness or health effects. Preprint. |
| [Reflectometry report](https://ik.imagekit.io/Gustolandia/Portfolio%20Website/Reflectometry.pdf?updatedAt=1714593492426) | Named coauthored supervised CEA report; signal analysis corroborated by the original role duties. | The apparatus used a metal plate while Tore Supra was stopped, not a live-plasma experiment. Individual team-task division is unspecified. |
| [COMPASS report](https://ik.imagekit.io/Gustolandia/Portfolio%20Website/reportPragueDisruptions.pdf?updatedAt=1714593495625) | Ricou is the named task participant; Python analysis is supported by the existing role duties. | Density target not reached; saddle-coil asymmetry inconclusive. No inflated mitigation discovery. |
| [LabVIEW report](https://ik.imagekit.io/Gustolandia/Portfolio%20Website/IFIMUP.pdf?updatedAt=1714593469018) | Its front page explicitly distinguishes joint computational work from experimental work by Ricou. | Undergraduate Physics Laboratory III report, not an independent original-research publication. Unquantified efficiency/accuracy gains are not asserted. |
| [Streaming-latency repository](https://github.com/Gustolandia/streaming-latency-sports) and [current manuscript source](https://github.com/Gustolandia/streaming-latency-sports/blob/main/paper.tex) | Living manuscript title/byline are checked directly; existing stable ID retained. | In preparation, no completion date or peer-review/publication claim. Current personal coauthor-task split is not specified; it is left unclaimed. |

The living latency manuscript is titled **Super-Precise Latency: How CPU Threading
Affects High-Precision Latency, and an Industry-Wide Audit**, with ordered byline
**Gustavo Pedro Ricou; Romaric Duvignau**. The older
[Zenodo archive](https://zenodo.org/records/22044877) remains linked at its original
index but is labelled as an older artifact with restricted files. Public code
and current manuscript links are appended as complete URL/title/description/backup
tuples. Archive release numbers and IEEE formatting are not publication status.
The newer archive 22307766 was not independently retrievable during this pass;
it is not silently substituted for the verified older record or described as
open access. No existing image or archived URL is removed or reordered.

## Guarded Migration

`src/content/academicReviewMigration.js` is explicit maintenance tooling, never
called by an endpoint. The plan contains `version: 1`, migration identity
`academic-review-2026-10-15-v1`, and `patches`. Each patch supplies a section,
exact normalized `expected` values, replacements under `values`, and non-empty
`evidence` references. Projects match stable IDs; education matches its original
degree, institution, start and end exactly. The planner preserves unknown raw
metadata and refuses stale fields, ambiguous identities, arbitrary job/media
changes, incomplete link tuples, course deletion or activity removal.

Preview a complete private raw snapshot without credentials or writes:

```powershell
node scripts/migrate-academic-review.js --input private-content/academic-review-2026-10-15/source.original.json --plan private-content/academic-review-2026-10-15/plan.json --dry-run --report private-content/academic-review-2026-10-15/preview.report.json
```

After deploying/verifying the supervisor contract, inspect every field change,
both SHA-256 hashes and the complete byte-exact original backup. With credentials
loaded server-side, explicit live application is:

```powershell
node scripts/migrate-academic-review.js --plan private-content/academic-review-2026-10-15/plan.json --apply --expected-hash REVIEWED_RAW_SHA256 --expected-candidate-hash REVIEWED_CANDIDATE_SHA256 --backup-file private-content/academic-review-2026-10-15/source.original.json --report private-content/academic-review-2026-10-15/apply.receipt.json
```

Live preview without `--input` is also read-only by default. `--input` can never
be applied to Redis. Backup failure, changed bytes, wrong candidate, failed
deployment verification and concurrent admin edits all abort before writes.
One Lua CAS atomically stores the entire raw original backup, the candidate,
and `${PORTFOLIO_REDIS_KEY}:migrations:academic-review-2026-10-15-v1`.
Verify exact raw readback, byte-identical Redis/local backups, ledger, normalized
public response, record/ID/skill/media invariants and a repeated read-only no-op.
Never replace live content with the older local seed.

Private plans, snapshots and receipts stay under ignored `private-content/`;
no credentials, full backups or authentication tokens are committed or logged.
Tests use isolated mocked Redis and do not write production. See README for
the full test/deployment commands and separate frontend release responsibility.

## Verification

The complete local backend suite passed **161 tests**, including existing
cookie/CORS/CSRF, login limits, ImageKit upload and prior migration tests.
All **64 JavaScript files** passed syntax checks; the production dependency
audit reported zero known vulnerabilities. There is no separate lint/build
script. The isolated exact release snapshot passed **108 tests**; it excludes
unrelated uncommitted maintenance tests intentionally preserved in the working
tree. Git whitespace checks passed. Live deployment/application receipts and
post-apply checks are recorded separately below only after they succeed.

## Verified Live Application

The runtime release `3e4a39e60538bcc982361c0306da07697aea90b4` was pushed to
`main` and published by Netlify deployment `6ad12810a40662bdec42124c` before
the data update. No frontend files were changed by this backend release.

The reviewed 15-operation plan was applied once with these exact guards:

- Original raw SHA-256: `49ccf4d343ce86ca10768b3a3f48d3d5278da5e080b769d675861eddfa064cc8`.
- Candidate raw SHA-256: `a9e1fce8ad63a9d28b159f1e0cb147e25edbfb548055a9bc50e84baa24e74260`.
- Redis backup: `portfolio:data:backup:academic-review-2026-10-15-v1:1792092258458-663bc14c-4a89-439f-a20d-2ab989a43400`.
- Ledger: `portfolio:data:migrations:academic-review-2026-10-15-v1`.
- Ignored local originals, plan, candidate, intent and receipts:
  `private-content/academic-review-2026-10-15/`.

Exact raw readback, byte-identical complete local/Redis original backups,
ledger contents, public GET equality with the normalized candidate and a
write-free repeat no-op all passed. Counts remain 17 jobs, 7 education entries
and 15 projects, including 8 research outputs with non-empty contributions,
4 preprints and 1 manuscript in preparation. All 214 distinct skills across
677 occurrences, original image tuples, maps, categories, IDs and relationships
are preserved. Five education course arrays are exact permutations; both
Fusion-EP entries retain all original activities and add the honest explanation.

Public GET returned 200 with wildcard CORS and no cookies. Signed-out session
checks for all four approved admin origins returned 401 with exact origin and
credentials headers. Signed-out admin data GET/PUT, logout and upload-auth
returned 401. Approved PUT preflight returned 204 including the CSRF header;
unapproved preflight returned 403 without an allowed origin. The private
original-backup URL returned 404, and actual configured secret values were
absent from the release snapshot and public response.

The live signed-in browser save/upload roundtrip was not performed; its auth,
CSRF, normalization and storage behavior is covered by isolated tests. Individual
task division in the reflectometry team and current latency coauthorship remains
unclaimed rather than inferred. Subsequent changes require a fresh reviewed
migration identity/plan; never remove this ledger to replay the original patch.
