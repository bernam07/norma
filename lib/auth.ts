export const SESSION_COOKIE_NAME = "norma_session";

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

/**
 * Computes a deterministic SHA-256 session token from AUTH_SECRET.
 * This ensures the raw password/secret is never stored in the cookie.
 */
export async function computeSessionToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(secret + ":norma_session")
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validates a session cookie value against the server AUTH_SECRET.
 */
export async function isValidSessionToken(token: string): Promise<boolean> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !token) return false;
  const expectedToken = await computeSessionToken(secret);
  return safeCompare(token, expectedToken);
}
