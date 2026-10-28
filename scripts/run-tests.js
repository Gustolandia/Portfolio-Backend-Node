import { spawn } from "node:child_process";

// Unit tests supply their own deterministic fixtures. Do not inherit live
// Netlify configuration when the production build invokes `npm test`.
const RUNTIME_ONLY_VARIABLES = [
  "ADMIN_API_KEY",
  "ADMIN_EMAIL",
  "ADMIN_FRONTEND_ORIGIN",
  "ADMIN_PASSWORD_HASH",
  "AUTH_JWT_SECRET",
  "CONTACT_ALLOWED_ORIGINS",
  "FRONTEND_ORIGIN",
  "IMAGEKIT_FILES_FOLDER",
  "IMAGEKIT_IMAGES_FOLDER",
  "IMAGEKIT_MEDIA_FOLDER",
  "IMAGEKIT_PHOTOS_FOLDER",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_SNIPPETS_FOLDER",
  "IMAGEKIT_URL_ENDPOINT",
  "PORTFOLIO_REDIS_KEY",
  "PORTFOLIO_STORE",
  "POSTMAIL_ACCESS_TOKEN",
  "TURNSTILE_ALLOWED_HOSTNAMES",
  "TURNSTILE_EXPECTED_ACTION",
  "TURNSTILE_SECRET_KEY",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL"
];

const environment = { ...process.env };
for (const name of RUNTIME_ONLY_VARIABLES) {
  delete environment[name];
}

const testProcess = spawn(process.execPath, ["--test"], {
  env: environment,
  stdio: "inherit"
});

testProcess.on("error", (error) => {
  console.error("Unable to start the test suite", error);
  process.exitCode = 1;
});

testProcess.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
