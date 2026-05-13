# Portfolio Backend

Small Netlify Functions backend for a React portfolio website. It serves all portfolio content as one JSON payload so the frontend can fetch once at startup and keep the data in browser memory.

## Endpoint

```text
GET /.netlify/functions/portfolio-data
```

`GET` is public. Any non-GET request is authenticated first with either `Authorization: Bearer <jwt>` or `X-API-Key: <key>`, then rejected with `405 Method Not Allowed` until write endpoints are added.

## Project Layout

```text
data/portfolio.json                 Local JSON content source
netlify/functions/portfolio-data.js Netlify Function handler
src/auth/authService.js             Auth service for future write endpoints
src/services/portfolioService.js    API-facing portfolio service
src/storage/jsonPortfolioStore.js   Local JSON storage adapter
src/validation/portfolioData.js     Payload normalization
test/                              Node test suite
```

The function depends on the service layer, and the service depends on a storage adapter. To move from local JSON to Redis or another hosted KV later, add a new storage adapter with `getPortfolioData()` and wire it in without changing the function handler.

## Environment Variables

Copy `.env.example` to `.env` for local development.

```text
FRONTEND_ORIGIN=http://localhost:3000
AUTH_JWT_SECRET=replace-with-a-long-random-secret
ADMIN_API_KEY=replace-with-a-long-random-api-key
```

`FRONTEND_ORIGIN` controls CORS. If it is not set, the function returns `Access-Control-Allow-Origin: *`.

`AUTH_JWT_SECRET` and `ADMIN_API_KEY` are not needed for public GET requests. They are used to protect future non-GET operations.

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
   - `AUTH_JWT_SECRET`
   - `ADMIN_API_KEY`

After deploy, the endpoint will be available at:

```text
https://your-site.netlify.app/.netlify/functions/portfolio-data
```
