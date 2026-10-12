import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  isValidPin,
} from "@/lib/auth";
import { verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    // Artificial delay to prevent rapid brute-force attempts
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
