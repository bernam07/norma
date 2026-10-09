import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedNotes, markNotesAsProcessed } from "@/lib/db";
import { sendDailyBriefing } from "@/lib/email";
import { SESSION_COOKIE_NAME, isValidSessionToken, safeCompare } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function checkAuth(request: NextRequest): Promise<boolean> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7);
    if (safeCompare(bearerToken, authSecret)) return true;
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie && (await isValidSessionToken(sessionCookie))) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await getUnprocessedNotes();

    if (notes.length === 0) {
      return NextResponse.json(
        { success: false, message: "Queue is empty. No notes to send." },
        { status: 200 }
      );
    }

    const emailResult = await sendDailyBriefing(notes);
    const noteIds = notes.map((note) => note.id);
    await markNotesAsProcessed(noteIds);

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
