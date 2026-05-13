export function getMethod(event) {
  return (event?.httpMethod || event?.requestContext?.http?.method || "GET").toUpperCase();
}

export function parseJsonBody(event = {}) {
  if (!event.body) {
    return {};
  }

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  return JSON.parse(body);
}
