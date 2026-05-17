// src/lib/interaction.ts
import db from './db';
import { nanoid } from 'nanoid';

export type InteractionType = 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
export type InteractionStatus = 'pending' | 'live' | 'closed';

export interface Interaction {
  id: string;
  room_id: string;
  type: InteractionType;
  title: string;
  config: string; // JSON string
  status: InteractionStatus;
  created_at: string;
}

export interface PollConfig {
  options: string[];
  multiple: boolean;
}

export function createInteraction(
  roomId: string,
  type: InteractionType,
  title: string,
  config: object = {}
): Interaction {
  const id = nanoid();
  const stmt = db.prepare(
    'INSERT INTO interaction (id, room_id, type, title, config) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, roomId, type, title, JSON.stringify(config));
  return db.prepare('SELECT * FROM interaction WHERE id = ?').get(id) as Interaction;
}

export function getRoomInteractions(roomId: string): Interaction[] {
  return db.prepare(
    'SELECT * FROM interaction WHERE room_id = ? ORDER BY created_at ASC'
  ).all(roomId) as Interaction[];
}

export function updateInteractionStatus(
  id: string,
  status: InteractionStatus
): void {
  // Close all other live interactions in the same room first
  if (status === 'live') {
    const interaction = db.prepare('SELECT room_id FROM interaction WHERE id = ?').get(id) as { room_id: string } | undefined;
    if (interaction) {
      db.prepare(
        "UPDATE interaction SET status = 'closed' WHERE room_id = ? AND status = 'live'"
      ).run(interaction.room_id);
    }
  }
  db.prepare('UPDATE interaction SET status = ? WHERE id = ?').run(status, id);
}

export function getInteraction(id: string): Interaction | undefined {
  return db.prepare('SELECT * FROM interaction WHERE id = ?').get(id) as Interaction | undefined;
}

export function deleteInteraction(id: string): void {
  db.prepare('DELETE FROM interaction WHERE id = ?').run(id);
}

export function updateInteractionConfig(id: string, config: Record<string, unknown>): void {
  const existing = db.prepare('SELECT config FROM interaction WHERE id = ?').get(id) as { config: string } | undefined;
  if (!existing) return;
  const merged = { ...JSON.parse(existing.config), ...config };
  db.prepare('UPDATE interaction SET config = ? WHERE id = ?').run(JSON.stringify(merged), id);
}

// --- Votes ---

export interface VoteResult {
  option_text: string;
  count: number;
}

export function submitVote(
  interactionId: string,
  optionText: string,
  voterId: string
): { success: boolean; message: string } {
  // Check for duplicate vote
  const existing = db.prepare(
    'SELECT id FROM vote WHERE interaction_id = ? AND voter_id = ?'
  ).get(interactionId, voterId);

  if (existing) {
    // Update existing vote
    db.prepare('UPDATE vote SET option_text = ? WHERE interaction_id = ? AND voter_id = ?')
      .run(optionText, interactionId, voterId);
    return { success: true, message: 'Vote updated' };
  }

  db.prepare('INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)')
    .run(nanoid(), interactionId, optionText, voterId);
  return { success: true, message: 'Vote submitted' };
}

export function getVoteResults(interactionId: string): { total: number; options: VoteResult[] } {
  const config = getInteraction(interactionId);
  if (!config) return { total: 0, options: [] };

  const pollConfig: PollConfig = JSON.parse(config.config);
  const results = db.prepare(
    'SELECT option_text, COUNT(*) as count FROM vote WHERE interaction_id = ? GROUP BY option_text'
  ).all(interactionId) as VoteResult[];

  // Merge with config options to include zero-vote options
  const options = pollConfig.options.map(opt => {
    const found = results.find(r => r.option_text === opt);
    return { option_text: opt, count: found ? found.count : 0 };
  });

  const total = options.reduce((sum, o) => sum + o.count, 0);

  return { total, options };
}

export function submitMultiVote(
  interactionId: string,
  optionTexts: string[],
  voterId: string
): void {
  const run = db.transaction(() => {
    // Delete all previous votes from this voter for this interaction
    db.prepare('DELETE FROM vote WHERE interaction_id = ? AND voter_id = ?')
      .run(interactionId, voterId);
    // Insert new rows
    const stmt = db.prepare(
      'INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)'
    );
    for (const opt of optionTexts) {
      stmt.run(nanoid(), interactionId, opt, voterId);
    }
  });
  run();
}

// --- Questions (Q&A) ---

export function submitQuestion(
  interactionId: string,
  content: string,
  askerId: string,
  askerName: string = ''
): void {
  db.prepare(
    'INSERT INTO question (id, interaction_id, content, asker_name, asker_id) VALUES (?, ?, ?, ?, ?)'
  ).run(nanoid(), interactionId, content, askerName, askerId);
}

export function getQuestions(interactionId: string) {
  return db.prepare(
    'SELECT * FROM question WHERE interaction_id = ? ORDER BY pinned DESC, answered ASC, upvotes DESC, created_at DESC'
  ).all(interactionId);
}

export function upvoteQuestion(questionId: string): void {
  db.prepare('UPDATE question SET upvotes = upvotes + 1 WHERE id = ?').run(questionId);
}

export function updateQuestionStatus(
  id: string,
  updates: { answered?: boolean; pinned?: boolean }
): void {
  const run = db.transaction(() => {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.answered !== undefined) {
      sets.push('answered = ?');
      params.push(updates.answered ? 1 : 0);
    }
    if (updates.pinned !== undefined) {
      // Unpin all other questions in the same interaction if pinning
      if (updates.pinned) {
        const q = db.prepare('SELECT interaction_id FROM question WHERE id = ?').get(id) as { interaction_id: string } | undefined;
        if (q) {
          db.prepare("UPDATE question SET pinned = 0 WHERE interaction_id = ? AND id != ?").run(q.interaction_id, id);
        }
      }
      sets.push('pinned = ?');
      params.push(updates.pinned ? 1 : 0);
    }

    if (sets.length === 0) return;
    db.prepare(`UPDATE question SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);
  });
  run();
}

// --- Word Cloud ---

export function submitWord(
  interactionId: string,
  word: string,
  voterId: string
): void {
  // Word cloud reuses the vote table — each word is an "option"
  db.prepare('INSERT INTO vote (id, interaction_id, option_text, voter_id) VALUES (?, ?, ?, ?)')
    .run(nanoid(), interactionId, word.trim().toLowerCase(), voterId);
}

export function getWordCloudData(interactionId: string) {
  return db.prepare(
    'SELECT option_text as word, COUNT(*) as count FROM vote WHERE interaction_id = ? GROUP BY option_text ORDER BY count DESC LIMIT 50'
  ).all(interactionId) as { word: string; count: number }[];
}
