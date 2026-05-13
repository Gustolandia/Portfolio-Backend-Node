export const DEFAULT_ADMIN_ALLOWED_ORIGINS = Object.freeze([
  "http://localhost:3000",
  "https://gustavopedroricou.netlify.app",
  "https://gustavopedroricou.com",
  "https://www.gustavopedroricou.com"
]);

function configuredAdminOrigins() {
  const configuredOrigins = (process.env.ADMIN_FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_ADMIN_ALLOWED_ORIGINS, ...configuredOrigins])];
}

export function isAdminOriginAllowed(event = {}) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;

  return configuredAdminOrigins().includes(requestOrigin);
}

export function adminCorsHeaders(event = {}, extraHeaders = {}) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigins = configuredAdminOrigins();

  if (!allowedOrigins.includes(requestOrigin)) {
    return {
      Vary: "Origin",
      ...extraHeaders
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...extraHeaders
  };

  return headers;
}

export function adminEmptyResponse(event, statusCode = 204, headers = {}) {
  if (statusCode === 204 && !isAdminOriginAllowed(event)) {
    return {
      statusCode: 403,
      headers: {
        Vary: "Origin"
      },
      body: ""
    };
  }

  return {
    statusCode,
    headers: adminCorsHeaders(event, headers),
    body: ""
  };
}

export function adminJsonResponse(event, statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: adminCorsHeaders(event, {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }),
    body: JSON.stringify(body)
  };
}

export function adminErrorResponse(event, error, logger = console) {
  logger.error?.("Admin function failed", error);

  return adminJsonResponse(event, 500, {
    error: "Internal Server Error"
  });
}
