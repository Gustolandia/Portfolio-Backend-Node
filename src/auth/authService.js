import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getHeader } from "../http/headers.js";

const DEFAULT_AUDIENCE = "portfolio-admin";
const DEFAULT_ISSUER = "portfolio-backend";
const encoder = new TextEncoder();

function secretBytes(secret) {
  return encoder.encode(secret);
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest();
}

function safeCompare(left, right) {
  return timingSafeEqual(hash(left), hash(right));
}

function unauthorized(reason) {
  return {
    authenticated: false,
    reason
  };
}

function authenticated(principal) {
  return {
    authenticated: true,
    principal
  };
}

export function createAuthService({
  audience = DEFAULT_AUDIENCE,
  getApiKey = () => process.env.ADMIN_API_KEY,
  getJwtSecret = () => process.env.AUTH_JWT_SECRET,
  issuer = DEFAULT_ISSUER
} = {}) {
  async function authenticateBearerToken(token) {
    const jwtSecret = getJwtSecret();

    if (!jwtSecret) {
      return unauthorized("JWT authentication is not configured.");
    }

    try {
      const { payload } = await jwtVerify(token, secretBytes(jwtSecret), {
        algorithms: ["HS256"],
        audience,
        issuer
      });

      return authenticated({
        claims: payload,
        subject: payload.sub || "admin",
        type: "jwt"
      });
    } catch {
      return unauthorized("Invalid bearer token.");
    }
  }

  function authenticateApiKey(suppliedApiKey) {
    const configuredApiKey = getApiKey();

    if (!configuredApiKey) {
      return unauthorized("API key authentication is not configured.");
    }

    if (!safeCompare(suppliedApiKey, configuredApiKey)) {
      return unauthorized("Invalid API key.");
    }

    return authenticated({
      subject: "admin",
      type: "api-key"
    });
  }

  return {
    async authenticateEvent(event = {}) {
      const authorization = getHeader(event.headers, "authorization");
      const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);

      if (bearerMatch) {
        return authenticateBearerToken(bearerMatch[1]);
      }

      const suppliedApiKey = getHeader(event.headers, "x-api-key");

      if (suppliedApiKey) {
        return authenticateApiKey(suppliedApiKey);
      }

      return unauthorized("Missing authentication credentials.");
    },

    async issueAdminToken({ expiresIn = "15m", subject = "admin" } = {}) {
      const jwtSecret = getJwtSecret();

      if (!jwtSecret) {
        throw new Error("AUTH_JWT_SECRET is required to issue admin tokens.");
      }

      return new SignJWT({
        role: "admin"
      })
        .setProtectedHeader({
          alg: "HS256"
        })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secretBytes(jwtSecret));
    }
  };
}
