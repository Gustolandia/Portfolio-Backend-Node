import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { createAdminFunction } from "../../src/http/adminFunction.js";
import { adminJsonResponse } from "../../src/http/adminResponses.js";

export function createHandler({ logger = console, sessionService = createAdminSessionService() } = {}) {
  return createAdminFunction({
    allowedMethods: ["POST"],
    logger,
    handler: async (event) => {
      const session = await sessionService.readSession(event);

      if (!session.authenticated) {
        return adminJsonResponse(event, 401, {
          authenticated: false
        });
      }

      if (!sessionService.validateCsrfToken(event, session)) {
        return adminJsonResponse(event, 403, {
          error: "Invalid CSRF token"
        });
      }

      return adminJsonResponse(
        event,
        200,
        {
          ok: true
        },
        {
          "Set-Cookie": sessionService.clearSessionCookie()
        }
      );
    }
  });
}

export const handler = createHandler();
