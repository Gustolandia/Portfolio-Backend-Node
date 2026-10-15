# Workplace Maps And Building Photographs

Publication note: the maintenance code/docs/tests are now authorized for the
reviewed release. See [the maintenance guide](maintenance-tools.md). This does
not replay the completed content update or upload additional photos.

## Scope

This is a separately authorised content-only update, not a new API or backend
deployment. It updates only reviewed `mapLocation` strings and appends complete
`imageUrls` / `imageTitles` / `imageDescriptions` / `imageBackupDescriptions`
tuples to jobs and education. Existing media, array order, IDs, roles, dates,
skills, papers, profile, page images and CV fields remain unchanged. All original
dirty maintenance work was preserved and was not pushed during that data-only workflow.

The frontend owns map rendering, remote/area labels, public links and its own
release. The backend continues returning the same complete portfolio shape.
Cookie authentication, exact-origin admin CORS, CSRF, public anonymous GET and
ImageKit upload contracts are unchanged. No library-listing endpoint is added.

## Evidence And Limits

The user confirmed Covalen's workplace was Facebook's former Microsoft building
in Sandyford. The reviewed query identifies the Nova Atria complex on Blackthorn
Road, not an unverified North/South block or room. The exterior photograph is
explicitly dated 2006, before the later Facebook/Covalen occupancy. Sources:
[employer's Covalen listing](https://employer.jobsireland.ie/Reports/GetJobsDetail?id=2433562),
[2019 letting report](https://www.irishtimes.com/business/commercial-property/facebook-sets-its-sights-on-sandyford-office-space-1.3846835),
[Sarah777's public-domain Atrium photograph](https://commons.wikimedia.org/w/index.php?curid=11024992).

The user explicitly confirmed the K1 / Blekitek building at Aleja Pokoju 1 beside
Rondo Grzegorzeckie was the Arvato office. The selected exterior is dated 2023,
after the role, and credits Igor123121 under CC BY-SA 4.0:
[K1 exterior](https://commons.wikimedia.org/w/index.php?curid=138400499).
Do not substitute Google's current or former main-square headquarters for this
firsthand-confirmed workplace.

Accenture's existing Tertium Business Park map is preserved. Its new licensed
district photograph identifies Tertium at the **left**, not the prominent
neighbouring Capgemini tower. The caption states 2022, after the role, and credits
Mach240390 under CC BY 4.0:
[office-district photograph](https://commons.wikimedia.org/w/index.php?curid=119121643).

IJL's reviewed 2015 institutional address is in Vandoeuvre-les-Nancy, rather than
assuming today's Artem building represents the internship. The map/photo use
science-campus context and do not claim to depict an exact laboratory room.
The same 2013 faculty exterior also supplements the Lorraine education gallery.
Sources: [2015 fusion-group affiliation](https://www.cambridge.org/core/journals/journal-of-plasma-physics/article/abs/simulation-as-a-tool-to-improve-wave-heating-in-fusion-plasmas/4B28F0348AB74C2370D514B805D71942),
[2015 IJL thesis address](https://docnum.univ-lorraine.fr/public/DDOC_T_2015_0137_DESECURES.pdf),
[official campus history](https://fst.univ-lorraine.fr/administration/historique/),
[Nanzig's CC BY-SA 4.0 campus exterior](https://commons.wikimedia.org/w/index.php?curid=69979842).

IFIMUP reuses the already hosted FCUP Physics and Astronomy Department interior,
without a new upload, as department context rather than a claimed internship lab
room. The 2011 institutional affiliation confirms Rua do Campo Alegre 687:
[period research paper](https://repositorio.inesctec.pt/bitstreams/48b3e34e-c4a7-4fe5-a3b6-34e8972f3b6d/download).

CEA's facility query is clarified to Cadarache, Saint-Paul-les-Durance, using the
2015 affiliation above. IGVP's query uses its microwave group's period address,
Pfaffenwaldring 31, supported by the
[2014 research paper](https://bibliography.tdotp.ac.uk/bibliography/JABP6CEW/download/B424XXX3/Williams%20et%20al.%20-%202014%20-%20Propagation%20in%203D%20of%20microwaves%20through%20density%20perturbations.pdf)
and [institute contact](https://www.igvp.uni-stuttgart.de/team/Koehn-Seemann/).
These are map-only clarifications, not changes to stored role locations or dates.

BoscaSports, Invertase and Xerotech are explicitly remote roles. Their maps use
only the already stated organisation cities (Dublin, Manchester and Galway),
not guessed company offices or private home addresses. Their existing logos
remain; logos are not counted as physical workplace photographs. EPICODE is
wholly remote with no verified physical city, so it remains honestly unmapped.

Vertu's original user-provided Athens map at Marikas Kotopouli 1 is preserved.
Its old broken photo URL named a London coworking image and is not evidence of
the Athens workplace. No such image is restored or mislabelled. An authentic,
reusable photograph of the exact Athens office remains unresolved; a user-owned
photo or verified reusable building image is needed to fill this gap.

Four jobs therefore still lack a verified physical-office photograph:
BoscaSports, Invertase and Xerotech (remote roles), plus Vertu (Athens building
photo unresolved). EPICODE's physical-campus image is not applicable to its
online-only record. IJL and IFIMUP have explicitly labelled institutional
campus/department context, not verified images of the exact laboratory rooms.
Do not summarise this rollout as all 24 entries having actual office photos.

## Staging And Provenance

Four selected Commons originals were downloaded and checked against source
SHA-1 metadata and locally pinned SHA-256 hashes. Original bytes, source metadata,
licences, creators and dates are retained under ignored
`private-content/workplace-photos-2026-10-15/`. All four originals were visually
reviewed. Captions carry attribution, licence links and short source links.

The existing `stageImageKitAssets` library uploads only these selected files to
`/Portfolio-Website/Photos`, using unique names and no overwrite. It never lists
or deletes ImageKit files. All four stored originals match source SHA-256 via
`tr=orig-true`; delivery renditions return decodable, nonblank images. Wider
sources use reviewed `w-1600` delivery to avoid sending full-resolution photos
unnecessarily. The original files remain unchanged. Six tuple appends reuse the
one Nancy upload twice and the existing FCUP interior once.

## Preview And Application

`planWorkplaceContentMigration` in
`src/content/workplaceContentMigration.js` is pure. It accepts a complete raw
portfolio, version-1 reviewed plan and verified upload receipts. Job targets use
stable source-order normalised IDs, without persisting legacy IDs; education
matches degree, institution, start and end exactly. Stale maps, stale original
URL arrays, duplicate appends, ambiguous identities, unsupported scopes and
unverified photo sources fail closed. Explicit remote entries may receive only
their already stated organisation city, not an invented office address.

Existing four-array tuple prefixes, including explicit empty strings, are
preserved. Missing legacy metadata is padded without shifting URL indexes;
surplus metadata without a URL requires review. Appended text remains paired
with its URL. Raw unknown fields and all non-map/non-media content are compared
exactly; normalised identities and the public contract are also checked. No
existing image or metadata row is replaced, removed or independently sorted.

Use native Node for complete comparisons. Passing VM/Node-REPL-created arrays
into a separately imported Node module can fail `isDeepStrictEqual` because of
different realm prototypes. Do not weaken preservation guards: parse the source,
plan and receipts and run comparisons in the same native Node process instead.

`migrateWorkplaceContentRedis` defaults to dry run. A separately approved apply
requires exact source/candidate hashes, a complete byte-exact private backup and
deployment verification. The shared Lua CAS atomically writes the original
Redis backup, replacement and separate
`<key>:migrations:workplace-photos-2026-10-15-v1` ledger. Concurrent admin saves
abort without overwrite. A completed ledger makes repeats full no-ops, including
after later admin edits or deletion. It does not touch earlier migration ledgers.

Never replace live content from the default seed or a normalised public GET.
The review backup and source hash must cover the **entire raw Redis value**.
Review the full candidate independently, not just operation counts. After apply,
verify byte-identical raw readback, exact local/Redis backups, ledger, normalised
public GET and a read-only repeat. Browser review and a signed-in admin upload
are distinct from these backend checks and must not be claimed without testing.

## 2026-10-15 Verified Rollout

The independent review approved these exact raw hashes:

```text
source:    79e0ca1e86f892e4b5975616e7f7f86b0784b2ff3eae4d4e176ade7f6fafada4
candidate: 49ccf4d343ce86ca10768b3a3f48d3d5278da5e080b769d675861eddfa064cc8
```

Application completed with full backups, exact raw/public readback, ledger and
read-only no-op verification. Counts remain 17 jobs, seven education entries and
15 projects. Ten map queries changed and six photo tuples were appended. There
are 23 explicit maps out of 24 work/education records, including three clearly
labelled remote organisation-city contexts; EPICODE is the online-only exception.
All 95 unique image URLs belong to the owned ImageKit account, and all normalised
media arrays remain aligned. Every original photo/logo URL is retained in order.

The private `apply-receipt.json`, `workplace-plan.json`, upload receipts, complete
source/candidate and coverage report record exact references and provenance.
These private artifacts are not committed, deployed or exposed by an endpoint.
No backend runtime/configuration deployment or Git push was needed for the data
update. Newly added maintenance code/docs/tests were left local at that time;
their separately authorized publication is documented in the maintenance guide.

Verification: `npm test` passed 150 tests, including ten focused workplace tests;
60 JavaScript files passed syntax checks; dependency audit found zero
vulnerabilities; whitespace checks passed. Tests use isolated mocked Redis and
upload receipts, never live writes. Live public GET returned 200 with wildcard
CORS and no cookies. Admin session checks returned 401 with exact-origin
credentialed CORS for all four approved origins; PUT preflight returned 204 with
CSRF header support and no cookie. Existing authentication, CSRF and upload tests
remain in the full suite. No API response shape was changed.

Independent frontend verification subsequently confirmed the exact normalised
candidate on the live API. All 95 published image URLs returned HTTP 200 and
image content types; all five distinct new/reused delivery URLs returned nonempty
JPEGs. All 24 public dialogs passed baseline gallery/overflow checks. The six
changed galleries loaded the appended photos and correct map queries, including
Arvato's confirmed K1 pin and preserved team pictures. The remote BoscaSports map
was correctly labelled as organisation context. A 390-by-844 phone check of
Covalen's photo, long caption, live Nova Atria map and external fallback link
showed no horizontal overflow. These are frontend-reported independent browser
checks, not a claimed signed-in admin upload test. The frontend release is
`9431006`; this backend content-only update required no new backend release.
