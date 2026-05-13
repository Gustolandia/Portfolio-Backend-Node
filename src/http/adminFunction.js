import {
  adminEmptyResponse,
  adminErrorResponse,
  adminJsonResponse
} from "./adminResponses.js";
import { getMethod } from "./request.js";

export function createAdminFunction({
  allowedMethods,
  handler,
  logger = console
}) {
  const allowHeader = [...allowedMethods, "OPTIONS"].join(", ");

  return async function adminFunctionHandler(event = {}) {
    try {
      const method = getMethod(event);

      if (method === "OPTIONS") {
        return adminEmptyResponse(event, 204, {
          Allow: allowHeader
        });
      }

      if (!allowedMethods.includes(method)) {
        return adminJsonResponse(
          event,
          405,
          {
            error: "Method Not Allowed"
          },
          {
            Allow: allowHeader
          }
        );
      }

      return await handler(event, method);
    } catch (error) {
      return adminErrorResponse(event, error, logger);
    }
  };
}
