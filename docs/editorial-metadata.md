# Editorial Metadata Contract

This additive contract supports the academic introduction, selected work and
visual grouping of education periods. Existing endpoints, fixed pages, research
entries, skill aliases, cookie authentication, exact-origin admin CORS, CSRF,
login rate limits and ImageKit upload flow are unchanged. It introduces no new
environment variables. Public GET remains unauthenticated and sends no cookie.

## Fields

| Location | Output Type | Default / Clear Command |
| --- | --- | --- |
| `profile.academicStatus` | String | Empty by default; explicit `""` clears |
| `profile.availability` | String | Empty by default; explicit `""` clears |
| `jobs[].featuredOrder` | Optional positive safe integer | Omitted when unset; PUT `null` clears |
| `projects[].featuredOrder` | Optional positive safe integer | Omitted when unset; PUT `null` clears |
| `education[].programme` | Optional trimmed nonempty string | Omitted when unset; PUT `""` clears |

These are public content fields, never derived from admin credentials. Academic
status and availability require explicit approved copy; dates alone do not
establish degree completion, graduation or availability. The existing thesis
status and paper publication statuses remain independent of editorial selection.

The following is a field illustration, **not a complete PUT body**:

```json
{
  "profile": { "academicStatus": "", "availability": "" },
  "jobs": [{ "id": "existing-role-id", "featuredOrder": 2 }],
  "projects": [{ "id": "existing-project-id", "featuredOrder": 1 }],
  "education": [{ "programme": "Fusion-EP" }]
}
```

Send the complete payload from authenticated GET when saving. Both GET data
endpoints return the same normalized shape. Admin PUT still requires the session
cookie and `X-CSRF-Token`; invalid supplied metadata returns 400 with the usual
admin CORS headers. Numbers, nulls, arrays and objects are not profile strings.
Programme accepts strings only; null is invalid. Rank zero, negative numbers,
fractions, booleans, strings and numbers above `Number.MAX_SAFE_INTEGER` are
invalid on PUT. Reads drop invalid legacy ranks rather than returning them.

## Ordering And Identity

Lower `featuredOrder` values come first in frontend-selected subsets only. Rank
values need not be unique, can be shared by different categories, and have no
effect on the full jobs, education or projects array order. The backend retains
its existing date-based chronological normalization. Frontends can use that
existing order to break equal-rank ties and must not assign new ranks on GET.

Keep existing job/project IDs when renaming or saving records. Omitted ranks are
retained by stable ID; changing an ID represents a different record. New records
may supply a new valid ID and omit the rank. When a collection already contains
ranked records, a rank-omitting ID-less save is rejected with 400 rather than
risk silently removing a selection. Send stable IDs or explicitly supply a rank
or `null`; never strip null clear commands before PUT serialization.

Programme is a grouping label, not a merger or a credential. Matching labels
may let the frontend display two institutional periods under one programme.
Both records, individual dates, institutions, status, courses, activities, maps
and media remain independent. No programme is guessed from a degree name.

## Older Editors And Clearing

Older clients omitting the complete profile/research objects retain the stored
objects. If profile is supplied but its two new strings are absent, stored values
are retained. An explicit `""` clears each. An empty profile object therefore
does not clear these compatibility fields; send their clear commands explicitly.
The existing thesis-supervisor and ordered-author retention rules still apply.

Omitted programme is retained only for a unique, exact
`degree`/`institution`/`start`/`end` match against stored normalized education.
This is not fuzzy matching. An ambiguous match returns 400 before writing.
If any identity field changes, send programme explicitly (or `""` to clear it)
with that edited record; a changed identity is not matched to the old period.

After clearing and saving, future omitted values stay cleared rather than being
rehydrated from defaults. Clears are input commands: saved/GET payloads omit
unset rank/programme fields, but always include both new profile strings.
Compatibility merging reads stored content at most once per save. Like existing
complete-payload saves, this is not versioned concurrent-editor conflict control.

## Media And Existing Content

Selection and programme grouping never reorder image/file arrays. Continue
saving complete same-index tuples:

```text
imageUrls[i] <-> imageTitles[i] <-> imageDescriptions[i] <-> imageBackupDescriptions[i]
links[i] <-> linksTitles[i] <-> linksDescriptions[i] <-> linksBackupDescriptions[i]
```

The existing URL sanitation, alias fallback and padding rules still apply.
Keep ordered authors, collaborators, affiliations and role relationships intact.
Duration stays deprecated and is removed on read/save. Research classification,
thesis aims and existing skill consolidation have not been rewritten by this
schema change.

## Deployment And Content Review

Code publication does not upload assets, seed Redis or apply editorial content.
New empty profile fields appear through normalization after deployment without
a storage write. Optional ranks and programme labels appear only if explicitly
stored. No persistent migration is required to enable the schema. An approved
complete authenticated save can persist new metadata.

For an optional content migration, review a noncommitted complete raw snapshot,
not a normalized public GET, and retain the full original backup. Use a new,
separately reviewed source/candidate plan and migration identity with the
[maintenance safeguards](maintenance-tools.md). Never replay historical ledgers
or replace the live payload with the older local seed. This release does not
include an editorial candidate or claim that live content was changed.

## Verification

`test/editorialContract.test.js` exercises defaults, types, ranks, clearing,
legacy saves, ID stability, exact programme matching, media alignment and
authenticated PUT/public GET round trips with isolated in-memory storage.
Existing auth/CORS/CSRF/login/upload and research/skills tests remain in the full
suite. Tests never write live Redis or upload assets. Mocked backend checks do
not establish signed-in browser save/upload behavior or hosting deployment.

For the 2026-10-16 schema release, all **192 backend tests** and **66 JavaScript
syntax checks** passed. The production dependency audit found zero known
vulnerabilities. README contents/links and Git ignore rules are exercised by
tests. There is no separate lint or build script; Netlify uses `npm test` as its
deployment gate. These are local verification results, not live migration or
signed-in browser results.
