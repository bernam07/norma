import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  isValidSessionToken,
  safeCompare,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Endpoints that bypass middleware check
  if (
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  const authSecret = process.env.AUTH_SECRET;

  // Check Bearer Token (for programmatic API requests & shortcuts)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authSecret) {
    const bearerToken = authHeader.substring(7);
    if (safeCompare(bearerToken, authSecret)) {
      return NextResponse.next();
    }
  }

  // Check Session Cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = sessionCookie
    ? await isValidSessionToken(sessionCookie)
    : false;

  // 2. Handle /login page
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 3. If authenticated, allow access
  if (isAuthenticated) {
    return NextResponse.next();
  }

  // 4. If unauthenticated:
  // For API endpoints: return 401 Unauthorized
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // For Web pages: redirect to /login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - public assets (favicon, icons, manifest, service worker)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-touch-icon.png|icon-192.png|icon-512.png|manifest.json|sw.js).*)",
  ],
};

