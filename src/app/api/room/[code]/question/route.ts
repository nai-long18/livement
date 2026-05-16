import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  getInteraction,
  submitQuestion,
  getQuestions,
  upvoteQuestion,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { interactionId, content, askerId, askerName } = body as {
    interactionId: string;
    content: string;
    askerId: string;
    askerName?: string;
  };

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
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { questionId } = body as { questionId: string };

  upvoteQuestion(questionId);

  // Re-fetch and broadcast questions for the room
  // We need the interaction ID — grab from the question
  const { getInteraction, getQuestions } = await import('@/lib/interaction');
  // Broadcast is scoped to room, so we just need to notify viewers
  // The creator dashboard can refetch

  publishToRoom(code, { type: 'question.upvote', data: { questionId } });

  return NextResponse.json({ success: true });
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
