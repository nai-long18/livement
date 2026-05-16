// src/lib/db.ts
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'livement.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent reads
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS room (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status     TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed'))
    );

    CREATE TABLE IF NOT EXISTS interaction (
      id         TEXT PRIMARY KEY,
      room_id    TEXT NOT NULL REFERENCES room(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK(type IN ('poll', 'qa', 'wordcloud')),
      title      TEXT NOT NULL DEFAULT '',
      config     TEXT NOT NULL DEFAULT '{}',
      status     TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'live', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vote (
      id              TEXT PRIMARY KEY,
      interaction_id  TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      option_text     TEXT NOT NULL,
      voter_id        TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS question (
      id              TEXT PRIMARY KEY,
      interaction_id  TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      content         TEXT NOT NULL,
      asker_name      TEXT DEFAULT '',
      asker_id        TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      upvotes         INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_interaction_room ON interaction(room_id);
    CREATE INDEX IF NOT EXISTS idx_vote_interaction ON vote(interaction_id);
    CREATE INDEX IF NOT EXISTS idx_vote_voter ON vote(interaction_id, voter_id);
    CREATE INDEX IF NOT EXISTS idx_question_interaction ON question(interaction_id);
  `);

  // Migrations — safe to run repeatedly
  try { db.exec('ALTER TABLE question ADD COLUMN answered INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE question ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0'); } catch {}
}

export default db;
