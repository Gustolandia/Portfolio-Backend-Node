import { createAuthService } from "../../src/auth/authService.js";
import { emptyResponse, jsonResponse } from "../../src/http/responses.js";
import { getMethod } from "../../src/http/request.js";
import { createPortfolioService } from "../../src/services/portfolioService.js";

const ALLOWED_METHODS = "GET, OPTIONS";

export function createHandler({
  authService = createAuthService(),
  logger = console,
  portfolioService = createPortfolioService()
} = {}) {
  return async function portfolioDataHandler(event = {}) {
    const method = getMethod(event);

    if (method === "OPTIONS") {
      return emptyResponse(204, {
        Allow: ALLOWED_METHODS
      });
    }

    if (method !== "GET") {
      const authResult = await authService.authenticateEvent(event);

      if (!authResult.authenticated) {
        return jsonResponse(
          401,
          {
            error: "Unauthorized",
            message: "GET requests are public. Other methods require a bearer token or X-API-Key."
          },
          {
            Allow: ALLOWED_METHODS,
            "WWW-Authenticate": "Bearer"
          }
        );
      }

      return jsonResponse(
        405,
        {
          error: "Method Not Allowed"
        },
        {
          Allow: ALLOWED_METHODS
        }
      );
    }

    try {
      const portfolioData = await portfolioService.getPortfolioData();

      return jsonResponse(200, portfolioData, {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300"
      });
    } catch (error) {
      logger.error?.("Unable to load portfolio data");

      return jsonResponse(
        500,
        {
          error: "Unable to load portfolio data"
        },
        {
          "Cache-Control": "no-store"
        }
      );
    }
  };
}

export const handler = createHandler();
