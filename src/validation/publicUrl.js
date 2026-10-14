/**
 * Accepts public HTTP(S) URLs and relative asset paths suitable for href/src.
 *
 * Protocol-relative URLs, other schemes, embedded credentials, controls and
 * backslashes are rejected. Empty strings mean no asset/contact link.
 *
 * @param {unknown} value Candidate public link.
 * @returns {boolean} Whether the link is safe to render as a public asset URL.
 */
export function isSafePublicUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  const url = value.trim();

  if (!url) {
    return true;
  }

  if (/[\u0000-\u001f\u007f\\]/.test(value) || url.startsWith("//")) {
    return false;
  }

  const scheme = /^[a-z][a-z\d+.-]*:/i.exec(url);

  if (scheme && !/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const parsed = new URL(url, "https://portfolio.invalid/");

    return ["http:", "https:"].includes(parsed.protocol) &&
      !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

/**
 * Removes unsafe legacy links during reads and trims safe URL strings.
 *
 * @param {unknown} value Candidate public link.
 * @returns {string} Safe public URL, or an empty string.
 */
export function normalizePublicUrl(value) {
  return isSafePublicUrl(value) ? value.trim() : "";
}
