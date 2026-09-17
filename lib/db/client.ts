import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Local-only persistence — a SQLite file on disk. Deliberately not usable
// on a deployed serverless function (no persistent disk there); this
// feature only makes sense for `npm run dev` on your own machine.
const DB_PATH =
  process.env.STEALMYSERP_DB_PATH ?? path.join(process.cwd(), "data", "stealmyserp.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS analyzed_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_url TEXT NOT NULL,
      page_url TEXT NOT NULL,
      primary_topic TEXT NOT NULL DEFAULT '',
      analyzed_at TEXT NOT NULL,
      queries_json TEXT NOT NULL,
      gap_reports_json TEXT NOT NULL,
      contacts_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_analyzed_pages_site_url ON analyzed_pages(site_url);
    CREATE INDEX IF NOT EXISTS idx_analyzed_pages_analyzed_at ON analyzed_pages(analyzed_at);
  `);

  return db;
}
