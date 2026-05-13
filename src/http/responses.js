export function corsHeaders(extraHeaders = {}) {
  const allowedOrigin = process.env.FRONTEND_ORIGIN?.trim() || "*";

  return {
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
    "Access-Control-Allow-Methods": "GET, OPTIONS, POST, PUT, PATCH, DELETE",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
    ...extraHeaders
  };
}

export function emptyResponse(statusCode = 204, headers = {}) {
  return {
    statusCode,
    headers: corsHeaders(headers),
    body: ""
  };
}

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: corsHeaders({
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }),
    body: JSON.stringify(body)
  };
}
