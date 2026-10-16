# Project Collections Contract

Projects may belong to multiple user-defined collections. This additive field
does not replace their academic `category`, publication metadata or stable ID.
It adds no endpoint, environment variable, service dependency or Redis migration.
Cookie sessions, exact-origin admin CORS, CSRF, login throttling, uploads and the
public unauthenticated single-payload GET keep their existing contracts.

## Shape And Normalization

Each project returned by public/admin GET or a successful PUT includes
`collections: string[]`. An illustrative field fragment, not a complete PUT:

```json
{
  "id": "existing-project-id",
  "collections": ["Example collection", "Another example collection"]
}
```

These example labels are not approved assignments to any existing project.
The field is optional in incoming payloads for older editors. Legacy stored
projects missing it return `[]`; GET never persists defaults. A supplied array
is normalized by trimming each label, dropping blank labels and removing exact
duplicates while retaining first-occurrence order and original case. `Research`
and `research` are distinct labels. Unknown nonempty labels remain valid.
No membership is inferred from titles, category, skills, authors or ranks.

PUT rejects a supplied non-array, null or any non-string array member with 400
and the normal admin CORS/error shape. Reads sanitize malformed legacy values
to safe arrays. `collections` applies only to projects; unsupported job,
education, page or singleton fields retain their existing allow-list behavior.

## Saving And Older Editors

Save the complete payload through `PUT /.netlify/functions/admin-portfolio-data`
using the existing session cookie and `X-CSRF-Token`. Its response and both data
GETs return the same normalized collection arrays.

- Explicit `collections: []` clears a project's membership.
- A missing property retains the stored normalized array by stable project ID.
- If any stored project has memberships, an omitted field on an unmatched or
  ID-less project returns 400 before writing. Reload the editor and retain IDs,
  or send the intended array explicitly; do not guess a name-based match.
- New records should send `collections: []` or their explicitly chosen labels.
- Deleting a project from the complete payload does not restore it or transfer
  its labels to another record. Clearing and later omitting stays cleared.

Compatibility retention uses the existing shared storage read, at most once per
save. It does not add concurrent-editor version control: complete saves retain
the API's existing last-write behavior. Keep ordinary backup/review safeguards.

## Identity, Ordering And Media

Changing collections cannot change deterministic legacy IDs, persisted IDs,
categories, related role IDs, bylines, publication status or featured positions.
The main projects array remains newest-first by `dateOfCompletion`; label order
is not a project rank. Image/link arrays and all their same-index description,
title and backup-description associations remain untouched.

`featuredOrder` remains supported for editorial presentation, including research
priority. Removing the frontend's former Selected projects scope does not erase
this metadata. Research placement remains based on the explicit category rather
than collection names. The backend does not implement server-side filtering.

## Frontend Rollout

1. Deploy this additive backend first. Verify the only legacy GET difference is
   empty `collections` arrays on projects; raw Redis must remain unchanged.
2. Preserve optional absence when interoperating with an older backend. Never
   fabricate and save assignments just because a label can be guessed.
3. Add a multiple-label editor in `/admin`, retaining stable IDs and all existing
   project fields/media. Send arrays explicitly for edits, clears and new rows.
4. Make All projects the default view, including projects with empty membership.
   Populate the collection filter from explicit labels and match a project when
   its array contains the chosen label. A project may appear in several views.
5. Remove the former Selected projects scope and separate category filter from
   the public projects UI; do not delete category or featured metadata in saves.
6. Propose existing-project assignments for the owner's review. Apply no labels
   to live content until those assignments are explicitly approved.

The committed local JSON remains a valid legacy source and is not rewritten or
classified for this release. No seeding, mass PUT, migration or Redis write is
needed to introduce the contract. An old frontend omitting collections retains
future assignments through the stable-ID compatibility behavior above.

## Verification

`test/projectCollections.test.js` covers legacy defaults and pure reads;
malformed stored/supplied values; trimming, exact deduplication and case/order;
ID/category/byline/media preservation; authenticated PUT-to-public GET; renamed
and reordered legacy omission retention; explicit clearing; unmatched omission
rejection; new records and deliberate deletion; cookie/CSRF/method/CORS checks.
Redis is mocked and no test writes live content. The full existing security,
storage, migration, dependency and media suites must also pass before release.

Use a fresh private raw/public backup and an expected normalized preview for
deployment readback. Ignore only the documented project-field addition when
comparing with a legacy public baseline. Never ignore unrelated content diffs.
Private review receipts stay excluded from Git and deployment inputs.

The release verification on 2026-10-16 passed **219 backend tests**, **72
JavaScript syntax checks** and a full audit with zero known vulnerabilities.
No dependency or lockfile changed, and the no-declared-deprecations regression
remains enabled. The reviewed live preview added only 15 empty collection arrays
to the existing 15 projects, with no category, media, ID or ordering changes.
Its expected public canonical SHA-256 is
`d0351d167df2ebe1eb743a0049379b2bc110fc98c26e74491aa11becd6e5e57d`,
compared with the legacy public hash
`83375c7c4a21580733fe63cf7cfc41ec5d826ee859d1e29c45f2c907250c74a8`.
These are release-specific snapshots, not fixed hashes for future content.
