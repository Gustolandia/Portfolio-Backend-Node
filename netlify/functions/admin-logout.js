import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { adminEmptyResponse, adminJsonResponse } from "../../src/http/adminResponses.js";
import { getMethod } from "../../src/http/request.js";

const ALLOWED_METHODS = "POST, OPTIONS";

export function createHandler({ sessionService = createAdminSessionService() } = {}) {
  return async function adminLogoutHandler(event = {}) {
    const method = getMethod(event);

    if (method === "OPTIONS") {
      return adminEmptyResponse(event, 204, {
        Allow: ALLOWED_METHODS
      });
    }

    if (method !== "POST") {
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
  };
}

export const handler = createHandler();
