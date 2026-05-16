// src/app/api/room/[code]/stream/route.ts
import { NextRequest } from 'next/server';
import { createSSEStream, subscribeToRoom } from '@/lib/sse';
import { getRoom } from '@/lib/room';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const role = (searchParams.get('role') || 'audience') as 'creator' | 'audience';

  const room = getRoom(code);
  if (!room) {
    return new Response('Room not found', { status: 404 });
  }

  const stream = createSSEStream((send, close) => {
    // Keep-alive ping every 15 seconds
    const pingInterval = setInterval(() => {
      send({ type: 'ping', data: { time: Date.now() } });
    }, 15000);

    const unsubscribe = subscribeToRoom(code, role, (event) => {
      send(event);
    });

    // Return cleanup is not directly supported — use AbortSignal
    return () => {
      clearInterval(pingInterval);
      unsubscribe();
      close();
    };
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
