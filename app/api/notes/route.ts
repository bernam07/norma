import { NextRequest, NextResponse } from "next/server";
import { getUnprocessedNotes, insertNote } from "@/lib/db";
import { getAuthUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_NOTE_LENGTH = 10000;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notes = await getUnprocessedNotes(user.id);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Content must be a non-empty string" },
        { status: 400 }
      );
    }

    const trimmedContent = body.content.trim();

    if (trimmedContent.length === 0) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 }
      );
    }

    if (trimmedContent.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Content exceeds maximum limit of ${MAX_NOTE_LENGTH} characters` },
        { status: 400 }
      );
    }

    const note = await insertNote(trimmedContent, user.id);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
