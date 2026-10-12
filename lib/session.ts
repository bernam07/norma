import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth";
import { getUserById, getUserByApiKey } from "./db";
import { User } from "@/types/user";

/**
 * Resolves the authenticated user from either the session cookie or personal API key Bearer token.
 */
export async function getAuthUser(request: NextRequest): Promise<User | null> {
  // 1. Check Bearer Token (Personal API Key from browser extension or iOS shortcuts)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const userByApi = await getUserByApiKey(token);
    if (userByApi) return userByApi;
  }

  // 2. Check Session Cookie
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie) {
    const session = await verifySessionToken(cookie);
    if (session?.userId) {
      const user = await getUserById(session.userId);
      if (user) return user;
    }
  }

  return null;
}
