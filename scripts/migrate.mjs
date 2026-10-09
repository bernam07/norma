import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import pg from "pg";
const { Pool } = pg;

async function run() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error("POSTGRES_URL environment variable is not defined");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed BOOLEAN NOT NULL DEFAULT false
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_processed_created_at ON notes (processed, created_at DESC);
    `);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

run();
