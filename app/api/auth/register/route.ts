import { NextRequest, NextResponse } from "next/server";
import { createUser, getUserByUsername } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  createSessionToken,
  generateApiKey,
  isValidPin,
  isValidUsername,
} from "@/lib/auth";
import { hashPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
    const pin = typeof body?.pin === "string" ? body.pin.trim() : "";

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: "Username must be 3-30 characters long (letters, numbers, underscores only)." },
        { status: 400 }
      );
    }

    if (!isValidPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be strictly 6 to 10 digits (numbers only)." },
        { status: 400 }
      );
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json(
        { error: "Username is already taken. Please choose another one." },
        { status: 409 }
      );
    }

    const { hash, salt } = hashPin(pin);
    const apiKey = generateApiKey();
    const newUser = await createUser(username, hash, salt, apiKey);

    const sessionToken = await createSessionToken(newUser.id, newUser.username);
    const isProduction = process.env.NODE_ENV === "production";
    const maxAge = 60 * 60 * 24 * 30; // 30 days

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          onboarding_completed: newUser.onboarding_completed,
        },
      },
      { status: 201 }
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
    console.error("[Register Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
