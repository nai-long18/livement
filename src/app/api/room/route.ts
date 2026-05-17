import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getRoom } from '@/lib/room';
import { getOrCreateSessionId } from '@/lib/session';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const rl = rateLimitByIp(request, 10, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const title = body.title || '';
  const creatorSid = await getOrCreateSessionId();
  const room = createRoom(title, creatorSid);
  return NextResponse.json(room, { status: 201 });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'code required' }, { status: 400 });
  }
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }
  return NextResponse.json(room);
}
