import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { sendTestEmail } from "@/lib/email";

import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: max 3 test emails per 5 minutes per user
    const testLimit = rateLimit(`test_email_${user.id}`, {
      windowMs: 5 * 60 * 1000,
      max: 3,
    });

    if (!testLimit.allowed) {
      return NextResponse.json(
        { error: "Too many test emails sent. Please wait a few minutes before trying again." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil(testLimit.resetMs / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json().catch(() => ({}));
    const apiKey = body.resend_api_key?.trim() || user.resend_api_key;
    const recipient = body.email?.trim() || user.email;
    const rawFrom = body.from_email?.trim() || user.from_email || "Norma Digest <onboarding@resend.dev>";

    // Prevent Header Injection (CRLF) and excessively long from fields
    if (/[\r\n]/.test(rawFrom) || rawFrom.length > 100) {
      return NextResponse.json(
        { error: "Invalid sender address format." },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "Resend API key is missing. Please enter your Resend API key." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!recipient || !emailRegex.test(recipient)) {
      return NextResponse.json(
        { error: "Valid recipient email address is required." },
        { status: 400 }
      );
    }

    const result = await sendTestEmail({
      apiKey,
      recipient,
      fromAddress: rawFrom,
    });

    return NextResponse.json({
      success: true,
      message: `Test email successfully sent to ${recipient}! Check your inbox.`,
      emailId: result.id,
    });
  } catch (error) {
    console.error("[Test Email Error]:", error);
    let errorMessage = error instanceof Error ? error.message : "Failed to send test email";

    // Helpful hints for common Resend free-tier sandbox errors
    if (errorMessage.toLowerCase().includes("validation_error") || errorMessage.toLowerCase().includes("domain")) {
      errorMessage += " (Hint: Resend free tier with onboarding@resend.dev only allows sending to your own Resend account email).";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}
