# Portfolio Backend

Small Netlify Functions backend for a React academic portfolio website. It serves profile, thesis overview, experience, education, projects and their attached assets as one JSON payload so the frontend can fetch once at startup and keep the data in browser memory.

## Table Of Contents

- [Endpoint](#endpoint)
- [Admin Endpoints](#admin-endpoints)
- [Portfolio Payload Contract](#portfolio-payload-contract)
- [Academic Metadata And Placement](#academic-metadata-and-placement)
- [Project Layout](#project-layout)
- [Maintenance Tools](#maintenance-tools)
- [Environment Variables](#environment-variables)
- [ImageKit Uploads](#imagekit-uploads)
- [Upstash Redis](#upstash-redis)
- [Local Development](#local-development)
- [Tests](#tests)
- [Deploying To Netlify](#deploying-to-netlify)

## Endpoint

```text
GET /.netlify/functions/portfolio-data
```

`GET` is public and sends no cookies. On this public route, non-GET requests are authenticated first with either `Authorization: Bearer <jwt>` or `X-API-Key: <key>`, then rejected with `405 Method Not Allowed`. Content writes use the separate cookie-authenticated admin endpoint below.

## Admin Endpoints

Admin requests use secure HttpOnly cookie sessions. The admin frontend should use `credentials: "include"` for every admin request and should send `X-CSRF-Token` for unsafe requests after login/session returns a token.

```text
POST /.netlify/functions/admin-login
GET  /.netlify/functions/admin-session
POST /.netlify/functions/admin-logout
GET  /.netlify/functions/admin-imagekit-upload-auth
GET  /.netlify/functions/admin-portfolio-data
PUT  /.netlify/functions/admin-portfolio-data
```

`admin-login` accepts:

```json
{
  "email": "admin@example.com",
  "password": "admin-password"
}
```

Successful login/session responses return:

```json
{
  "authenticated": true,
  "user": {
    "email": "admin@example.com"
  },
  "csrfToken": "token-for-unsafe-requests"
}
```

`admin-logout` and `PUT admin-portfolio-data` require the session cookie and `X-CSRF-Token`.

`admin-imagekit-upload-auth` returns short-lived ImageKit browser upload credentials. It requires the admin session cookie but does not require CSRF because it is a read-only `GET` endpoint. There are no admin endpoints for listing ImageKit files; portfolio pages and the public frontend only receive asset URLs that have already been saved in the Redis-backed portfolio payload.

```text
GET /.netlify/functions/admin-imagekit-upload-auth
```

Upload targets:

```text
GET /.netlify/functions/admin-imagekit-upload-auth?target=files
GET /.netlify/functions/admin-imagekit-upload-auth?target=photos
GET /.netlify/functions/admin-imagekit-upload-auth?target=snippets
```

`files`, `photos` and `snippets` use their server-configured folder variables. Configure the new upload root `/Portfolio-Website` and its `/Photos` and `/Snippets` subfolders explicitly: ImageKit upload folder names do not allow spaces. Historical code defaults use `/Portfolio Website`; they are not suitable for new uploads and are not changed implicitly. Existing CDN URLs with encoded spaces stay untouched. If `target` is omitted, the backend defaults to `snippets` for compatibility with project image uploads. Frontend-provided custom folders are rejected.

The response contains `token`, `expire`, `signature`, `publicKey`, `urlEndpoint`, `uploadEndpoint`, `folder`, and `folders`. The frontend sends those values plus the selected `File` to ImageKit's browser upload API. ImageKit returns the public asset URL; the frontend then stores that URL in its local portfolio edit state and saves the complete portfolio payload with `PUT admin-portfolio-data`, which persists the URL and its metadata to Redis.

## Portfolio Payload Contract

Both public and admin data endpoints return one complete portfolio payload:

```json
{
  "pages": {
    "home": {
      "title": "",
      "description": "",
      "imageUrl": ""
    },
    "experience": {
      "title": "",
      "description": "",
      "imageUrl": ""
    },
    "education": {
      "title": "",
      "description": "",
      "imageUrl": ""
    },
    "projects": {
      "title": "",
      "description": "",
      "imageUrl": ""
    },
    "contact": {
      "title": "",
      "description": "",
      "imageUrl": ""
    }
  },
  "jobs": [],
  "education": [],
  "projects": [],
  "profile": {
    "name": "",
    "headline": "",
    "summary": "",
    "location": "",
    "email": "",
    "cvUrl": "",
    "portraitUrl": "",
    "academicStatus": "",
    "availability": "",
    "researchInterests": []
  },
  "research": {
    "title": "",
    "summary": "",
    "thesisTitle": "",
    "thesisSummary": "",
    "thesisStatus": "",
    "thesisInstitution": "",
    "thesisSupervisor": "",
    "thesisStart": "",
    "thesisEnd": "",
    "thesisQuestions": [],
    "thesisMethods": []
  }
}
```

`duration` is deprecated and removed from backend responses and saves. Jobs and education should use `start` and `end` only. Projects use `dateOfCompletion`.

Jobs are normalized to these fields only:

```text
id, category, featuredOrder?, title, company, location, start, end, imageUrls, imageTitles, imageDescriptions, imageBackupDescriptions, duties, skills, mapLocation
```

Education entries are normalized to these fields only:

```text
status, programme?, degree, institution, location, grade, start, end, imageUrls, imageTitles, imageDescriptions, imageBackupDescriptions, courses, activities, skills, mapLocation
```

Projects are normalized to these fields only:

```text
id, category, featuredOrder?, outputType, status, contribution, relatedRoleIds, authors, name, dateOfCompletion, description, imageUrls, imageTitles, imageDescriptions, imageBackupDescriptions, affiliations, collaborators, skills, links, linksTitles, linksDescriptions, linksBackupDescriptions
```

Missing string fields become `""`, missing array fields become `[]`, and unsupported rich-item fields are discarded. Jobs and education are sorted by latest `end` date first, falling back to `start`. Projects are sorted by latest `dateOfCompletion` first.

The `?` above denotes an optional field, not part of its JSON key. Jobs/projects may carry a positive safe-integer `featuredOrder`; unset values are omitted from responses. It selects frontend featured subsets without changing the main chronological arrays. Education may carry a trimmed, nonempty `programme` to group periods visually without merging records. See [editorial metadata](docs/editorial-metadata.md) for older-client retention, exact education matching, and explicit clearing rules.

Image and file metadata is stored in ordered arrays. Order is the relationship:

```text
imageUrls[index] <-> imageDescriptions[index] <-> imageBackupDescriptions[index]
links[index]     <-> linksDescriptions[index] <-> linksBackupDescriptions[index]
```

`imageTitles` and `linksTitles` remain supported as compatibility aliases for the primary description fields. When possible, the backend mirrors/falls back between `imageTitles` and `imageDescriptions`, and between `linksTitles` and `linksDescriptions`. If an invalid or empty `imageUrls[index]` or `links[index]` is discarded, the corresponding metadata at that same index is discarded too.

## Academic Metadata And Placement

`profile` and `research` are returned by both data endpoints. Their string fields default to `""` and their string-array fields default to `[]` when an object is explicitly supplied. `profile.researchInterests`, `research.thesisQuestions`, and `research.thesisMethods` are ordered string arrays; all other fields in these two objects are strings. `research.thesisStatus` uses the enum below. Unknown fields are discarded. On normalization, explicit `null` for either singleton object produces empty fields; only `undefined`/an absent object receives legacy defaults. Admin PUT still requires any supplied singleton value to be an object, so clients should normalize nulls to empty objects before saving.

The four legacy top-level sections (`pages`, `jobs`, `education`, `projects`) remain required for PUT. Older clients may omit `profile` or `research`: the service retains any stored object, or uses the approved legacy defaults if no object exists yet. Explicit objects replace ordinary fields with normalized values. Compatibility exceptions retain omitted `profile.academicStatus`, `profile.availability`, and `research.thesisSupervisor`, even inside `{}`; send each field as `""` to clear it. Explicit empty strings never restore default text on a later GET/save. Supplied non-object metadata and non-string/string-array fields return 400.

For legacy data missing each entire object, the backend provides these approved defaults:

```json
{
  "profile": {
    "name": "Gustavo Pedro Ricou",
    "headline": "Machine learning, statistics & scientific computing",
    "summary": "My background combines physics, statistics and software engineering. My current thesis investigates when sharing a neural-network representation helps or hurts tasks trained together.",
    "location": "",
    "email": "",
    "cvUrl": "",
    "portraitUrl": "",
    "academicStatus": "",
    "availability": "",
    "researchInterests": ["Multi-task learning", "Transfer and gradient interference", "Statistics", "Scientific computing"]
  },
  "research": {
    "title": "Research",
    "summary": "Questions at the intersection of learning, statistics and scientific computing.",
    "thesisTitle": "Gradient interference and transfer in multi-task learning",
    "thesisSummary": "I study two tasks trained simultaneously on the same inputs, using a shared trunk and a separate output head for each task. Each task is compared with a matched single-task network. The aim is to understand when sharing helps or hurts and whether transfer can be predicted before training.",
    "thesisStatus": "in-progress",
    "thesisInstitution": "",
    "thesisSupervisor": "",
    "thesisStart": "",
    "thesisEnd": "",
    "thesisQuestions": ["When does sharing a trunk help or hurt each task?", "Can transfer be predicted before training?"],
    "thesisMethods": ["Hard parameter sharing", "Matched single-task baselines", "Gradient interference"]
  }
}
```

The thesis is early-stage work. Prediction is an aim; no achieved prediction result or discovery is seeded. Institution, dates, contact address and CV require explicit backend content edits. No login email or authentication environment variable is used as public contact information. Add a public email through the authenticated admin editor; keep any temporary content snapshot under the ignored `private-content/` directory. A frontend Show email button can deter simple scraping, but `profile.email`, once saved, is available to public API readers. Empty `cvUrl` allows the frontend to use its printable `/cv` route without a new backend endpoint or an outdated PDF fallback.

`profile.portraitUrl` is an optional string defaulting to `""`, using the same safe URL rules as `cvUrl`. The admin can explicitly select/upload an approved portrait and save the returned URL through the usual full payload PUT. There is no automatic fallback from `pages.home.imageUrl`; that legacy page photo remains stored separately. Explicitly clearing `portraitUrl` keeps it empty on subsequent reads and saves.

`profile.academicStatus` and `profile.availability` are explicit public strings, defaulting to `""`. They are never inferred from degree dates or authentication settings. Their addition does not seed new claims, selected ranks or programme names into live Redis. Publishing code, applying an approved content plan and browser verification remain separate steps.

Placement and output fields use these exact values:

| Field | Allowed Values | Missing Legacy Value |
| --- | --- | --- |
| `jobs.category` | `research`, `industry`, `teaching` | Approved title rule, otherwise `industry` |
| `projects.category` | `research`, `software`, `data`, `coursework`, `other` | Approved report names, otherwise `other` |
| `projects.outputType` | `""`, `report`, `preprint`, `manuscript`, `article`, `dataset`, `software`, `other` | Approved reports use `report`; otherwise `""` |
| `projects.status` | `""`, `in-progress`, `in-preparation`, `preprint`, `published`, `completed` | Approved reports use `completed`; otherwise `""` |
| `education.status` | `in-progress`, `completed`, `not-completed`, `""` | `""` |
| `research.thesisStatus` | `""`, `in-progress`, `in-preparation`, `completed` | Absent research object uses `in-progress`; otherwise `""` |

`projects.contribution` is a string, defaulting to `""`. `projects.relatedRoleIds` is an ordered string array, defaulting to `[]`; each ID must reference a job in the same complete PUT payload. Remove/update these references when deleting a related role. Duplicate references are normalized once in first-occurrence order. Invalid supplied enum values, duplicate IDs, malformed relationship arrays and dangling relationships return 400 with the existing admin CORS headers.

Legacy jobs use whole-word `Research` in the title to migrate to `research`, then whole-word `Tutor` or `teaching` to migrate to `teaching`; other titles migrate to `industry`. Legacy projects migrate to `research` / `report` / `completed` only for these exact names:

- `Report on Reflectometry`
- `Disruption Studies on the COMPASS Tokamak`
- `Automatic Data Control and Acquisition for the Study of Electrical Susceptibility and Thermally Stimulated Currents in Ceramics and Polarizable Films`

Explicit categories, statuses and output types override these migration defaults. Empty project `outputType` and `status` mean "Not specified" and are valid on PUT/GET, including for approved reports. Only omitted fields on the three exact legacy reports migrate to `report`/`completed`. Other legacy projects receive empty output/status fields; historical software is never automatically labeled "in preparation". Unknown stored output/status values normalize to empty strings, while invalid supplied enum values on PUT return 400. Categories do not allow an empty string. Renaming subsequently uses the persisted category instead of the title. Generic coursework is not classified as original research. A manuscript explicitly being prepared must retain `status: "in-preparation"`; artifact release versions do not establish publication status. Recent paper metadata must be verified before an administrator saves or seeds it. Education completion or awards are never inferred from dates or degree titles.

Job/project `id` values persist through rename and save. Legacy IDs are deterministic SHA-256-derived strings (`job-<24 hex digits>` / `project-<24 hex digits>`) computed from the initial title/company/start/end or name/dateOfCompletion. No random IDs or storage writes occur on GET. Identical legacy records receive deterministic numeric suffixes to keep IDs unique. Save the returned IDs once and always send them back on subsequent edits; deleting an ID and changing its original identifying fields generates a new identity. Frontends may create new IDs themselves using UUIDs. IDs may contain letters, digits, dots, underscores, colons or hyphens, begin with a letter/digit, and contain at most 128 characters. An omitted/empty new ID is generated by the backend. GET/PUT output retains contributors, affiliations, contribution and same-index media metadata when categories/IDs are migrated.

Public `profile.cvUrl`, `profile.portraitUrl`, page `imageUrl`, rich `imageUrls` and project `links` accept HTTP(S) URLs or safe relative asset paths such as `/assets/cv.pdf` and `./images/photo.jpg`. Executable schemes (`javascript:`, `data:`, etc.), protocol-relative URLs, embedded credentials, backslashes and control characters are rejected on PUT. Reads sanitize unsafe legacy values; when a rich URL is removed its metadata row is removed with it. URLs identify assets relative to the frontend origin when the frontend renders them. Public email is optional and, when nonempty, must be an explicit address.

`projects.authors` is an ordered string-array byline, default `[]`, distinct from `collaborators`. Omitted existing bylines are retained by stable ID for older admin saves; unsupported ID-less omissions return 400 before writing, while explicit `authors: []` clears the byline. Skill labels use reviewed aliases and stable deduplication on GET/PUT; new unknown skills remain valid. Thesis methods/interests use synonyms only.

The local seed now includes four verified preprints and one manuscript in preparation. Content is added only by an explicit migration, never automatically on GET or PUT. See [the research content audit and migration guide](docs/research-content-migration.md) for source metadata, first/latest dates, preserved content, skills counts, review hashes, backups and the one-time ledger. The live migration operates on the current raw Redis value; never replace it with the older local seed.

The [academic website review](docs/academic-review-migration.md) adds optional public `research.thesisSupervisor` text and documents verified contributions, thesis context, Fusion-EP coursework status and research-facing course previews. Older admin saves omitting the supervisor retain it; an explicit empty string clears it. `thesisEnd` may be a submission deadline, not evidence of completion. The explicit review migration preserves IDs, categories, skills and ordered media; it requires full raw backups, reviewed source/candidate hashes and its own CAS ledger. It never runs on GET/PUT or replaces live data with the local seed.

The separate [reviewed LinkedIn content update](docs/linkedin-content-migration.md) adds four verified industry roles and narrowly scoped factual corrections. `npm run migrate:linkedin -- --dry-run` previews the current raw Redis value; application requires a reviewed hash, full backups and its own one-time ledger. Existing role IDs/categories are pinned before title changes; papers, thesis, skills and ordered media stay intact. Ongoing jobs use `end: "Present"`; education has a separate optional status, and provisional marks do not establish degree completion. This command never seeds on GET/PUT or replaces live content from a file input.

The separately requested [existing-role description update](docs/linkedin-role-descriptions-migration.md) changes only the thirteen original `jobs[].duties` arrays. `npm run migrate:role-descriptions -- --dry-run` uses a distinct ledger and previews both source/candidate hashes; apply requires both reviewed hashes and complete backups. All other fields, job order and four newer roles stay intact. The existing admin editor and role dialogs already support these ordered string arrays, so no API/frontend changes or redeployment are needed.

The separate [reviewed media recovery workflow](docs/media-recovery.md) stages only selected hash-pinned files without ImageKit library listing, then prepares an independently reviewed media-only Redis candidate. It keeps URL/title/description/backup arrays aligned, preserves working ImageKit URLs and all non-media content, archives retired tuples, and requires full raw backups plus both review hashes and CAS before any separately approved application. Private assets, manifests and receipts remain under ignored `private-content/`; uploading alone never saves portfolio data.

The later [workplace maps and building-photo update](docs/workplace-content-migration.md) is independently scoped to reviewed `mapLocation` strings and appended image tuples on jobs/education only. It preserves all existing media and non-media facts, distinguishes remote organisation-city context from a physical workplace, verifies historical locations and photo licences, and uses complete raw backups, source/candidate hashes, CAS and its own ledger. No backend deployment or endpoint change is required for this content update; an unverified physical office is never filled with a logo or unrelated stock photo.

The separately authorized [website editorial review](docs/website-review-migration.md) applies confirmed academic facts, selected positions, programme grouping, shorter copy, role relationships and repeated-tag curation. It preserves every distinct skill, record, primary media URL, full image credit, byline and publication status. `node scripts/migrate-website-review.js` previews an explicitly reviewed private plan; applying requires both exact hashes, a full raw backup, deployed-schema verification and a fresh independent CAS ledger. It never runs on GET/PUT or during deployment.

## Project Layout

```text
data/portfolio.json                 Local JSON content source
netlify/functions/portfolio-data.js Netlify Function handler
src/auth/authService.js             Auth service for future write endpoints
src/admin/                          Cookie sessions, credentials, CSRF, rate limits
src/services/portfolioService.js    API-facing portfolio service
src/media/imageKitMediaService.js   ImageKit browser upload auth service
src/media/stageImageKitAssets.js    Selected-asset maintenance upload library
src/content/                       Reviewed content planners and shared Redis CAS
src/storage/jsonPortfolioStore.js   Local JSON storage adapter
src/storage/redisPortfolioStore.js  Upstash Redis storage adapter
src/validation/portfolioData.js     Payload normalization
src/validation/academicMetadata.js Academic defaults, identity and placement
src/validation/publicUrl.js         Public asset URL safety
scripts/migrate-redis.js            Dry-run-first Redis contract migration
scripts/migrate-content.js          One-time research/skills migration
scripts/migrate-linkedin-content.js Historical roles and duties-only migrations
scripts/migrate-academic-review.js  Evidence-scoped academic review migration
scripts/migrate-website-review.js   Separately guarded website editorial review
test/                              Node test suite
```

The function depends on the service layer, and the service depends on a storage adapter. Use `PORTFOLIO_STORE=json` for local JSON, or `PORTFOLIO_STORE=redis` to read the payload from Upstash Redis.

## Maintenance Tools

The [maintenance guide](docs/maintenance-tools.md) indexes all migration and selected-upload tools, their independent ledgers, preview commands, review requirements and release checks. They are explicitly invoked tools, not Netlify endpoints, startup hooks or build steps. `npm test` never uploads media or writes live Redis. Publishing the tools does not replay earlier migrations or change portfolio content.

Only the boolean `dryRun: false` enables the shared content runner's write path; non-boolean values are rejected before Redis access. Apply still requires the reviewed source hash, full original backup and deployment verification; the media, workplace, role-description and academic-review wrappers additionally require the reviewed candidate hash. Never delete an applied ledger to replay an old patch against later edits.

Keep `.env`, all local `.env.*` files and `private-content/` outside commits and deployment inputs. Only the placeholder `.env.example` is allowed in Git. Release from a reviewed clean checkout, not this workspace's private source/backup tree; Git ignore rules are not a substitute for checking a manual deployment's publish directory. Historical rollout counts and receipts in the guides describe those specific updates, not a fresh live audit.

## Environment Variables

Copy `.env.example` to `.env` for local development.

```text
FRONTEND_ORIGIN=http://localhost:3000
ADMIN_FRONTEND_ORIGIN=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=replace-with-bcrypt-password-hash
AUTH_JWT_SECRET=replace-with-a-long-random-secret
ADMIN_API_KEY=replace-with-a-long-random-api-key
PORTFOLIO_STORE=json
PORTFOLIO_REDIS_KEY=portfolio:data
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=replace-with-your-upstash-token
IMAGEKIT_PRIVATE_KEY=replace-with-your-imagekit-private-key
IMAGEKIT_PUBLIC_KEY=replace-with-your-imagekit-public-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id/
IMAGEKIT_MEDIA_FOLDER=/Portfolio-Website
IMAGEKIT_FILES_FOLDER=/Portfolio-Website
IMAGEKIT_PHOTOS_FOLDER=/Portfolio-Website/Photos
IMAGEKIT_SNIPPETS_FOLDER=/Portfolio-Website/Snippets
```

`FRONTEND_ORIGIN` controls CORS. If it is not set, the function returns `Access-Control-Allow-Origin: *`.

`AUTH_JWT_SECRET` and `ADMIN_API_KEY` are not needed for public GET requests. They are used to protect future non-GET operations.

`AUTH_JWT_SECRET` also signs admin session cookies. Use a long random value and keep it only in Netlify environment variables.

Create an admin password hash locally:

```bash
npm run hash:password
```

Set the printed bcrypt hash as `ADMIN_PASSWORD_HASH` in Netlify. Do not put the plain password in the repo or frontend.

## ImageKit Uploads

ImageKit is used only as the authenticated upload target for admin files and images. The backend does not expose endpoints that list ImageKit folders or reveal what files exist in the ImageKit account. The frontend should read existing asset URLs from `GET admin-portfolio-data`, upload new assets through ImageKit when needed, then save the returned public URL in the normal portfolio payload with `PUT admin-portfolio-data`.

Required Netlify variables:

```text
IMAGEKIT_PRIVATE_KEY=your-imagekit-private-api-key
IMAGEKIT_PUBLIC_KEY=your-imagekit-public-api-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id/
```

Recommended folder variables:

```text
IMAGEKIT_MEDIA_FOLDER=/Portfolio-Website
IMAGEKIT_FILES_FOLDER=/Portfolio-Website
IMAGEKIT_PHOTOS_FOLDER=/Portfolio-Website/Photos
IMAGEKIT_SNIPPETS_FOLDER=/Portfolio-Website/Snippets
```

Use an ImageKit key with the least permissions that support browser upload authentication. The private key must stay only in Netlify/backend environment variables. The public key may be returned to authenticated admin clients for ImageKit browser uploads.

Changing Netlify function environment values requires a successful deployment to activate them. Keep `npm test` as the deployment gate. Folder changes affect only new uploads; do not move or rename existing files or rewrite working stored URLs.

Upload flow:

```text
1. Admin frontend calls GET admin-imagekit-upload-auth?target=files|photos|snippets with credentials included.
2. Backend validates the admin session cookie and returns short-lived ImageKit upload parameters.
3. Frontend uploads the selected File directly to ImageKit using those parameters.
4. ImageKit returns the public asset URL.
5. Frontend places that URL beside its description and backup description in local edit state.
6. Frontend saves the complete portfolio payload with PUT admin-portfolio-data and X-CSRF-Token.
7. Backend normalizes and writes the full payload to Redis.
```

Do not add ImageKit listing endpoints to the frontend. Redis is the source of truth for which links are attached to the portfolio.

## Upstash Redis

Upstash is a good Redis choice for Netlify Functions because its official JavaScript client uses HTTP instead of persistent TCP connections.

1. Log in to Upstash.
2. Create a Redis database.
3. Open the database's REST API or connection section.
4. Copy `UPSTASH_REDIS_REST_URL`.
5. Copy `UPSTASH_REDIS_REST_TOKEN`.
6. Add these Netlify environment variables:

```text
PORTFOLIO_STORE=redis
PORTFOLIO_REDIS_KEY=portfolio:data
UPSTASH_REDIS_REST_URL=your-upstash-rest-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

Seed Redis from the local JSON file:

```bash
UPSTASH_REDIS_REST_URL=your-upstash-rest-url UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token npm run seed:redis
```

Preview normalization of the current Redis value after a contract change (one read, no writes):

```bash
UPSTASH_REDIS_REST_URL=your-upstash-rest-url UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token npm run migrate:redis -- --dry-run
```

On Windows PowerShell:

```powershell
$env:UPSTASH_REDIS_REST_URL="your-upstash-rest-url"
$env:UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"
npm run seed:redis
```

For the read-only Redis migration preview on Windows PowerShell, use the same environment variables and run:

```powershell
npm run migrate:redis -- --dry-run
```

Plain `npm run migrate:redis` also defaults to dry run. The command prints generated IDs/categories/statuses and whether content would change, without printing contact data, credentials or the entire payload. Preview a local snapshot without Redis credentials or network access:

```powershell
npm run migrate:redis -- --dry-run --input data/portfolio.json
npm run migrate:redis -- --dry-run --input private-content/portfolio-snapshot.json
```

Use a noncommitted complete JSON snapshot for private content review. General schema `migrate:redis --input` is preview-only and cannot be combined with `--apply`; publish reviewed contact/content through authenticated admin PUT. The tracked JSON includes explicitly reviewed research additions; seeding normalizes it but replaces the entire Redis payload. Do not reseed an edited live portfolio. The dedicated `migrate:content` command provides a separate narrowly scoped, hash-checked and backed-up content migration with a persistent ledger.

When separately authorized to persist the migration, pause concurrent admin edits, inspect the dry run, then explicitly run:

```powershell
npm run migrate:redis -- --apply
```

Apply writes the original value to `portfolio:data:backup:<ISO timestamp>` (using your configured key prefix) before a single Redis SET replaces the portfolio value. It stops before writing if normalized relationships fail validation. A repeat on already normalized content performs no writes. Review or remove the backup later; it contains the previous public content. The backup and replacement are separate commands, so schedule apply while admin editing is paused.

Deployment and persistent migration are separate: GET will normalize legacy data without writing it once this backend is deployed. A complete authenticated admin save can also persist the returned IDs and new fields. This change introduces no new endpoint or environment variable.

After seeding or migrating, the public endpoint stays the same. Data-only Redis changes are available to the next function request.

Netlify secret scanning is configured to ignore public config strings such as origins, admin email, `PORTFOLIO_STORE`, `PORTFOLIO_REDIS_KEY`, and `UPSTASH_REDIS_REST_URL`. Real secrets such as `ADMIN_PASSWORD_HASH`, `UPSTASH_REDIS_REST_TOKEN`, `AUTH_JWT_SECRET`, and `ADMIN_API_KEY` are still scanned.

## Local Development

Install dependencies:

```bash
npm install
```

Run the Netlify local dev server:

```bash
npm run dev
```

Then fetch:

```bash
curl http://localhost:8888/.netlify/functions/portfolio-data
```

If Netlify CLI is unavailable or an old local `.env` is fighting the port, use the dependency-free local runner instead:

```bash
npm run dev:local
curl http://localhost:8788/.netlify/functions/portfolio-data
```

## Tests

Academic review coverage includes optional supervisor validation/read/write, legacy omission preservation and explicit clearing, unchanged cookie/CORS/CSRF enforcement, evidence-scoped content patches, complete course/activities preservation, aligned links, untouched image tuples, raw backups, exact review hashes, concurrent-edit rejection and ledger no-op repeats. See [the academic review guide](docs/academic-review-migration.md) for factual evidence and guarded migration steps.

Editorial metadata coverage includes empty academic status/availability defaults, supported and rejected ranks, input-only null clearing, exact education-period matching, ambiguity rejection, stable IDs through renames, unchanged chronological ordering, same-index media preservation, legacy omission retention and authenticated PUT-to-public GET round trips. See [the editorial contract guide](docs/editorial-metadata.md). No live content migration is run by these tests or by deployment.

```bash
npm test
```

The tests cover legacy/new academic payloads, conservative defaults, explicit empty/null normalization, optional project editorial fields, shared thesis status values, deterministic IDs and rename stability, relationships and contributors, safe URLs, ordered image/file metadata arrays, dry-run migration and backup behavior, and full frontend payload PUT-to-public GET using mocked Redis. LinkedIn update tests additionally enforce its exact factual field scope, identity/category pinning, ongoing/month-precision dates, provisional education status, separate migration ledger, complete backups and hash/concurrent-edit protection. Duties-only tests also prove raw field/job-order preservation, stable computed IDs and independent source/candidate guards. Existing cookie/CORS/CSRF, login rate limiting, ImageKit upload authentication and local JSON/storage tests remain included. Redis tests and migration applies use mocks; the suite does not write live Redis. There is no separate lint or build script in this package.

Selected-asset staging and media-recovery tests additionally cover source/receipt hashes, decoded MIME types, non-overwrite/resume safety, secret omission, animation frames, full media-only field scope, same-index metadata, explicit empty captions, protected URLs, stale indexes, complete backups, concurrent edits and the separate media ledger. ImageKit fixtures inject every folder option and include an incompatible-ambient-env regression so production environment values do not change test assumptions.

## Deploying To Netlify

1. Push this repository to GitHub.
2. Create a new Netlify site from the repository.
3. Set the build command to `npm test` so tests gate function packaging/deployment.
4. Set the functions directory to `netlify/functions`; this is already configured in `netlify.toml`.
5. Add environment variables in Netlify site settings:
   - `FRONTEND_ORIGIN`
   - `ADMIN_FRONTEND_ORIGIN`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD_HASH`
   - `AUTH_JWT_SECRET`
   - `ADMIN_API_KEY`
   - `PORTFOLIO_STORE`
   - `PORTFOLIO_REDIS_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `IMAGEKIT_PRIVATE_KEY`
   - `IMAGEKIT_PUBLIC_KEY`
   - `IMAGEKIT_URL_ENDPOINT`
   - `IMAGEKIT_MEDIA_FOLDER`
   - `IMAGEKIT_FILES_FOLDER`
   - `IMAGEKIT_PHOTOS_FOLDER`
   - `IMAGEKIT_SNIPPETS_FOLDER`

After deploy, the endpoint will be available at:

```text
https://your-site.netlify.app/.netlify/functions/portfolio-data
```
