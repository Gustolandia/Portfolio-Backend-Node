# Research Content And Skills Migration

Audited on 2026-10-15. This is an explicit content change, not automatic API seeding. The public/admin endpoints, session cookies, exact-origin admin CORS, CSRF and ImageKit upload contract are unchanged.

## Contract

Projects add `authors: string[]`, default `[]`. This is the ordered paper byline. `collaborators` retains its existing meaning and is never used to infer authors. GET/PUT preserve order; a supplied non-string-array byline returns 400. During rollout, a PUT omitting an existing byline retains it by stable project ID. If bylines exist and an omitted-author project cannot be matched by ID, PUT returns 400 before writing. Explicit `authors: []` clears a byline. Reloading the updated admin editor supplies the complete fields.

Paper placement is explicit `category: "research"`. Four records use `outputType: "preprint"`, `status: "preprint"`; the streaming work uses `outputType: "manuscript"`, `status: "in-preparation"`. No grouping field or new endpoint is needed. Existing physics reports, narrative duties/courses, authors/contributors, affiliations, asset URLs, descriptions/fallback text and relationships are retained.

The existing `dateOfCompletion` string holds the most recent public revision/update date for these preprints. It is a sorting date, not a claim of journal publication, peer review or degree completion. The streaming manuscript date is empty because no manuscript completion date is established. Its software artifact release date is not reused as manuscript completion.

## Primary Metadata Audit

| Stable ID | Ordered Authors | First Submission/Deposit | Current Revision/Update Used |
| --- | --- | --- | --- |
| `research-arxiv-2609-05584` | Gustavo Pedro Ricou | 2026-09-04 | 2026-09-04, v1 |
| `research-arxiv-2608-11228` | Gustavo Pedro Ricou; Nicholas Mahony | 2026-07-29 | 2026-08-22, v3 |
| `research-arxiv-2608-27736` | Gustavo Pedro Ricou; Kristin C. Epstein | 2026-08-27 | 2026-09-06, v2 |
| `research-eartharxiv-15189` | Gustavo Pedro Ricou | 2026-09-24 | 2026-09-25, repository update |
| `research-zenodo-22044877` | Gustavo Pedro Ricou | Artifact reference only | Manuscript completion unspecified |

The titles/bylines/date histories were checked against the primary records:

- [Playing-time allocation, arXiv 2609.05584](https://arxiv.org/abs/2609.05584): the current record identifies a sole author and one submission. The portfolio describes methods/questions and labels the work a preprint; it makes no peer-review claim.
- [Football exposure, arXiv 2608.11228](https://arxiv.org/abs/2608.11228): v3 is the current fifteen-league title. [v1](https://arxiv.org/abs/2608.11228v1) and [v2](https://arxiv.org/abs/2608.11228v2) have different titles but the same paper identity. They are not extra papers. The page explicitly states the analysis is observational and not peer reviewed. No Experimental Design skill is added to this retrospective observational record.
- [Lead-pipe allocation, arXiv 2608.27736](https://arxiv.org/abs/2608.27736): v2 corrects the audit-cost abstract figure from 1.36% to 1.23%, and corrects a supplement equation. The portfolio intentionally avoids numerical result claims. The primary page supplies the [related data/code DOI](https://doi.org/10.5281/zenodo.22552146); it is an ancillary link, not an additional paper.
- [PFAS audit, EarthArXiv 15189](https://eartharxiv.org/repository/view/15189/): the primary indexed record supplies the title, sole-author byline, 2026-09-24 deposit and 2026-09-25 update, and explicitly says preprint/not peer reviewed. Direct retrieval hit a JavaScript challenge; the primary-domain indexed page was readable. The [preprint DOI](https://doi.org/10.31223/X58510) and [materials DOI](https://doi.org/10.5281/zenodo.22948936) are supplied by that record. The summary describes an audit of documentation, not state inaction, programme performance or health effects.
- [Streaming-latency artifact, Zenodo 22044877](https://zenodo.org/records/22044877): the record is Software, restricted, with artifact version 2.5.0 and a newer-version link. These artifact releases are not manuscript publication status. The human confirmed the manuscript is still finishing its first version; that governs `manuscript`/`in-preparation`. The source documents manipulations of timestamping/scheduling and a measurement harness, supporting the Experimental Design tag for this work. No affiliation is inferred for the portfolio entry.

Ancillary DOI destinations that could not be fetched were retained only where the primary paper explicitly cited them; their files and version metadata were not independently audited. All descriptions are original concise paraphrases. No new images, invented contribution claims, author guesses or affiliations are seeded. The existing early-stage thesis is preserved independently of these works, with prediction remaining an aim.

## Skills Review

Final live-snapshot review: 451 -> 214 distinct skill labels; 825 -> 644 occurrences across existing records. Adding the five works brings the proposed total to 659 occurrences without adding new distinct labels. The separate local seed inventory was 396 -> 207 labels and 705 -> 622 existing occurrences (637 including additions); these differing inventories are why the local seed cannot replace live data.

`src/content/skillAliases.js` is the reviewed mapping catalogue. Each known alias resolves transitively to stable canonical labels before first-occurrence deduplication. The complete before/after counts and every observed mapping are in [skill-consolidation-report.json](skill-consolidation-report.json).

The live read-only inventory had 451 distinct labels across 825 occurrences in 13 jobs, 7 education records and 10 projects. The reviewed mapping substantially reduces excess; exact final counts are recorded in the report. Labels combine spelling variants and explicitly reviewed subtopics: React hooks/router/state-library tags become React; Vue routing/state tags become Vue.js; many testing tools become Software Testing; scientific Python libraries group under Scientific Computing/Data Analysis; regression subtypes under Statistical Modeling; granular inference labels under Statistics; Fourier/FFT/Abel tags under Signal Processing. Java and JavaScript, React and Node.js, Machine Learning and Statistics and Physics, important language proficiency and distinct major methods remain separate.

The mapping is not a skill allow-list or numeric cap. Unknown valid admin-entered labels survive. Generic Shell Scripting does not imply Bash; only the explicitly Bash label maps to Bash. Review Management in the Carsurfing application is a feature-development label and maps to Web Development, not moderation expertise. Narratives retain the detailed techniques and tool names. Research interests and thesis methods use a separate synonym-only catalogue so Hard parameter sharing, Matched single-task baselines, Gradient interference and Transfer and gradient interference stay meaningful.

Skill normalization runs consistently on GET/PUT, without adding research projects. The explicit migration persists consolidated arrays once; repeated API reads never re-add a user-deleted paper.

## Preview And Local Seed

The local seed has its own inventory and one fewer education entry than live. It must never overwrite the edited live portfolio. The seed was updated additively with five research records and the reviewed skills. `data/content-migrations.json` records the local one-time migration; it suppresses re-addition after later deletions. Existing records matched by stable ID/source identity/verified historical title are retained, including edits. Multiple existing versions cause a review error instead of deleting anything.

```powershell
npm run migrate:content -- --input data/portfolio.json --dry-run
npm run migrate:content -- --input private-content/live-portfolio-before-content.json --dry-run
```

The public snapshot is useful for reviewing scope but is not a raw Redis backup: the deployed public API may normalize/drop unsupported fields. No secrets or complete backups should be printed or committed. This migration's dry run reads Redis directly when no `--input` is supplied and credentials are configured securely:

```powershell
npm run migrate:content -- --dry-run --report private-content/raw-redis-content-dry-run.json
```

The report contains counts/mappings, exact proposed additions, preserved existing paper identities and a SHA-256 of the raw original value. It never prints credentials, public contact values or the complete payload. Any materially different raw-source scope must be reviewed before applying.

## Reviewed Live Apply

Deploy and verify the academic/authors contract before writing content; the older deployment drops these fields. Use the existing `main` -> GitHub -> Netlify production flow. Frontend publication is separate. Never create an unauthenticated migration endpoint or seed on GET.

After approval of a raw Redis dry run, retain the exact snapshot hash and explicitly apply:

```powershell
npm run migrate:content -- --apply --expected-hash REVIEWED_RAW_SHA256
```

If this Windows environment rejects Node creation of workspace backup files, first prepare a complete original JSON backup with the normal file editing tool under ignored `private-content/backups/`, then add `--backup-file private-content/backups/original.json`. The script reads that prepared file and checks its complete parsed payload against the original raw Redis value before applying. Formatting may differ; fields/values may not. The atomic Redis backup still retains the exact original raw value. A missing/mismatched prepared backup aborts before any Redis write.

The script reads the live raw value again and aborts if its hash differs. It verifies the production response has profile/research and project IDs/categories/authors, then saves a complete original JSON backup under ignored `private-content/backups/`. One Lua transaction compares the original raw value and checks the separate `${PORTFOLIO_REDIS_KEY}:migrations:research-content-2026-10-15-v1` ledger. It atomically writes a complete original Redis backup, the proposed value and the ledger. Concurrent admin edits cause no Redis writes. The ledger prevents repeat runs from restoring deleted or renamed papers. Backup failure aborts before touching Redis. User-authorized apply is explicit; dry run is the default.

After success, verify public GET returns 15 projects (4 current preprints, 1 manuscript in preparation, all 10 original projects), all 7 live education entries and 13 jobs; ordered authors, safe aligned links, old reports and thesis remain intact. Confirm authenticated GET/PUT and CSRF behavior with the existing tests. Retain the deployment identity, original snapshot hash and both backup locations. Do not claim the content is live until this write and readback succeed.
