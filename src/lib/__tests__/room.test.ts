import { describe, it, expect, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';

// Use in-memory database in mock factory to avoid hoisting issues
vi.mock('../db', () => {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS room (
      id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
      creator_sid TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS interaction (
      id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES room(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('poll', 'qa', 'wordcloud')),
      title TEXT NOT NULL DEFAULT '', config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'live', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS vote (
      id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      option_text TEXT NOT NULL, voter_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS question (
      id TEXT PRIMARY KEY, interaction_id TEXT NOT NULL REFERENCES interaction(id) ON DELETE CASCADE,
      content TEXT NOT NULL, asker_name TEXT DEFAULT '', asker_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      upvotes INTEGER NOT NULL DEFAULT 0
    );
  `);
  return { default: db, initializeDatabase: () => {} };
});

import { createRoom, getRoom, closeRoom } from '../room';

describe('room', () => {
  it('createRoom creates a room with 4-char id', () => {
    const room = createRoom('测试房间');
    expect(room.id).toHaveLength(4);
    expect(room.title).toBe('测试房间');
    expect(room.status).toBe('active');
  });

  it('getRoom returns undefined for non-existent room', () => {
    expect(getRoom('XXXX')).toBeUndefined();
  });

  it('getRoom returns the created room', () => {
    const room = createRoom('找到我');
    const found = getRoom(room.id);
    expect(found).toBeTruthy();
    expect(found!.title).toBe('找到我');
  });

  it('closeRoom sets room status to closed', () => {
    const room = createRoom('即将关闭');
    closeRoom(room.id);
    expect(getRoom(room.id)!.status).toBe('closed');
  });

  it('createRoom generates unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(createRoom('').id);
    }
    expect(ids.size).toBe(20);
  });
});
