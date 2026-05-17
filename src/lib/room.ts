// src/lib/room.ts
import db, { initializeDatabase } from './db';
import { nanoid } from 'nanoid';

// Ensure schema exists on first import
initializeDatabase();

export interface Room {
  id: string;
  title: string;
  created_at: string;
  status: 'active' | 'closed';
  creator_sid: string;
}

export function createRoom(title: string = '', creatorSid: string = ''): Room {
  const id = nanoid(4); // 4-char code for easy sharing
  const stmt = db.prepare(
    'INSERT INTO room (id, title, creator_sid) VALUES (?, ?, ?)'
  );
  stmt.run(id, title, creatorSid);
  return getRoom(id)!;
}

export function getRoom(id: string): Room | undefined {
  return db.prepare('SELECT * FROM room WHERE id = ?').get(id) as Room | undefined;
}

export function closeRoom(id: string): void {
  db.prepare("UPDATE room SET status = 'closed' WHERE id = ?").run(id);
}

export function getActiveInteraction(roomId: string) {
  return db.prepare(
    "SELECT * FROM interaction WHERE room_id = ? AND status = 'live' LIMIT 1"
  ).get(roomId);
}
