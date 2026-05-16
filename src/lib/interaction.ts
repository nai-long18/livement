// src/lib/interaction.ts
import db from './db';
import { nanoid } from 'nanoid';

export type InteractionType = 'poll' | 'qa' | 'wordcloud';
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
    'SELECT * FROM question WHERE interaction_id = ? ORDER BY upvotes DESC, created_at DESC'
  ).all(interactionId);
}

export function upvoteQuestion(questionId: string): void {
  db.prepare('UPDATE question SET upvotes = upvotes + 1 WHERE id = ?').run(questionId);
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
