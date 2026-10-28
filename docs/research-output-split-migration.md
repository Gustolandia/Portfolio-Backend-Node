# Research Output Split Migration

## Purpose and scope

On 28 October 2026, the owner confirmed that two superseded football research
entries should no longer appear as current research outputs. Their
work is now represented by three distinct current manuscripts:

1. **Article A:** *Who is who: what matters in injuries in professional team
   sports* (`paperA/`).
2. **Article B:** *New rules, old habits: across seven team sports, each league
   keeps its own way of using the rules* (`paper_b/`).
3. **Article C:** *Close to cap: who plays the whole match across nine
   sports* (`manuscript_c/`).

The migration changes only two existing research records and inserts Article C.
It does not remove historical arXiv versions, publish a private repository,
upload manuscript files, alter project media URLs, change any unrelated record,
or infer a publication date or peer-review status.

## Current public manuscript links

The active source workspace remains private. On 28 October 2026, the owner
published the current PDFs in the deliberately minimal public companion
repository [`Gustolandia/team-sports-papers`](https://github.com/Gustolandia/team-sports-papers).
The migration links each Article A, B and C record to its own public current PDF.

The PDFs are manuscripts, not preprints or peer-reviewed publications. The
records remain `manuscript` / `in-preparation`; a public PDF link does not
change that status. When an arXiv version is announced, update the editable
record with the final identifier and any approved additional link. Do not attach
the private source repository or publish a draft tree merely to fill a field.

## Guarded procedure

Create a noncommitted plan at
`private-content/research-output-split-2026-10-28/plan.json`. It contains the
exact old record values, reviewed replacement metadata and the Article C record.
The command accepts an offline snapshot for review, but never applies one:

```powershell
node scripts/migrate-research-output-split.js --input private-content/research-output-split-2026-10-28/source.raw.json --plan private-content/research-output-split-2026-10-28/plan.json --dry-run
```

For a live dry run, load backend-only Redis credentials from the local `.env`
and omit `--input`. Review the source and candidate SHA-256 values, then save
the complete original raw Redis bytes to the exact backup path. Apply only with
those reviewed hashes:

```powershell
node scripts/migrate-research-output-split.js --plan private-content/research-output-split-2026-10-28/plan.json --apply --expected-hash <source-sha256> --expected-candidate-hash <candidate-sha256> --backup-file private-content/research-output-split-2026-10-28/source.raw.json --report private-content/research-output-split-2026-10-28/apply.receipt.json
```

Before writing, the tool verifies the deployed public contract. It then checks
the prepared backup byte-for-byte, uses one Redis compare-and-set operation to
write the original Redis backup, candidate and a new independent ledger, and
reads no credentials or manuscript text into its report. A stale source or
concurrent admin edit aborts without changing Redis. An already-applied ledger
is a zero-write no-op and leaves later owner edits alone.

## Tests

`test/researchOutputSplitMigration.test.js` covers exact source matching,
aligned asset-link metadata, the additional manuscript, raw and normalized
preservation, stale-plan rejection, complete local/Redis backups, concurrent
write rejection and ledger no-op behaviour. Tests use mocked Redis only.
