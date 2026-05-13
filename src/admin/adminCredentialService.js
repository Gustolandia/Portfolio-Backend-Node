import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

function safeCompare(left, right) {
  const leftHash = createHash("sha256").update(String(left)).digest();
  const rightHash = createHash("sha256").update(String(right)).digest();

  return timingSafeEqual(leftHash, rightHash);
}

export function createAdminCredentialService({
  comparePassword = bcrypt.compare,
  getAdminEmail = () => process.env.ADMIN_EMAIL,
  getAdminPasswordHash = () => process.env.ADMIN_PASSWORD_HASH
} = {}) {
  return {
    async validateCredentials({ email, password } = {}) {
      const configuredEmail = getAdminEmail();
      const configuredPasswordHash = getAdminPasswordHash();

      if (!configuredEmail || !configuredPasswordHash || !email || !password) {
        return {
          authenticated: false
        };
      }

      if (!safeCompare(email.toLowerCase(), configuredEmail.toLowerCase())) {
        return {
          authenticated: false
        };
      }

      const passwordMatches = await comparePassword(password, configuredPasswordHash);

      if (!passwordMatches) {
        return {
          authenticated: false
        };
      }

      return {
        authenticated: true,
        user: {
          email: configuredEmail
        }
      };
    }
  };
}
