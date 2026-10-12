import crypto from "crypto";
import { isValidPin, safeCompare } from "./auth";

/**
 * Securely hashes a numeric PIN using scrypt with a unique cryptographic salt.
 * Runs strictly in Node.js server runtime (Route Handlers).
 */
export function hashPin(pin: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 64).toString("hex");
  return { hash, salt };
}

/**
 * Verifies a provided PIN against the stored hash and salt.
 */
export function verifyPin(pin: string, storedHash: string, salt: string): boolean {
  if (!isValidPin(pin) || !storedHash || !salt) return false;
  const { hash } = hashPin(pin, salt);
  return safeCompare(hash, storedHash);
}
