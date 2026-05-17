import http from "node:http";
import { handler as adminFilesHandler } from "../netlify/functions/admin-files.js";
import { handler as adminImagesHandler } from "../netlify/functions/admin-images.js";
import { handler as adminLoginHandler } from "../netlify/functions/admin-login.js";
import { handler as adminLogoutHandler } from "../netlify/functions/admin-logout.js";
import { handler as adminPhotosHandler } from "../netlify/functions/admin-photos.js";
import { handler as adminPortfolioDataHandler } from "../netlify/functions/admin-portfolio-data.js";
import { handler as adminSessionHandler } from "../netlify/functions/admin-session.js";
import { handler as adminSnippetsHandler } from "../netlify/functions/admin-snippets.js";
import { handler as portfolioDataHandler } from "../netlify/functions/portfolio-data.js";

const port = Number(process.env.PORT || 8788);
const functionHandlers = new Map([
  ["/.netlify/functions/admin-files", adminFilesHandler],
  ["/.netlify/functions/admin-images", adminImagesHandler],
  ["/.netlify/functions/admin-login", adminLoginHandler],
  ["/.netlify/functions/admin-logout", adminLogoutHandler],
  ["/.netlify/functions/admin-photos", adminPhotosHandler],
  ["/.netlify/functions/admin-portfolio-data", adminPortfolioDataHandler],
  ["/.netlify/functions/admin-session", adminSessionHandler],
  ["/.netlify/functions/admin-snippets", adminSnippetsHandler],
  ["/.netlify/functions/portfolio-data", portfolioDataHandler]
]);

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
  const handler = functionHandlers.get(url.pathname);

  if (!handler) {
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
  console.log(`Portfolio functions running at http://localhost:${port}/.netlify/functions`);
});
