import { NextRequest, NextResponse } from "next/server";
import { getProcessedNotes, getProcessedNotesCount } from "@/lib/db";
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

export async function GET(request: NextRequest) {
  try {
    if (!(await checkAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    const [notes, total] = await Promise.all([
      getProcessedNotes(limit, offset),
      getProcessedNotesCount(),
    ]);

    return NextResponse.json({ notes, total }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
