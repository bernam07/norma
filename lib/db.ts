import { Pool } from "pg";
import { Note } from "@/types/note";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error("POSTGRES_URL environment variable is not defined");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  try {
    const client = getPool();
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed BOOLEAN NOT NULL DEFAULT false
      );
      CREATE INDEX IF NOT EXISTS idx_notes_processed_created_at ON notes (processed, created_at DESC);
    `);
    initialized = true;
  } catch {
    initialized = false;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getUnprocessedNotes(): Promise<Note[]> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<Note>(`
    SELECT id, content, created_at, processed
    FROM notes
    WHERE processed = false
    ORDER BY created_at DESC;
  `);
  return res.rows;
}

export async function insertNote(content: string): Promise<Note> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<Note>(
    `
    INSERT INTO notes (content, processed)
    VALUES ($1, false)
    RETURNING id, content, created_at, processed;
    `,
    [content]
  );
  return res.rows[0];
}

export async function updateNote(id: string, content: string): Promise<Note | null> {
  if (!UUID_REGEX.test(id)) return null;
  await ensureTable();
  const client = getPool();
  const res = await client.query<Note>(
    `
    UPDATE notes
    SET content = $1
    WHERE id = $2 AND processed = false
    RETURNING id, content, created_at, processed;
    `,
    [content, id]
  );
  return res.rows[0] || null;
}

export async function deleteNote(id: string): Promise<boolean> {
  if (!UUID_REGEX.test(id)) return false;
  await ensureTable();
  const client = getPool();
  const res = await client.query(
    `
    DELETE FROM notes
    WHERE id = $1;
    `,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markNotesAsProcessed(ids: string[]): Promise<void> {
  const validIds = ids.filter((id) => typeof id === "string" && UUID_REGEX.test(id));
  if (validIds.length === 0) return;
  await ensureTable();
  const client = getPool();
  await client.query(
    `
    UPDATE notes
    SET processed = true
    WHERE id = ANY($1::uuid[]);
    `,
    [validIds]
  );
}

export async function getProcessedNotes(limit = 200, offset = 0): Promise<Note[]> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<Note>(
    `
    SELECT id, content, created_at, processed
    FROM notes
    WHERE processed = true
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    [limit, offset]
  );
  return res.rows;
}

export async function getProcessedNotesCount(): Promise<number> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM notes WHERE processed = true;`
  );
  return parseInt(res.rows[0]?.count || "0", 10);
}
