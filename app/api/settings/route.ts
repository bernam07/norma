import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/session";
import {
  updateUserSettings,
  updateUserPin,
  getUserWithCredentialsById,
} from "@/lib/db";
import { isValidPin } from "@/lib/auth";
import { hashPin, verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const maskedResendKey = user.resend_api_key
      ? `${user.resend_api_key.slice(0, 6)}••••${user.resend_api_key.slice(-4)}`
      : null;

    return NextResponse.json({
      settings: {
        id: user.id,
        username: user.username,
        email: user.email,
        from_email: user.from_email || "Norma Digest <onboarding@resend.dev>",
        api_key: user.api_key,
        has_resend_configured: Boolean(user.resend_api_key),
        masked_resend_key: maskedResendKey,
        onboarding_completed: user.onboarding_completed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      email,
      resend_api_key,
      from_email,
      onboarding_completed,
      current_pin,
      new_pin,
    } = body;

    // Optional PIN Change
    if (new_pin !== undefined) {
      if (!isValidPin(new_pin)) {
        return NextResponse.json(
          { error: "New PIN must be strictly 6 to 10 digits (numbers only)." },
          { status: 400 }
        );
      }

      const creds = await getUserWithCredentialsById(user.id);
      if (!creds) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (!current_pin || !verifyPin(current_pin, creds.pin_hash, creds.salt)) {
        return NextResponse.json(
          { error: "Current PIN is incorrect." },
          { status: 400 }
        );
      }

      const { hash, salt } = hashPin(new_pin);
      await updateUserPin(user.id, hash, salt);
    }

    // Validate email if provided
    if (email !== undefined && email !== null && email.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: "Please enter a valid email address." },
          { status: 400 }
        );
      }
    }

    // Validate Resend API Key format if provided
    if (
      resend_api_key !== undefined &&
      resend_api_key !== null &&
      resend_api_key.trim() !== ""
    ) {
      if (!resend_api_key.trim().startsWith("re_")) {
        return NextResponse.json(
          { error: "Resend API key must start with 're_'." },
          { status: 400 }
        );
      }
    }

    // Validate from_email format to prevent CRLF injection
    if (from_email !== undefined && from_email !== null && from_email.trim() !== "") {
      if (/[\r\n]/.test(from_email) || from_email.trim().length > 100) {
        return NextResponse.json(
          { error: "Invalid sender address format." },
          { status: 400 }
        );
      }
    }

    const updatedUser = await updateUserSettings(user.id, {
      email,
      resendApiKey: resend_api_key,
      fromEmail: from_email,
      onboardingCompleted: onboarding_completed,
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      );
    }

    const maskedResendKey = updatedUser.resend_api_key
      ? `${updatedUser.resend_api_key.slice(0, 6)}••••${updatedUser.resend_api_key.slice(-4)}`
      : null;

    return NextResponse.json({
      success: true,
      settings: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        from_email: updatedUser.from_email,
        api_key: updatedUser.api_key,
        has_resend_configured: Boolean(updatedUser.resend_api_key),
        masked_resend_key: maskedResendKey,
        onboarding_completed: updatedUser.onboarding_completed,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
