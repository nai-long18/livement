import { describe, it, expect, vi } from 'vitest';
import Database from 'better-sqlite3';

vi.mock('../db', () => {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS room (
      id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed'))
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
    CREATE INDEX IF NOT EXISTS idx_vote_voter ON vote(interaction_id, voter_id);
  `);
  db.prepare('INSERT INTO room (id, title) VALUES (?, ?)').run('R001', 'Test');
  return { default: db, initializeDatabase: () => {} };
});

import {
  createInteraction, getRoomInteractions, updateInteractionStatus,
  getInteraction, submitVote, getVoteResults,
  submitQuestion, getQuestions, upvoteQuestion,
  submitWord, getWordCloudData,
} from '../interaction';

const ROOM = 'R001';

describe('interaction', () => {
  it('createInteraction creates a poll with config', () => {
    const i = createInteraction(ROOM, 'poll', '投票', { options: ['A', 'B'], multiple: false });
    expect(i.id).toBeTruthy();
    expect(i.type).toBe('poll');
    expect(i.status).toBe('pending');
    expect(JSON.parse(i.config)).toEqual({ options: ['A', 'B'], multiple: false });
  });

  it('getRoomInteractions returns all interactions', () => {
    createInteraction(ROOM, 'qa', 'Q1');
    createInteraction(ROOM, 'wordcloud', 'W1');
    expect(getRoomInteractions(ROOM).length).toBeGreaterThanOrEqual(2);
  });

  it('updateInteractionStatus to live closes other live ones', () => {
    const a = createInteraction(ROOM, 'poll', 'A');
    const b = createInteraction(ROOM, 'qa', 'B');
    updateInteractionStatus(a.id, 'live');
    updateInteractionStatus(b.id, 'live');
    expect(getInteraction(a.id)!.status).toBe('closed');
    expect(getInteraction(b.id)!.status).toBe('live');
  });

  it('submitVote records and allows update', () => {
    const i = createInteraction(ROOM, 'poll', 'P1', { options: ['X', 'Y'], multiple: false });
    updateInteractionStatus(i.id, 'live');

    expect(submitVote(i.id, 'X', 'v1').success).toBe(true);
    expect(submitVote(i.id, 'Y', 'v1').success).toBe(true); // update
  });

  it('getVoteResults returns correct counts including zeros', () => {
    const i = createInteraction(ROOM, 'poll', 'P2', { options: ['Go', 'Rust', 'Zig'], multiple: false });
    updateInteractionStatus(i.id, 'live');

    submitVote(i.id, 'Go', 'va');
    submitVote(i.id, 'Go', 'vb');
    submitVote(i.id, 'Rust', 'vc');

    const r = getVoteResults(i.id);
    expect(r.total).toBe(3);
    expect(r.options.find(o => o.option_text === 'Go')!.count).toBe(2);
    expect(r.options.find(o => o.option_text === 'Rust')!.count).toBe(1);
    expect(r.options.find(o => o.option_text === 'Zig')!.count).toBe(0);
  });

  it('submitQuestion and getQuestions', () => {
    const i = createInteraction(ROOM, 'qa', 'QA1');
    updateInteractionStatus(i.id, 'live');

    submitQuestion(i.id, '什么是 SSR？', 'u1', '小明');
    const qs = getQuestions(i.id);
    expect(qs).toHaveLength(1);
    expect(qs[0].content).toBe('什么是 SSR？');
  });

  it('upvoteQuestion increments', () => {
    const i = createInteraction(ROOM, 'qa', 'QA2');
    updateInteractionStatus(i.id, 'live');
    submitQuestion(i.id, 'How?', 'ux');
    const q = getQuestions(i.id)[0] as { id: string };
    upvoteQuestion(q.id);
    upvoteQuestion(q.id);
    expect((getQuestions(i.id)[0] as { upvotes: number }).upvotes).toBe(2);
  });

  it('submitWord lowercases and getWordCloudData returns ranked', () => {
    const i = createInteraction(ROOM, 'wordcloud', 'WC');
    updateInteractionStatus(i.id, 'live');

    submitWord(i.id, '  AI  ', 'w1');
    submitWord(i.id, 'ai', 'w2');
    submitWord(i.id, 'Rust', 'w3');

    const data = getWordCloudData(i.id);
    expect(data[0].word).toBe('ai');
    expect(data[0].count).toBe(2);
    expect(data[1].word).toBe('rust');
    expect(data[1].count).toBe(1);
  });
});
