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
    });
  }
  return pool;
}

let initialized = false;

async function ensureTable(): Promise<void> {
  if (initialized) return;
  try {
    const client = getPool();
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed BOOLEAN NOT NULL DEFAULT false
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_processed_created_at ON notes (processed, created_at DESC);
    `);
    initialized = true;
  } catch {
    initialized = false;
  }
}

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

export async function markNotesAsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await ensureTable();
  const client = getPool();
  await client.query(
    `
    UPDATE notes
    SET processed = true
    WHERE id = ANY($1::uuid[]);
    `,
    [ids]
  );
}
