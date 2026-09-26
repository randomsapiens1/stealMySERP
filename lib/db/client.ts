import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

// Lazy init: `neon()` throws immediately if DATABASE_URL is unset, and
// Next.js evaluates top-level module code at build time — calling this
// eagerly would crash `next build` before env vars are configured.
function getSql(): NeonQueryFunction<false, false> {
  if (!sql) sql = neon(process.env.DATABASE_URL!);
  return sql;
}

async function ensureSchema(db: NeonQueryFunction<false, false>): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS analyzed_pages (
      id SERIAL PRIMARY KEY,
      site_url TEXT NOT NULL,
      page_url TEXT NOT NULL,
      primary_topic TEXT NOT NULL DEFAULT '',
      analyzed_at TEXT NOT NULL,
      queries_json TEXT NOT NULL,
      gap_reports_json TEXT NOT NULL,
      contacts_json TEXT NOT NULL,
      source_reports_json TEXT NOT NULL DEFAULT '[]'
    )
  `;
  // Backfills the column for tables created before AI Overview source
  // insights were persisted — a no-op once every environment has run this.
  await db`ALTER TABLE analyzed_pages ADD COLUMN IF NOT EXISTS source_reports_json TEXT NOT NULL DEFAULT '[]'`;
  await db`CREATE INDEX IF NOT EXISTS idx_analyzed_pages_site_url ON analyzed_pages(site_url)`;
  await db`CREATE INDEX IF NOT EXISTS idx_analyzed_pages_analyzed_at ON analyzed_pages(analyzed_at)`;
}

export async function getDb(): Promise<NeonQueryFunction<false, false>> {
  const db = getSql();
  if (!schemaReady) schemaReady = ensureSchema(db);
  await schemaReady;
  return db;
}
