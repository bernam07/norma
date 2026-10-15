import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  isValidPin,
} from "@/lib/auth";
import { verifyPin } from "@/lib/pin";

import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. Rate limit by IP: max 10 attempts per minute
    const ipLimit = rateLimit(`login_ip_${clientIp}`, {
      windowMs: 60 * 1000,
      max: 10,
    });

    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts from this network. Please wait a minute." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(ipLimit.resetMs / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    // 2. Rate limit by Username: max 5 attempts per minute to prevent targeted dictionary attacks
    if (username) {
      const userLimit = rateLimit(`login_user_${username}`, {
        windowMs: 60 * 1000,
        max: 5,
      });

      if (!userLimit.allowed) {
        return NextResponse.json(
          { error: "Too many failed attempts for this account. Please wait a minute." },
          {
            status: 429,
            headers: {
              "Retry-After": Math.ceil(userLimit.resetMs / 1000).toString(),
            },
          }
        );
      }
    }

    // Artificial delay to prevent timing analysis
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!username || !pin || !isValidPin(pin)) {
      return NextResponse.json(
        { error: "Invalid username or PIN (PIN must be 6-10 digits)." },
        { status: 400 }
      );
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json(
        { error: "Incorrect username or PIN." },
        { status: 401 }
      );
    }

    const isValid = verifyPin(pin, user.pin_hash, user.salt);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect username or PIN." },
        { status: 401 }
      );
    }

    const sessionToken = await createSessionToken(user.id, user.username);
    const isProduction = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    const response = NextResponse.json(
      {
        success: true,
        message: "Authenticated successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          onboarding_completed: user.onboarding_completed,
        },
      },
      { status: 200 }
    );

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error("[Login Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
