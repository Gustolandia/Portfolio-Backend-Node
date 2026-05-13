import { createAdminCredentialService } from "../../src/admin/adminCredentialService.js";
import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import {
  createLoginRateLimiter,
  loginRateLimitKey
} from "../../src/admin/loginRateLimiter.js";
import { createAdminFunction } from "../../src/http/adminFunction.js";
import { adminJsonResponse } from "../../src/http/adminResponses.js";
import { parseJsonBody } from "../../src/http/request.js";

export function createHandler({
  credentialService = createAdminCredentialService(),
  rateLimiter = createLoginRateLimiter(),
  sessionService = createAdminSessionService(),
  logger = console
} = {}) {
  return createAdminFunction({
    allowedMethods: ["POST"],
    logger,
    handler: async (event) => {
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
    }
  });
}

export const handler = createHandler();
