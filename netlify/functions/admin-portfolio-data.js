import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { createAdminFunction } from "../../src/http/adminFunction.js";
import { adminJsonResponse } from "../../src/http/adminResponses.js";
import { parseJsonBody } from "../../src/http/request.js";
import { createPortfolioService } from "../../src/services/portfolioService.js";
import { validateCompletePortfolioPayload } from "../../src/validation/portfolioData.js";

export function createHandler({
  logger = console,
  portfolioService = createPortfolioService(),
  sessionService = createAdminSessionService()
} = {}) {
  return createAdminFunction({
    allowedMethods: ["GET", "PUT"],
    logger,
    handler: async (event, method) => {
      const session = await sessionService.readSession(event);

      if (!session.authenticated) {
        return adminJsonResponse(event, 401, {
          authenticated: false
        });
      }

      if (method === "GET") {
        const portfolioData = await portfolioService.getPortfolioData();

        return adminJsonResponse(event, 200, portfolioData);
      }

      if (!sessionService.validateCsrfToken(event, session)) {
        return adminJsonResponse(event, 403, {
          error: "Invalid CSRF token"
        });
      }

      let body;

      try {
        body = parseJsonBody(event);
      } catch {
        return adminJsonResponse(event, 400, {
          error: "Invalid JSON body"
        });
      }

      const validationResult = validateCompletePortfolioPayload(body);

      if (!validationResult.valid) {
        return adminJsonResponse(event, 400, {
          error: "Invalid portfolio payload",
          details: validationResult.errors
        });
      }

      const savedPortfolioData = await portfolioService.updatePortfolioData(body);

      return adminJsonResponse(event, 200, savedPortfolioData);
    }
  });
}

export const handler = createHandler();
