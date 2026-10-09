import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  computeSessionToken,
  safeCompare,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authSecret = process.env.AUTH_SECRET;

    if (!authSecret) {
      return NextResponse.json(
        { error: "AUTH_SECRET is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const passcode = typeof body?.passcode === "string" ? body.passcode.trim() : "";

    // Artificial delay to prevent rapid brute-force attempts
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!passcode || !safeCompare(passcode, authSecret)) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    const sessionToken = await computeSessionToken(authSecret);
    const isProduction = process.env.NODE_ENV === "production";

    const response = NextResponse.json(
      { success: true, message: "Authenticated successfully" },
      { status: 200 }
    );

    // 30 days session
    const maxAge = 60 * 60 * 24 * 30;

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
