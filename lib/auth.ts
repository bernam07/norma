import { UserSession } from "@/types/user";

export const SESSION_COOKIE_NAME = "norma_session";

/**
 * Validates numeric PIN: strictly 6 to 10 digits only.
 */
export function isValidPin(pin: string): boolean {
  return /^[0-9]{6,10}$/.test(pin);
}

/**
 * Validates username: lowercase/alphanumeric and underscores, 3 to 30 characters.
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Safe in both Edge Runtime and Node.js.
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
 * Generates a unique Personal API Key for external integrations (browser extension, iOS shortcuts).
 * Uses standard Web Crypto getRandomValues (Edge-compatible).
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return "nr_usr_" + hex;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL: AUTH_SECRET environment variable is missing. Refusing to operate in production without a secret."
      );
    }
    return "norma-local-dev-fallback-secret-replace-in-env";
  }
  return secret;
}

/**
 * Creates an HMAC-SHA256 signed session token containing userId and username.
 * Uses Web Crypto API (fully compatible with Edge runtime and Node.js).
 */
export async function createSessionToken(userId: string, username: string): Promise<string> {
  const secret = getSessionSecret();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = `${userId}:${username}:${expiresAt}`;
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${encodedPayload}.${signature}`;
}

/**
 * Verifies a session token string. Returns UserSession if valid, or null if expired/tampered with.
 * Uses Web Crypto API (fully compatible with Edge runtime and Node.js).
 */
export async function verifySessionToken(token: string): Promise<UserSession | null> {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  try {
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const [userId, username, expiresAtStr] = payload.split(":");

    if (!userId || !username || !expiresAtStr) {
      return null;
    }

    const expiresAt = Number(expiresAtStr);
    if (isNaN(expiresAt) || expiresAt < Date.now()) {
      return null;
    }

    const secret = getSessionSecret();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (!safeCompare(signature, expectedSignature)) {
      return null;
    }

    return { userId, username };
  } catch {
    return null;
  }
}
