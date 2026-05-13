import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getHeader } from "../http/headers.js";

const DEFAULT_COOKIE_NAME = "portfolio_admin_session";
const DEFAULT_ISSUER = "portfolio-backend";
const DEFAULT_AUDIENCE = "portfolio-admin-session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 8;
const encoder = new TextEncoder();

function secretBytes(secret) {
  return encoder.encode(secret);
}

function parseCookieHeader(cookieHeader = "") {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");

        if (separatorIndex === -1) {
          return [part, ""];
        }

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1))
        ];
      })
  );
}

function getCookie(event, cookieName) {
  const cookieHeader = getHeader(event.headers, "cookie");
  const cookies = parseCookieHeader(cookieHeader);

  return cookies[cookieName];
}

function buildSessionCookie({
  cookieName,
  maxAgeSeconds,
  sameSite,
  secure,
  token
}) {
  const attributes = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${maxAgeSeconds}`
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

function buildClearCookie({ cookieName, sameSite, secure }) {
  const attributes = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    "Max-Age=0"
  ];

  if (secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function createAdminSessionService({
  audience = DEFAULT_AUDIENCE,
  cookieName = process.env.ADMIN_SESSION_COOKIE_NAME || DEFAULT_COOKIE_NAME,
  getSessionSecret = () => process.env.AUTH_JWT_SECRET || process.env.ADMIN_SESSION_SECRET,
  issuer = DEFAULT_ISSUER,
  maxAgeSeconds = Number(process.env.ADMIN_SESSION_MAX_AGE_SECONDS || DEFAULT_MAX_AGE_SECONDS),
  sameSite = process.env.ADMIN_COOKIE_SAME_SITE || "None",
  secure = process.env.ADMIN_COOKIE_SECURE !== "false"
} = {}) {
  function getSecretOrThrow() {
    const sessionSecret = getSessionSecret();

    if (!sessionSecret) {
      throw new Error("AUTH_JWT_SECRET or ADMIN_SESSION_SECRET is required for admin sessions.");
    }

    return sessionSecret;
  }

  return {
    clearSessionCookie() {
      return buildClearCookie({
        cookieName,
        sameSite,
        secure
      });
    },

    async createSession({ email }) {
      const csrfToken = randomBytes(32).toString("base64url");
      const token = await new SignJWT({
        csrfToken,
        email
      })
        .setProtectedHeader({
          alg: "HS256"
        })
        .setIssuer(issuer)
        .setAudience(audience)
        .setSubject(email)
        .setIssuedAt()
        .setExpirationTime(`${maxAgeSeconds}s`)
        .sign(secretBytes(getSecretOrThrow()));

      return {
        cookie: buildSessionCookie({
          cookieName,
          maxAgeSeconds,
          sameSite,
          secure,
          token
        }),
        csrfToken,
        user: {
          email
        }
      };
    },

    async readSession(event = {}) {
      const token = getCookie(event, cookieName);

      if (!token) {
        return {
          authenticated: false
        };
      }

      try {
        const { payload } = await jwtVerify(token, secretBytes(getSecretOrThrow()), {
          algorithms: ["HS256"],
          audience,
          issuer
        });

        if (!payload.email || !payload.csrfToken) {
          return {
            authenticated: false
          };
        }

        return {
          authenticated: true,
          csrfToken: payload.csrfToken,
          user: {
            email: payload.email
          }
        };
      } catch {
        return {
          authenticated: false
        };
      }
    },

    validateCsrfToken(event, session) {
      const suppliedToken = getHeader(event.headers, "x-csrf-token");

      return Boolean(suppliedToken && session?.csrfToken && suppliedToken === session.csrfToken);
    }
  };
}
