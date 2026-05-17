import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import db from '@/lib/db';
import {
  getInteraction,
  submitQuestion,
  getQuestions,
  upvoteQuestion,
  updateQuestionStatus,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';
import { getOrCreateSessionId } from '@/lib/session';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = rateLimitByIp(request, 20, 60_000);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { interactionId, content, askerName } = body as {
    interactionId: string;
    content: string;
    askerName?: string;
  };
  // Use server-side session as askerId, ignore client-supplied value
  const askerId = await getOrCreateSessionId();

  const interaction = getInteraction(interactionId);
  if (!interaction || interaction.room_id !== code) {
    return NextResponse.json({ error: 'Invalid interaction' }, { status: 400 });
  }

  if (interaction.status !== 'live') {
    return NextResponse.json({ error: 'Interaction not active' }, { status: 400 });
  }

  submitQuestion(interactionId, content, askerId, askerName || '');
  const questions = getQuestions(interactionId);
  publishToRoom(code, { type: 'question.new', data: questions });

  return NextResponse.json({ success: true, questions }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = rateLimitByIp(request, 30, 60_000);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { questionId, answered, pinned } = body as {
    questionId?: string;
    answered?: boolean;
    pinned?: boolean;
  };

  // Upvote mode (existing behavior)
  if (questionId && answered === undefined && pinned === undefined) {
    upvoteQuestion(questionId);
    publishToRoom(code, { type: 'question.upvote', data: { questionId } });
    return NextResponse.json({ success: true });
  }

  // Status update mode (creator only — validate session)
  if (questionId && (answered !== undefined || pinned !== undefined)) {
    const creatorSid = await getOrCreateSessionId();
    if (room.creator_sid && room.creator_sid !== creatorSid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const question = db.prepare(`
      SELECT q.* FROM question q
      JOIN interaction i ON i.id = q.interaction_id
      WHERE q.id = ? AND i.room_id = ?
    `).get(questionId, code);
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    updateQuestionStatus(questionId, { answered, pinned });

    const updated = db.prepare('SELECT * FROM question WHERE id = ?').get(questionId);
    publishToRoom(code, { type: 'question.update', data: updated });
    return NextResponse.json({ success: true, question: updated });
  }

  return NextResponse.json({ error: 'questionId required' }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const interactionId = searchParams.get('interactionId');
  if (!interactionId) return NextResponse.json({ error: 'interactionId required' }, { status: 400 });

  const questions = getQuestions(interactionId);
  return NextResponse.json(questions);
}
