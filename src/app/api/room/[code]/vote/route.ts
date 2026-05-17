import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import {
  getInteraction,
  submitVote,
  getVoteResults,
  submitWord,
  getWordCloudData,
  submitMultiVote,
  getRatingResults,
} from '@/lib/interaction';
import { publishToRoom } from '@/lib/sse';
import { getOrCreateSessionId } from '@/lib/session';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const rl = rateLimitByIp(request, 30, 60_000);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const body = await request.json();
  const { interactionId, optionText } = body as {
    interactionId: string;
    optionText: string;
  };
  // Use server-side session as voterId, ignore client-supplied value
  const voterId = await getOrCreateSessionId();

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

  if (interaction.type === 'rating') {
    submitVote(interactionId, optionText, voterId);
    const results = getRatingResults(interactionId);
    publishToRoom(code, { type: 'vote.update', data: results });
    return NextResponse.json({ success: true, ...results });
  }

  if (interaction.type === 'leaderboard') {
    const { optionTexts } = body as { optionTexts?: string[] };
    if (!optionTexts || optionTexts.length === 0) {
      return NextResponse.json({ error: 'optionTexts required' }, { status: 400 });
    }
    submitMultiVote(interactionId, optionTexts, voterId);
    const voteResults = getVoteResults(interactionId);
    publishToRoom(code, { type: 'vote.update', data: voteResults });
    return NextResponse.json({ success: true, ...voteResults });
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

  const interaction = getInteraction(interactionId);
  if (!interaction) return NextResponse.json({ error: 'Interaction not found' }, { status: 404 });

  if (interaction.type === 'wordcloud') {
    const data = getWordCloudData(interactionId);
    return NextResponse.json(data);
  }

  if (interaction.type === 'rating') {
    const results = getRatingResults(interactionId);
    return NextResponse.json(results);
  }

  const results = getVoteResults(interactionId);
  return NextResponse.json(results);
}
