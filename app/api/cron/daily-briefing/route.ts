import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedNotes, markNotesAsProcessed } from "@/lib/db";
import { sendDailyBriefing } from "@/lib/email";
import { safeCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await getUnprocessedNotes();

    if (notes.length === 0) {
      return NextResponse.json({ message: "No notes to process" }, { status: 200 });
    }

    const emailResult = await sendDailyBriefing(notes);
    const noteIds = notes.map((note) => note.id);
    await markNotesAsProcessed(noteIds);

    return NextResponse.json(
      {
        success: true,
        emailId: emailResult.id,
        processedCount: notes.length,
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
