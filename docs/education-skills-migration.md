# Education-Only Skill Reduction

The owner requested fewer education skill tags, not merely a frontend cap.
This one-time curation changes only the `skills` arrays on seven explicitly
matched education periods. It does not change the payload schema, auth, CORS,
CSRF, rate limits, endpoints, global skill aliases or frontend API behavior.
No ImageKit action or project collection assignment is included.

## Reviewed Lists

| Institution | Before | After | Retained/Summary Labels |
| --- | ---: | ---: | --- |
| Trinity College Dublin | 20 | 6 | Statistics; Machine Learning; Data Analysis; Scientific Computing; Scientific Research; R |
| Technological University of the Shannon | 24 | 7 | Software Architecture; Cloud Computing; DevOps; Database Management; Software Testing; Java; Python |
| Atlantic Technological University | 38 | 6 | Software Development; Database Management; Web Development; Software Testing; Java; Linux |
| EPICODE | 15 | 6 | Web Development; API Development; Database Management; Cloud Computing; JavaScript; Node.js |
| Universite de Lorraine | 24 | 5 | Physics; Plasma Physics; Scientific Computing; Data Analysis; Scientific Research |
| Stuttgart study period | 25 | 5 | Physics; Plasma Physics; Scientific Computing; Data Analysis; Scientific Research |
| Universidade do Porto | 28 | 6 | Physics; Experimental Physics; Mathematical Modeling; Scientific Computing; Data Analysis; Scientific Research |
| **Total occurrences** | **174** | **41** | At most seven tags per education record |

These are concise labels for already-listed study, not new degrees, awards,
proficiency levels or achievements. The two Fusion-EP periods remain separate
records with their original taught-component/degree-not-awarded context.
Provisional grades, ongoing status, dates and blank current residence remain
unchanged. Existing course text is kept exactly; removed tag detail remains in
the complete raw backup, not necessarily in every individual course string.

Only three new broad labels are permitted by this planner, and only when absent
from that period's existing canonical skills:

- `Cloud Computing`: existing AWS/Azure/Cloud Native Computing skills plus an
  exact already-listed cloud/AWS/Azure course witness.
- `Database Management`: existing SQL/MySQL/PostgreSQL/MongoDB/NoSQL skills plus
  an exact database/SQL/Spring Data course witness. For TUS, the sources are its
  MySQL skill and the existing microservices course's Spring Data content.
- `API Development`: existing REST APIs skill plus an exact REST/Express/HTTP
  course witness. EPICODE already lists REST APIs and Express coursework.

All other output labels must already exist on that same period. Evidence from
jobs, other education records or generic degree names cannot add a skill.
The ordinary admin API still supports user-edited skill arrays: these strict
evidence rules belong to this one-time migration, not new API restrictions.

## Plan And Preview

Use a **fresh complete raw Redis snapshot**, not a public GET response or the
older local seed. Each private plan patch contains only:

```text
match: degree, institution, start, end (exact existing strings)
expectedSkills: complete original raw array in order
skills: one to seven distinct canonical labels, fewer than before
evidence: [{ skill, sourceSkills, sourceCourses }] for every new summary
```

The root has `version: 1`, migration ID `education-skills-2026-10-16-v1`, and
`patches`. Unknown plan/patch fields, ambiguous periods, duplicate operations,
stale arrays, missing/unsupported course witnesses, noncanonical labels and
unapproved summaries fail without mutation. Labels are not guessed or selected
automatically by GET, startup, tests, deployment or the CLI.

```powershell
node scripts/migrate-education-skills.js --input private-content/education-skills-2026-10-16/original.json --plan private-content/education-skills-2026-10-16/reviewed-plan.json --dry-run
node scripts/migrate-education-skills.js --plan private-content/education-skills-2026-10-16/reviewed-plan.json --dry-run
```

The first preview is offline; the second reads raw Redis and its separate ledger
using securely loaded backend environment variables. No new environment variable
is needed. Credentials never enter a plan or report. CLI output/report includes
counts, changed field indexes, hashes and backup references, not full content.
Keep complete plans, candidate snapshots, receipts and backups private/ignored.

## Guarded Apply

1. Review the current record-by-record mapping and full candidate diff. Prove
   complete raw/public equality except the intended `education[].skills` arrays.
2. Preserve and read back a byte-identical complete local backup. Record fresh
   source and candidate SHA-256 hashes; never assume an earlier public baseline
   still applies after concurrent approved edits.
3. Run all tests and syntax/audit checks, publish reviewed maintenance code, and
   verify the actual production commit/API before applying. Publishing alone
   does not curate any content or replay older migrations.
4. Apply with the two exact hashes and prepared backup:

```powershell
node scripts/migrate-education-skills.js --plan private-content/education-skills-2026-10-16/reviewed-plan.json --apply --expected-hash <source-sha256> --expected-candidate-hash <candidate-sha256> --backup-file private-content/education-skills-2026-10-16/original.json
```

The shared Lua CAS compares the full original raw value and atomically writes
its exact Redis backup, the candidate and the independent ledger at
`<portfolio-key>:migrations:education-skills-2026-10-16-v1`. A changed candidate,
failed backup, stale source, concurrent edit or ambiguous write mode cannot
overwrite live content. File input is never an apply source. After an uncertain
request outcome, inspect raw readback and the ledger rather than blindly retrying.

## Verify And Repeat

Verify the actual stored bytes equal the reviewed candidate, local/Redis original
backups equal the complete source, and public normalized readback equals the
expected normalized candidate. Compare every other field and array order,
including jobs/projects/research skills, courses, grades/dates, statuses, maps,
primary URLs, same-index captions/backups, collections and the blank location.
Also check the ordinary public URL, accounting for its existing cache behavior.

Repeat through the Redis wrapper with the same reviewed plan/guards. An applied
ledger makes it a complete no-op, preserving later administrator edits or
deletions; do not remove the ledger to force a replay. Reset/reload old admin
drafts after curation so a stale complete-payload save does not restore removed
tags. Refresh frontend in-memory content; no frontend hardcoded tag cap is needed.

`test/educationSkillsMigration.test.js` covers evidence boundaries, exact
identities, scope/order/media preservation, input immutability, stale plans,
dry-run behavior, exact backups, candidate/source hashes, deployment failures,
concurrent CAS rejection, ledger repeats and private CLI output. Redis is mocked;
tests do not write live content. The committed local JSON remains a historical
seed and is not used to replace or mass-rewrite the current portfolio.

## Verified Application

The reviewed reduction was applied on 2026-10-16 after production published
maintenance commit `14ed07d`. All **233 backend tests**, **75 JavaScript syntax
checks** and a full dependency audit passed; no dependencies or global aliases
changed. Only the seven arrays in the table changed, from 174 to 41 occurrences.
All jobs/projects skills and thesis content stayed exact. Global skill
occurrences consequently changed from 566 to 433 and distinct labels from 214
to 164; this is the authorized education-only reduction, not content loss in
another section.

The fresh complete raw/public snapshots matched the live source immediately
before application. One Lua CAS atomically wrote the candidate, exact original
Redis backup and independent ledger. Stored bytes matched the reviewed candidate;
the local and Redis original backups matched every source byte. Complete raw and
normalized public comparisons, masking only education skills, were identical.
Dates, grades, statuses, maps, all media/metadata order, collections and the blank
current-residence value remained unchanged.

An immediate repeat returned `applied: false`, `alreadyApplied: true` and
`changed: false`, made no extra CAS call, and preserved raw bytes and the ledger.
Both uncached and ordinary public GET returned the verified normalized result.
No ImageKit action, collection assignment, admin login or browser save was used.
Private per-record mappings, full snapshots, backup references, CAS intent,
ledger and readback/no-op receipts remain under ignored
`private-content/education-skills-2026-10-16/` and outside deployment inputs.

These are release-specific hashes, not assumptions for future changes:

| Snapshot | SHA-256 |
| --- | --- |
| Original raw Redis | `0c43b50f8f45c25faa2eab91d57c3c58d827c4d2963665edc3aea0d7f1f82009` |
| Stored reviewed candidate | `ebcf2dc7982de91fd68f75c448cb9a2c8f34f0e527ecc9693ec3a241661cb775` |
| Original normalized public | `d0351d167df2ebe1eb743a0049379b2bc110fc98c26e74491aa11becd6e5e57d` |
| Verified normalized public | `a15123348344cb9bb7bba6e2853236966511d602885d5c1907fefd18a226d8e7` |
