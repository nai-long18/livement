import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  getInteraction,
  submitVote,
  getVoteResults,
  submitWord,
  getWordCloudData,
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
  const { interactionId, optionText, voterId } = body as {
    interactionId: string;
    optionText: string;
    voterId: string;
  };

  const interaction = getInteraction(interactionId);
  if (!interaction || interaction.room_id !== code) {
    return NextResponse.json({ error: 'Invalid interaction' }, { status: 400 });
  }

  if (interaction.status !== 'live') {
    return NextResponse.json({ error: 'Interaction not active' }, { status: 400 });
  }

  if (interaction.type === 'wordcloud') {
    submitWord(interactionId, optionText, voterId);
    const data = getWordCloudData(interactionId);
    publishToRoom(code, { type: 'wordcloud.update', data });
    return NextResponse.json({ success: true, data });
  }

  // Poll
  const result = submitVote(interactionId, optionText, voterId);
  if (!result.success) return NextResponse.json(result, { status: 409 });

  const voteResults = getVoteResults(interactionId);
  publishToRoom(code, { type: 'vote.update', data: voteResults });

  return NextResponse.json({ success: true, ...voteResults });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const { searchParams } = new URL(_request.url);
  const interactionId = searchParams.get('interactionId');
  if (!interactionId) return NextResponse.json({ error: 'interactionId required' }, { status: 400 });

  const results = getVoteResults(interactionId);
  return NextResponse.json(results);
}
