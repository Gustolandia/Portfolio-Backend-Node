function configuredAdminOrigins() {
  return (process.env.ADMIN_FRONTEND_ORIGIN || process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function adminCorsHeaders(event = {}, extraHeaders = {}) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  const allowedOrigins = configuredAdminOrigins();
  const allowedOrigin = allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0];
  const headers = {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...extraHeaders
  };

  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

export function adminEmptyResponse(event, statusCode = 204, headers = {}) {
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
