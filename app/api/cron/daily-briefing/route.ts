import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedNotes, markNotesAsProcessed } from "@/lib/db";
import { sendDailyBriefing } from "@/lib/email";
import { safeCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const cronSecret = process.env.CRON_SECRET;
    const authSecret = process.env.AUTH_SECRET;

    // Check if authorized by CRON_SECRET (sent by Vercel Cron) or AUTH_SECRET (fallback / manual test)
    const isCronAuthorized = cronSecret && safeCompare(authHeader, `Bearer ${cronSecret}`);
    const isAuthAuthorized = authSecret && safeCompare(authHeader, `Bearer ${authSecret}`);

    if (!isCronAuthorized && !isAuthAuthorized) {
      console.error(
        `[Cron] Unauthorized request. Authorization header: ${authHeader ? "present" : "missing"}, CRON_SECRET set: ${Boolean(cronSecret)}, AUTH_SECRET set: ${Boolean(authSecret)}`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await getUnprocessedNotes();

    if (notes.length === 0) {
      console.log("[Cron] Daily briefing: queue is empty (0 notes to process).");
      return NextResponse.json({ message: "No notes to process" }, { status: 200 });
    }

    console.log(`[Cron] Sending daily briefing for ${notes.length} note(s)...`);
    const emailResult = await sendDailyBriefing(notes);
    const noteIds = notes.map((note) => note.id);
    await markNotesAsProcessed(noteIds);

    console.log(`[Cron] Daily briefing sent successfully! Email ID: ${emailResult.id}`);

    return NextResponse.json(
      {
        success: true,
        emailId: emailResult.id,
        processedCount: notes.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Cron] Error processing daily briefing:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
