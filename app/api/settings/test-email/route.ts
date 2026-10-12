import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import { sendTestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const apiKey = body.resend_api_key?.trim() || user.resend_api_key;
    const recipient = body.email?.trim() || user.email;
    const fromAddress = body.from_email?.trim() || user.from_email || "Norma Digest <onboarding@resend.dev>";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Resend API key is missing. Please enter your Resend API key." },
        { status: 400 }
      );
    }

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient email address is missing. Please enter your delivery email." },
        { status: 400 }
      );
    }

    const result = await sendTestEmail({
      apiKey,
      recipient,
      fromAddress,
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
