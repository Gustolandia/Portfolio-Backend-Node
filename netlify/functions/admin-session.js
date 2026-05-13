import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { createAdminFunction } from "../../src/http/adminFunction.js";
import { adminJsonResponse } from "../../src/http/adminResponses.js";

export function createHandler({ logger = console, sessionService = createAdminSessionService() } = {}) {
  return createAdminFunction({
    allowedMethods: ["GET"],
    logger,
    handler: async (event) => {
      const session = await sessionService.readSession(event);

      if (!session.authenticated) {
        return adminJsonResponse(event, 401, {
          authenticated: false
        });
      }

      return adminJsonResponse(event, 200, {
        authenticated: true,
        csrfToken: session.csrfToken,
        user: session.user
      });
    }
  });
}

export const handler = createHandler();
