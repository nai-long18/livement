import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  createInteraction,
  getRoomInteractions,
  updateInteractionStatus,
  InteractionType,
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
  const { type, title, config } = body as {
    type: InteractionType;
    title: string;
    config?: object;
  };

  if (!type || !['poll', 'qa', 'wordcloud'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const interaction = createInteraction(code, type, title || '', config || {});
  return NextResponse.json(interaction, { status: 201 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const interactions = getRoomInteractions(code);
  return NextResponse.json(interactions);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { id, status } = body as { id: string; status: 'pending' | 'live' | 'closed' };

  updateInteractionStatus(id, status);

  if (status === 'live') {
    const { getInteraction, getVoteResults, getQuestions, getWordCloudData } = await import('@/lib/interaction');
    const interaction = getInteraction(id);
    if (interaction) {
      publishToRoom(code, {
        type: 'interaction.update',
        data: interaction,
      });
    }
  }

  return NextResponse.json({ success: true });
}
