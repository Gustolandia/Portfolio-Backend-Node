import { createAdminSessionService } from "../../src/admin/adminSessionService.js";
import { createAdminFunction } from "../../src/http/adminFunction.js";
import { adminJsonResponse } from "../../src/http/adminResponses.js";
import {
  ImageKitMediaPathError,
  createImageKitMediaService
} from "../../src/media/imageKitMediaService.js";

export function createHandler({
  imageKitMediaService = createImageKitMediaService(),
  sessionService = createAdminSessionService()
} = {}) {
  return createAdminFunction({
    allowedMethods: ["GET"],
    handler: async (event) => {
      const session = await sessionService.readSession(event);

      if (!session.authenticated) {
        return adminJsonResponse(event, 401, {
          authenticated: false
        });
      }

      try {
        const payload = await imageKitMediaService.listImages(
          event.queryStringParameters || {}
        );

        return adminJsonResponse(event, 200, payload);
      } catch (error) {
        if (error instanceof ImageKitMediaPathError) {
          return adminJsonResponse(event, 400, {
            error: "Invalid media path"
          });
        }

        throw error;
      }
    }
  });
}

export const handler = createHandler();
