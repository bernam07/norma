import { NextRequest, NextResponse } from "next/server";
import { getUserById, getUserByApiKey } from "@/lib/db";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let user = null;

    // 1. Check Bearer Token (Personal API Key)
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const apiKey = authHeader.substring(7).trim();
      user = await getUserByApiKey(apiKey);
    }

    // 2. Check Session Cookie
    if (!user) {
      const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (sessionCookie) {
        const session = await verifySessionToken(sessionCookie);
        if (session) {
          user = await getUserById(session.userId);
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mask the Resend API Key if present (e.g. re_123***89)
    const maskedResendKey = user.resend_api_key
      ? `${user.resend_api_key.slice(0, 6)}••••${user.resend_api_key.slice(-4)}`
      : null;

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        from_email: user.from_email,
        api_key: user.api_key,
        has_resend_configured: Boolean(user.resend_api_key),
        masked_resend_key: maskedResendKey,
        onboarding_completed: user.onboarding_completed,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
