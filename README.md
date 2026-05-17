# Portfolio Backend

Small Netlify Functions backend for a React portfolio website. It serves all portfolio content as one JSON payload so the frontend can fetch once at startup and keep the data in browser memory.

## Endpoint

```text
GET /.netlify/functions/portfolio-data
```

`GET` is public. Any non-GET request is authenticated first with either `Authorization: Bearer <jwt>` or `X-API-Key: <key>`, then rejected with `405 Method Not Allowed` until write endpoints are added.

## Admin Endpoints

Admin requests use secure HttpOnly cookie sessions. The admin frontend should use `credentials: "include"` for every admin request and should send `X-CSRF-Token` for unsafe requests after login/session returns a token.

```text
POST /.netlify/functions/admin-login
GET  /.netlify/functions/admin-session
POST /.netlify/functions/admin-logout
GET  /.netlify/functions/admin-files
GET  /.netlify/functions/admin-imagekit-upload-auth
GET  /.netlify/functions/admin-photos
GET  /.netlify/functions/admin-snippets
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

`admin-files`, `admin-photos`, and `admin-snippets` read from ImageKit Media Library with server-side credentials. `admin-imagekit-upload-auth` returns short-lived ImageKit browser upload credentials. These endpoints require the admin session cookie but do not require CSRF because they are read-only `GET` endpoints.

```text
GET /.netlify/functions/admin-files
GET /.netlify/functions/admin-imagekit-upload-auth
GET /.netlify/functions/admin-photos
GET /.netlify/functions/admin-snippets
```

Optional query parameters:

```text
path=/Portfolio Website/Photos
folder=Photos
limit=100
skip=0
sort=ASC_CREATED
```

`path` accepts an absolute ImageKit Media Library path inside `IMAGEKIT_MEDIA_FOLDER`. `folder` accepts a path relative to `IMAGEKIT_MEDIA_FOLDER`. `admin-files` defaults to `IMAGEKIT_FILES_FOLDER` and filters with `fileType=non-image`. `admin-photos` defaults to `IMAGEKIT_PHOTOS_FOLDER` and filters with `fileType=image`. `admin-snippets` defaults to `IMAGEKIT_SNIPPETS_FOLDER` and filters with `fileType=image`. In this portfolio, general photos live in `/Portfolio Website/Photos`, project snippet images live in `/Portfolio Website/Snippets`, and PDFs, videos, and other non-image files live directly under `/Portfolio Website`. Returned asset objects include public metadata such as `fileId`, `name`, `filePath`, `url`, `thumbnailUrl`, `fileType`, `mime`, `size`, `width`, `height`, `createdAt`, and `updatedAt`; ImageKit credentials are never returned.

For direct uploads from the admin frontend, call:

```text
GET /.netlify/functions/admin-imagekit-upload-auth?target=photos
GET /.netlify/functions/admin-imagekit-upload-auth?target=snippets
GET /.netlify/functions/admin-imagekit-upload-auth?target=files
```

The response contains `token`, `expire`, `signature`, `publicKey`, `urlEndpoint`, `uploadEndpoint`, `folder`, and `folders`. The frontend sends those values plus the selected `File` to ImageKit's browser upload API. ImageKit returns the public asset URL; the frontend then saves that URL in the normal portfolio payload with `PUT admin-portfolio-data`, which persists it to Redis.

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
  "projects": []
}
```

`duration` is deprecated and removed from backend responses and saves. Jobs and education should use `start` and `end` only. Projects use `dateOfCompletion`.

Jobs are normalized to these fields only:

```text
title, company, location, start, end, imageUrls, imageTitles, duties, skills, mapLocation
```

Education entries are normalized to these fields only:

```text
degree, institution, location, grade, start, end, imageUrls, imageTitles, courses, activities, skills, mapLocation
```

Projects are normalized to these fields only:

```text
name, dateOfCompletion, description, imageUrls, affiliations, collaborators, skills, links, linksTitles
```

Missing string fields become `""`, missing array fields become `[]`, and unsupported rich-item fields are discarded. Jobs and education are sorted by latest `end` date first, falling back to `start`. Projects are sorted by latest `dateOfCompletion` first.

Image URLs and image titles are normalized as paired arrays. If an invalid or empty `imageUrls[index]` is discarded, the corresponding `imageTitles[index]` is discarded too, keeping each image associated with its matching description/title. The same pairing rule applies to `links` and `linksTitles`.

## Project Layout

```text
data/portfolio.json                 Local JSON content source
netlify/functions/portfolio-data.js Netlify Function handler
src/auth/authService.js             Auth service for future write endpoints
src/admin/                          Cookie sessions, credentials, CSRF, rate limits
src/services/portfolioService.js    API-facing portfolio service
src/media/imageKitMediaService.js   ImageKit Media Library adapter
src/storage/jsonPortfolioStore.js   Local JSON storage adapter
src/storage/redisPortfolioStore.js  Upstash Redis storage adapter
src/validation/portfolioData.js     Payload normalization
test/                              Node test suite
```

The function depends on the service layer, and the service depends on a storage adapter. Use `PORTFOLIO_STORE=json` for local JSON, or `PORTFOLIO_STORE=redis` to read the payload from Upstash Redis.

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
IMAGEKIT_MEDIA_FOLDER=/Portfolio Website
IMAGEKIT_FILES_FOLDER=/Portfolio Website
IMAGEKIT_PHOTOS_FOLDER=/Portfolio Website/Photos
IMAGEKIT_SNIPPETS_FOLDER=/Portfolio Website/Snippets
```

`FRONTEND_ORIGIN` controls CORS. If it is not set, the function returns `Access-Control-Allow-Origin: *`.

`AUTH_JWT_SECRET` and `ADMIN_API_KEY` are not needed for public GET requests. They are used to protect future non-GET operations.

`AUTH_JWT_SECRET` also signs admin session cookies. Use a long random value and keep it only in Netlify environment variables.

Create an admin password hash locally:

```bash
npm run hash:password
```

Set the printed bcrypt hash as `ADMIN_PASSWORD_HASH` in Netlify. Do not put the plain password in the repo or frontend.

## ImageKit Media Library

ImageKit acts as the media CMS for admin asset selection. Upload and organize assets in ImageKit, then use the admin media endpoints to list selectable images and files from the configured folders. Store the selected asset URL in the portfolio payload, keeping the existing simple `imageUrl`, `imageUrls`, `links`, and title arrays.

Required Netlify variables:

```text
IMAGEKIT_PRIVATE_KEY=your-imagekit-private-api-key
IMAGEKIT_PUBLIC_KEY=your-imagekit-public-api-key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your-imagekit-id/
```

Recommended folder variables:

```text
IMAGEKIT_MEDIA_FOLDER=/Portfolio Website
IMAGEKIT_FILES_FOLDER=/Portfolio Website
IMAGEKIT_PHOTOS_FOLDER=/Portfolio Website/Photos
IMAGEKIT_SNIPPETS_FOLDER=/Portfolio Website/Snippets
```

Use an ImageKit restricted API key with the least permissions that support listing and uploading media. The private key must stay only in Netlify/backend environment variables. The public key may be returned to authenticated admin clients for ImageKit browser uploads. The older `admin-images` endpoint is kept as a compatibility alias for snippets; new frontend work should use the explicit `admin-photos` and `admin-snippets` endpoints.

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

Normalize the current Redis value in place after a data-contract change:

```bash
UPSTASH_REDIS_REST_URL=your-upstash-rest-url UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token npm run migrate:redis
```

On Windows PowerShell:

```powershell
$env:UPSTASH_REDIS_REST_URL="your-upstash-rest-url"
$env:UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"
npm run seed:redis
```

For an in-place Redis migration on Windows PowerShell, use the same environment variables and run:

```powershell
npm run migrate:redis
```

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

```bash
npm test
```

The tests cover the Netlify Function behavior, local JSON storage, service normalization and ordering, auth service, and the public data shape.

## Deploying To Netlify

1. Push this repository to GitHub.
2. Create a new Netlify site from the repository.
3. Leave the build command empty unless you add a frontend later.
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
