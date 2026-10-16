# Website Editorial Review

Reviewed on 2026-10-16 following the owner's approval to coordinate frontend and
backend improvements, preserve the dark theme/GIFs/photos and deploy both.
This is separate from the earlier maintenance/schema publication. The
[editorial metadata contract](editorial-metadata.md) is already additive; no
endpoint, cookie, CORS, CSRF, login-rate-limit or upload contract changes here.

## Confirmed Facts And Scope

- Academic context: MSc Statistics and Data Science, Trinity College Dublin.
  PhD availability starts July 2027, explicitly confirmed by the owner.
- Native grades only: First Class Honours for TUS/ATU; Portuguese BSc
  `15/20; ranked third of 50`. The earlier GPAs were personal conversions.
- Trinity's 80% is a provisional June 2026 mark, not a final result. Its MSc
  stays in progress with `end: "Present"`, replacing an unexplained October 2027
  endpoint. Thesis start remains 2026-09-25 and submission 2027-04-19; the owner
  expects April defence and May/June results. No conferral date is invented.
- Fusion-EP is one programme with two retained institutional periods: Stuttgart
  September 2013-September 2014, Lorraine September 2014-September 2015. All
  taught coursework was completed, but no thesis submitted or degree awarded.
  The shared `programme` label groups the periods without merging them. Existing
  honest academic context moves ahead of sports; every original activity and
  course remains, including duplicate entries.
- TUS CarSurfing, IFIMUP, IJL, CEA and IPP remain real supervised placements.
  Academic credit does not make them classroom-only. Existing CEA/IJL dates and
  their possible overlap are not rewritten. The owner confirmed developing most
  of CarSurfing's backend; the wording does not invent ownership of particular
  authentication, database or deployment services, or claim collaborators' work.
- The thesis remains early-stage. A shared trunk, separate heads, simultaneous
  tasks and matched single-task baselines describe the study design. Transfer
  prediction remains a question, never an established finding.
- Public contact remains `profile.email`, independent of the admin account.
  Contact copy invites PhD opportunities from July 2027 and research collaboration.

## Research And Project Copy

The [earlier academic review](academic-review-migration.md#research-evidence)
records primary-source contribution/report evidence. This pass shortens the
already reviewed descriptions, preserving inferential limits rather than adding
results. Exact paper titles, ordered authors, output types, statuses and dates
are untouched. Four preprints remain not peer reviewed; streaming latency stays
a manuscript in preparation with no completion date. Archive release versions
are not publication status. The older restricted archive, current code and
manuscript URLs remain as complete URL/metadata tuples. The one approved
exception to original ordering is the latency record: `[2,1,0]` presents current
manuscript, code and analysis, then older restricted archive. All four arrays
move together, with reviewed concise labels. No URL is deleted or changed;
every other record keeps its original URL order. Preprint links use concise
repository and reproducibility-material labels.

Selected research ranks are lead-pipe funding 1, football exposure 2, playing-time
allocation 3 and PFAS audit 4. CarSurfing/Filebox are selected software 1/2.
Selected role ranks are TikTok 1, BoscaSports 2, Xerotech 3, Invertase 4. These
are explicit editorial selections, not changes to backend chronological arrays.

Five existing applications are categorized as software; the manslaughter
analysis as data; the Product Owner report as coursework. Supervised physics
reports remain research. No output/publication status is inferred for software.
Filebox and CarSurfing retain their pre-rename computed IDs, now persisted.
Reflectometry/COMPASS/LabVIEW reports link to CEA/IPP/IFIMUP roles respectively;
CarSurfing links to the TUS placement. Existing relationships are retained first.

No current live software demos are claimed. Recorded demonstrations and old
historical links remain available as such, without changing URLs or repository
visibility. An anonymously unavailable repository may be private or unavailable;
the backend does not assert it was deleted or change access permissions.

## Skills And Media

Skill curation selects existing canonical labels only. Core subject/tool tags
lead seven oversized education/software-project lists; any distinct label not
otherwise represented is retained, including uncertain unique expertise. This
reduces repeated tags without inventing new capabilities or deleting the overall
vocabulary. Other records and the shared alias normalizer remain unchanged.

All primary image/file URLs, maps, populated image titles and licensing attribution
are retained; only the approved complete latency-link tuples change indexes.
Blank descriptions and blank/overlong backup
text receive concise existing-caption or record-context alternatives; no people,
rooms or visual details are invented. The CarSurfing landing-page alternative
was confirmed by frontend visual QA and also fills its previously empty primary
caption/title. No populated title may be overwritten. Full original credits remain in titles
and existing descriptions. The frontend can use concise backup text as alt text
and full captions for attribution. GIF URLs are neither rewritten nor reuploaded.

## Planner And Guards

`createWebsiteReviewPlan` proposes reviewed copy against a complete raw snapshot;
it is not approval or an automatic updater. Missing/ambiguous target identities
fail. `planWebsiteReviewMigration` checks every changed old field, a strict
allow-list and explicit evidence. It proves raw scope preservation and validates
the normalized candidate. Activities retain their multiset, skills can only use
existing canonical labels, role links may only append, and changed media text
must have exactly the original primary-array length. Unknown raw metadata is
preserved. Publication states, bylines, maps, primary URLs and courses are outside
the editable scope, except the exact three-link latency tuple permutation with
all four expected/replacement arrays and `linkOrder: [2,1,0]`, plus filling only
previously empty CarSurfing image titles. Legacy renames
automatically pin their pre-edit ID.

Private originals, plans, candidates and receipts remain under ignored
`private-content/website-review-2026-10-16/`. No credentials or full snapshots
are committed. Review the candidate with the frontend before applying it.

Offline preview, no network or writes:

```powershell
node scripts/migrate-website-review.js --input private-content/website-review-2026-10-16/source.original.json --plan private-content/website-review-2026-10-16/plan.final.json --dry-run
```

Live read-only preview with backend-only Redis environment variables loaded:

```powershell
node scripts/migrate-website-review.js --plan private-content/website-review-2026-10-16/plan.final.json --dry-run
```

After separate review, exact hashes, complete original backup and deployed
editorial-schema verification, the explicit live apply is:

```powershell
node scripts/migrate-website-review.js --plan private-content/website-review-2026-10-16/plan.final.json --apply --expected-hash REVIEWED_RAW_SHA256 --expected-candidate-hash REVIEWED_CANDIDATE_SHA256 --backup-file private-content/website-review-2026-10-16/source.original.json --report private-content/website-review-2026-10-16/apply.receipt.json
```

File inputs cannot be applied. Reports contain field paths/evidence, hashes and
backup references rather than portfolio/credential values; report files are
non-overwriting. A byte-identical local original is required. One Lua CAS checks
the live source and independent ledger before atomically saving the complete
Redis original, candidate and ledger. A concurrent edit aborts without writing.
An uncertain outcome must be inspected via the ledger, not blindly retried.
Completed repeats are read-only and never restore later edits or deletions.

Ledger: `<portfolio-key>:migrations:website-review-2026-10-16-v1`. Do not delete it
to replay this historical patch. New factual edits need fresh review/identity.
These modules are not API routes, startup hooks, seeds or build commands.

## Verification

The website tests use synthetic public-shaped records and mocked Redis. They
cover approved selections/copy, retained research metadata, exact media/link
order, full distinct skills, course/activity preservation, legacy rename IDs,
strict field scope, stale/ambiguous operations, backup/hash/deployment failures,
concurrent edits, ledger repeats and private-value-free offline CLI previews.
Existing cookie/CORS/CSRF/rate-limit/upload and skill-alias tests remain included.
No test writes live Redis. Live apply/readback and signed-in browser verification
are separate checks; results will only be recorded after they have passed.

Before live application, all **201 backend tests** and **70 JavaScript syntax
checks** passed. The production dependency audit reported zero known
vulnerabilities. README contents/links and Git whitespace checks also passed.
There is no separate lint/build script; Netlify retains `npm test` as its gate.
The tracked local JSON is a historical development seed, not the current live
snapshot; never use it to replace the edited Redis portfolio.
