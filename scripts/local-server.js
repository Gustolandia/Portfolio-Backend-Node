import http from "node:http";
import { handler } from "../netlify/functions/portfolio-data.js";

const port = Number(process.env.PORT || 8788);
const functionPath = "/.netlify/functions/portfolio-data";

function readBody(request) {
  const hasRequestBody =
    Number(request.headers["content-length"] || 0) > 0 || request.headers["transfer-encoding"];

  if (!hasRequestBody) {
    return Promise.resolve("");
  }

  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname !== functionPath) {
    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "Not Found" }));
    return;
  }

  try {
    const result = await handler({
      body: await readBody(request),
      headers: request.headers,
      httpMethod: request.method,
      path: url.pathname,
      queryStringParameters: Object.fromEntries(url.searchParams)
    });

    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    console.error("Local function runner failed", error);
    response.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({ error: "Internal Server Error" }));
  }
});

server.listen(port, () => {
  console.log(`Portfolio function running at http://localhost:${port}${functionPath}`);
});
