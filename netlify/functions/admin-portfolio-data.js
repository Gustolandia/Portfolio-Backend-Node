import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import {
  adminEmptyResponse,
  adminErrorResponse,
  adminJsonResponse
} from "../../src/http/adminResponses.js";
import { getMethod, parseJsonBody } from "../../src/http/request.js";
import { createPortfolioService } from "../../src/services/portfolioService.js";

const ALLOWED_METHODS = "GET, PUT, OPTIONS";

export function createHandler({
  logger = console,
  portfolioService = createPortfolioService(),
  sessionService = createAdminSessionService()
} = {}) {
  return async function adminPortfolioDataHandler(event = {}) {
    try {
      const method = getMethod(event);

      if (method === "OPTIONS") {
        return adminEmptyResponse(event, 204, {
          Allow: ALLOWED_METHODS
        });
      }

      if (!["GET", "PUT"].includes(method)) {
        return adminJsonResponse(
          event,
          405,
          {
            error: "Method Not Allowed"
          },
          {
            Allow: ALLOWED_METHODS
          }
        );
      }

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

      const savedPortfolioData = await portfolioService.updatePortfolioData(body);

      return adminJsonResponse(event, 200, savedPortfolioData);
    } catch (error) {
      return adminErrorResponse(event, error, logger);
    }
  };
}

export const handler = createHandler();
