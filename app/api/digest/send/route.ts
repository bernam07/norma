import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedNotes, markNotesAsProcessed } from "@/lib/db";
import { sendDailyBriefing } from "@/lib/email";
import { getAuthUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.email || !user.resend_api_key) {
      return NextResponse.json(
        {
          error: "Please configure your delivery email and Resend API key in Settings first.",
          missingSetup: true,
        },
        { status: 400 }
      );
    }

    const notes = await getUnprocessedNotes(user.id);

    if (notes.length === 0) {
      return NextResponse.json(
        { success: false, message: "Queue is empty. No notes to send." },
        { status: 200 }
      );
    }

    const emailResult = await sendDailyBriefing(notes, {
      apiKey: user.resend_api_key,
      recipient: user.email,
      fromAddress: user.from_email || "Norma Digest <onboarding@resend.dev>",
    });

    const noteIds = notes.map((note) => note.id);
    await markNotesAsProcessed(noteIds, user.id);

    return NextResponse.json(
      {
        success: true,
        message: `Daily digest sent successfully (${notes.length} ${notes.length === 1 ? "note" : "notes"})!`,
        count: notes.length,
        emailId: emailResult.id,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
