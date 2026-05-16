import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getRoom } from '@/lib/room';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const title = body.title || '';
  const room = createRoom(title);
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
