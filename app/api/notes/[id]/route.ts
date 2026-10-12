import { NextRequest, NextResponse } from "next/server";
import { updateNote, deleteNote } from "@/lib/db";
import { getAuthUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_NOTE_LENGTH = 10000;

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
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

    const updated = await updateNote(id, trimmedContent, user.id);
    if (!updated) {
      return NextResponse.json(
        { error: "Note not found or already processed" },
        { status: 404 }
      );
    }

    return NextResponse.json({ note: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const success = await deleteNote(id, user.id);

    if (!success) {
      return NextResponse.json(
        { error: "Note not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Note deleted" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
