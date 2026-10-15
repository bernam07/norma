import { NextRequest, NextResponse } from "next/server";
import { getProcessedNotes, getProcessedNotesCount } from "@/lib/db";
import { getAuthUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get("limit") || "200", 10);
    const limit = Math.min(Math.max(isNaN(parsedLimit) ? 200 : parsedLimit, 1), 500);

    const parsedOffset = parseInt(searchParams.get("offset") || "0", 10);
    const offset = Math.max(isNaN(parsedOffset) ? 0 : parsedOffset, 0);

    const [notes, total] = await Promise.all([
      getProcessedNotes(limit, offset, user.id),
      getProcessedNotesCount(user.id),
    ]);

    return NextResponse.json({ notes, total }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
