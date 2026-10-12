import { Pool } from "pg";
import { Note } from "@/types/note";
import { User } from "@/types/user";

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

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        email TEXT,
        resend_api_key TEXT,
        from_email TEXT DEFAULT 'Norma <onboarding@resend.dev>',
        api_key TEXT UNIQUE NOT NULL,
        onboarding_completed BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_api_key ON users (api_key);

      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed BOOLEAN NOT NULL DEFAULT false
      );

      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'notes' AND column_name = 'user_id'
        ) THEN 
          ALTER TABLE notes ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE; 
        END IF; 
      END $$;

      CREATE INDEX IF NOT EXISTS idx_notes_user_processed_created ON notes (user_id, processed, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notes_processed_created_at ON notes (processed, created_at DESC);
    `);
    initialized = true;
  } catch {
    initialized = false;
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- USER OPERATIONS ---

export async function createUser(
  username: string,
  pinHash: string,
  salt: string,
  apiKey: string
): Promise<User> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<User>(
    `
    INSERT INTO users (username, pin_hash, salt, api_key)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, email, resend_api_key, from_email, api_key, onboarding_completed, created_at;
    `,
    [username.toLowerCase().trim(), pinHash, salt, apiKey]
  );
  return res.rows[0];
}

export async function getUserByUsername(username: string): Promise<
  (User & { pin_hash: string; salt: string }) | null
> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<User & { pin_hash: string; salt: string }>(
    `
    SELECT id, username, pin_hash, salt, email, resend_api_key, from_email, api_key, onboarding_completed, created_at
    FROM users
    WHERE LOWER(username) = LOWER($1);
    `,
    [username.trim()]
  );
  return res.rows[0] || null;
}

export async function getUserById(id: string): Promise<User | null> {
  if (!UUID_REGEX.test(id)) return null;
  await ensureTable();
  const client = getPool();
  const res = await client.query<User>(
    `
    SELECT id, username, email, resend_api_key, from_email, api_key, onboarding_completed, created_at
    FROM users
    WHERE id = $1;
    `,
    [id]
  );
  return res.rows[0] || null;
}

export async function getUserWithCredentialsById(
  id: string
): Promise<(User & { pin_hash: string; salt: string }) | null> {
  if (!UUID_REGEX.test(id)) return null;
  await ensureTable();
  const client = getPool();
  const res = await client.query<User & { pin_hash: string; salt: string }>(
    `
    SELECT id, username, email, resend_api_key, from_email, api_key, onboarding_completed, created_at, pin_hash, salt
    FROM users
    WHERE id = $1;
    `,
    [id]
  );
  return res.rows[0] || null;
}

export async function getUserByApiKey(apiKey: string): Promise<User | null> {
  if (!apiKey || typeof apiKey !== "string") return null;
  await ensureTable();
  const client = getPool();
  const res = await client.query<User>(
    `
    SELECT id, username, email, resend_api_key, from_email, api_key, onboarding_completed, created_at
    FROM users
    WHERE api_key = $1;
    `,
    [apiKey]
  );
  return res.rows[0] || null;
}

export async function updateUserSettings(
  id: string,
  settings: {
    email?: string | null;
    resendApiKey?: string | null;
    fromEmail?: string | null;
    onboardingCompleted?: boolean;
  }
): Promise<User | null> {
  if (!UUID_REGEX.test(id)) return null;
  await ensureTable();
  const client = getPool();

  // Fetch current user to allow partial patching
  const current = await getUserById(id);
  if (!current) return null;

  const newEmail = settings.email !== undefined 
    ? (settings.email?.trim() || null) 
    : current.email;

  const newResendApiKey = settings.resendApiKey !== undefined 
    ? (settings.resendApiKey?.trim() || null) 
    : current.resend_api_key;

  const newFromEmail = settings.fromEmail !== undefined 
    ? (settings.fromEmail?.trim() || "Norma Digest <onboarding@resend.dev>") 
    : current.from_email;

  const newOnboarding = settings.onboardingCompleted !== undefined
    ? settings.onboardingCompleted
    : current.onboarding_completed;

  const res = await client.query<User>(
    `
    UPDATE users
    SET 
      email = $1,
      resend_api_key = $2,
      from_email = $3,
      onboarding_completed = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING id, username, email, resend_api_key, from_email, api_key, onboarding_completed, created_at;
    `,
    [newEmail, newResendApiKey, newFromEmail, newOnboarding, id]
  );
  return res.rows[0] || null;
}

export async function completeOnboarding(id: string): Promise<boolean> {
  if (!UUID_REGEX.test(id)) return false;
  await ensureTable();
  const client = getPool();
  const res = await client.query(
    `
    UPDATE users
    SET onboarding_completed = true, updated_at = NOW()
    WHERE id = $1;
    `,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function updateUserPin(
  id: string,
  pinHash: string,
  salt: string
): Promise<boolean> {
  if (!UUID_REGEX.test(id)) return false;
  await ensureTable();
  const client = getPool();
  const res = await client.query(
    `
    UPDATE users
    SET pin_hash = $1, salt = $2, updated_at = NOW()
    WHERE id = $3;
    `,
    [pinHash, salt, id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getUsersWithPendingNotesForCron(): Promise<
  Array<User & { note_count: number }>
> {
  await ensureTable();
  const client = getPool();
  const res = await client.query<User & { note_count: number }>(
    `
    SELECT 
      u.id, u.username, u.email, u.resend_api_key, u.from_email, u.api_key, u.onboarding_completed, u.created_at,
      COUNT(n.id)::int as note_count
    FROM users u
    JOIN notes n ON n.user_id = u.id
    WHERE n.processed = false AND u.email IS NOT NULL AND u.resend_api_key IS NOT NULL
    GROUP BY u.id
    HAVING COUNT(n.id) > 0;
    `
  );
  return res.rows;
}

// --- NOTES OPERATIONS (SCOPED TO USER) ---

export async function getUnprocessedNotes(userId?: string): Promise<Note[]> {
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query<Note>(
      `
      SELECT id, user_id, content, created_at, processed
      FROM notes
      WHERE user_id = $1 AND processed = false
      ORDER BY created_at DESC;
      `,
      [userId]
    );
    return res.rows;
  }

  const res = await client.query<Note>(`
    SELECT id, user_id, content, created_at, processed
    FROM notes
    WHERE processed = false
    ORDER BY created_at DESC;
  `);
  return res.rows;
}

export async function insertNote(content: string, userId?: string): Promise<Note> {
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query<Note>(
      `
      INSERT INTO notes (content, user_id, processed)
      VALUES ($1, $2, false)
      RETURNING id, user_id, content, created_at, processed;
      `,
      [content, userId]
    );
    return res.rows[0];
  }

  const res = await client.query<Note>(
    `
    INSERT INTO notes (content, processed)
    VALUES ($1, false)
    RETURNING id, user_id, content, created_at, processed;
    `,
    [content]
  );
  return res.rows[0];
}

export async function updateNote(
  id: string,
  content: string,
  userId?: string
): Promise<Note | null> {
  if (!UUID_REGEX.test(id)) return null;
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query<Note>(
      `
      UPDATE notes
      SET content = $1
      WHERE id = $2 AND user_id = $3 AND processed = false
      RETURNING id, user_id, content, created_at, processed;
      `,
      [content, id, userId]
    );
    return res.rows[0] || null;
  }

  const res = await client.query<Note>(
    `
    UPDATE notes
    SET content = $1
    WHERE id = $2 AND processed = false
    RETURNING id, user_id, content, created_at, processed;
    `,
    [content, id]
  );
  return res.rows[0] || null;
}

export async function deleteNote(id: string, userId?: string): Promise<boolean> {
  if (!UUID_REGEX.test(id)) return false;
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query(
      `
      DELETE FROM notes
      WHERE id = $1 AND user_id = $2;
      `,
      [id, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  const res = await client.query(
    `
    DELETE FROM notes
    WHERE id = $1;
    `,
    [id]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markNotesAsProcessed(ids: string[], userId?: string): Promise<void> {
  const validIds = ids.filter((id) => typeof id === "string" && UUID_REGEX.test(id));
  if (validIds.length === 0) return;
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    await client.query(
      `
      UPDATE notes
      SET processed = true
      WHERE id = ANY($1::uuid[]) AND user_id = $2;
      `,
      [validIds, userId]
    );
    return;
  }

  await client.query(
    `
    UPDATE notes
    SET processed = true
    WHERE id = ANY($1::uuid[]);
    `,
    [validIds]
  );
}

export async function getProcessedNotes(
  limit = 200,
  offset = 0,
  userId?: string
): Promise<Note[]> {
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query<Note>(
      `
      SELECT id, user_id, content, created_at, processed
      FROM notes
      WHERE user_id = $1 AND processed = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3;
      `,
      [userId, limit, offset]
    );
    return res.rows;
  }

  const res = await client.query<Note>(
    `
    SELECT id, user_id, content, created_at, processed
    FROM notes
    WHERE processed = true
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2;
    `,
    [limit, offset]
  );
  return res.rows;
}

export async function getProcessedNotesCount(userId?: string): Promise<number> {
  await ensureTable();
  const client = getPool();

  if (userId && UUID_REGEX.test(userId)) {
    const res = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM notes WHERE user_id = $1 AND processed = true;`,
      [userId]
    );
    return parseInt(res.rows[0]?.count || "0", 10);
  }

  const res = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM notes WHERE processed = true;`
  );
  return parseInt(res.rows[0]?.count || "0", 10);
}
