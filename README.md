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

## Project Layout

```text
data/portfolio.json                 Local JSON content source
netlify/functions/portfolio-data.js Netlify Function handler
src/auth/authService.js             Auth service for future write endpoints
src/admin/                          Cookie sessions, credentials, CSRF, rate limits
src/services/portfolioService.js    API-facing portfolio service
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
```

`FRONTEND_ORIGIN` controls CORS. If it is not set, the function returns `Access-Control-Allow-Origin: *`.

`AUTH_JWT_SECRET` and `ADMIN_API_KEY` are not needed for public GET requests. They are used to protect future non-GET operations.

`AUTH_JWT_SECRET` also signs admin session cookies. Use a long random value and keep it only in Netlify environment variables.

Create an admin password hash locally:

```bash
npm run hash:password
```

Set the printed bcrypt hash as `ADMIN_PASSWORD_HASH` in Netlify. Do not put the plain password in the repo or frontend.

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

On Windows PowerShell:

```powershell
$env:UPSTASH_REDIS_REST_URL="your-upstash-rest-url"
$env:UPSTASH_REDIS_REST_TOKEN="your-upstash-rest-token"
npm run seed:redis
```

After seeding, trigger a Netlify redeploy. The public endpoint stays the same.

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

The tests cover the Netlify Function behavior, local JSON storage, service normalization, auth service, and the public data shape.

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

After deploy, the endpoint will be available at:

```text
https://your-site.netlify.app/.netlify/functions/portfolio-data
```
