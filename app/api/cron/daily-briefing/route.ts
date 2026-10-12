import { NextRequest, NextResponse } from "next/server";
import {
  getUsersWithPendingNotesForCron,
  getUnprocessedNotes,
  markNotesAsProcessed,
} from "@/lib/db";
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
        `[Cron] Unauthorized request. Authorization header: ${authHeader ? "present" : "missing"}`
      );
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eligibleUsers = await getUsersWithPendingNotesForCron();

    if (eligibleUsers.length === 0) {
      console.log("[Cron] Daily briefing: no users with pending notes and configured email.");
      return NextResponse.json(
        { message: "No eligible users with pending notes found." },
        { status: 200 }
      );
    }

    console.log(`[Cron] Found ${eligibleUsers.length} user(s) to process.`);
    const results = [];

    for (const user of eligibleUsers) {
      try {
        const userNotes = await getUnprocessedNotes(user.id);
        if (userNotes.length === 0) continue;

        console.log(
          `[Cron] Processing ${userNotes.length} note(s) for user ${user.username} (${user.email})...`
        );

        const emailResult = await sendDailyBriefing(userNotes, {
          apiKey: user.resend_api_key,
          recipient: user.email,
          fromAddress: user.from_email,
        });

        const noteIds = userNotes.map((note) => note.id);
        await markNotesAsProcessed(noteIds, user.id);

        results.push({
          userId: user.id,
          username: user.username,
          status: "success",
          notesCount: userNotes.length,
          emailId: emailResult.id,
        });
      } catch (userError) {
        console.error(
          `[Cron] Failed to process briefing for user ${user.username}:`,
          userError
        );
        results.push({
          userId: user.id,
          username: user.username,
          status: "failed",
          error: userError instanceof Error ? userError.message : "Unknown error",
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        processedUsers: results.length,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Cron] Error processing daily briefings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
