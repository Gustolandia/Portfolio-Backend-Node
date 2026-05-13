import { createAdminCredentialService } from "../../src/admin/adminCredentialService.js";
import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import {
  createLoginRateLimiter,
  loginRateLimitKey
} from "../../src/admin/loginRateLimiter.js";
import { adminEmptyResponse, adminJsonResponse } from "../../src/http/adminResponses.js";
import { getMethod, parseJsonBody } from "../../src/http/request.js";

const ALLOWED_METHODS = "POST, OPTIONS";

export function createHandler({
  credentialService = createAdminCredentialService(),
  rateLimiter = createLoginRateLimiter(),
  sessionService = createAdminSessionService()
} = {}) {
  return async function adminLoginHandler(event = {}) {
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

    let body;

    try {
      body = parseJsonBody(event);
    } catch {
      return adminJsonResponse(event, 400, {
        error: "Invalid JSON body"
      });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rateLimitResult = await rateLimiter.consume(loginRateLimitKey(event, email));

    if (!rateLimitResult.allowed) {
      return adminJsonResponse(
        event,
        429,
        {
          error: "Too many login attempts"
        },
        {
          "Retry-After": String(rateLimitResult.retryAfterSeconds)
        }
      );
    }

    const authResult = await credentialService.validateCredentials({
      email,
      password
    });

    if (!authResult.authenticated) {
      return adminJsonResponse(event, 401, {
        authenticated: false
      });
    }

    const session = await sessionService.createSession(authResult.user);

    return adminJsonResponse(
      event,
      200,
      {
        authenticated: true,
        csrfToken: session.csrfToken,
        user: session.user
      },
      {
        "Set-Cookie": session.cookie
      }
    );
  };
}

export const handler = createHandler();
