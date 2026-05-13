import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { adminEmptyResponse, adminJsonResponse } from "../../src/http/adminResponses.js";
import { getMethod } from "../../src/http/request.js";

const ALLOWED_METHODS = "GET, OPTIONS";

export function createHandler({ sessionService = createAdminSessionService() } = {}) {
  return async function adminSessionHandler(event = {}) {
    const method = getMethod(event);

    if (method === "OPTIONS") {
      return adminEmptyResponse(event, 204, {
        Allow: ALLOWED_METHODS
      });
    }

    if (method !== "GET") {
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

    return adminJsonResponse(event, 200, {
      authenticated: true,
      csrfToken: session.csrfToken,
      user: session.user
    });
  };
}

export const handler = createHandler();
