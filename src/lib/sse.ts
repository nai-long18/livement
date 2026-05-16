// src/lib/sse.ts

export interface SSEMessage {
  type: string;
  data: unknown;
}

export function createSSEStream(
  onSubscribe: (
    send: (event: SSEMessage) => void,
    close: () => void
  ) => void
): ReadableStream {
  let encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const send = (event: SSEMessage) => {
        const line = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      const close = () => {
        controller.close();
      };

      // Send initial connection event
      controller.enqueue(encoder.encode(':ok\n\n'));

      onSubscribe(send, close);
    },
    cancel() {
      // Cleanup handled by onSubscribe's close callback
    },
  });
}

// In-memory pub/sub for room events
type Listener = (event: SSEMessage) => void;

interface RoomSubscription {
  listener: Listener;
  role: 'creator' | 'audience';
}

const roomListeners = new Map<string, Set<RoomSubscription>>();

export function subscribeToRoom(
  roomCode: string,
  role: 'creator' | 'audience',
  listener: Listener
): () => void {
  if (!roomListeners.has(roomCode)) {
    roomListeners.set(roomCode, new Set());
  }
  const sub: RoomSubscription = { listener, role };
  roomListeners.get(roomCode)!.add(sub);

  // Broadcast updated participant count
  broadcastParticipantCount(roomCode);

  return () => {
    roomListeners.get(roomCode)?.delete(sub);
    broadcastParticipantCount(roomCode);
  };
}

function broadcastParticipantCount(roomCode: string): void {
  const counts = getRoomParticipantCount(roomCode);
  publishToRoom(roomCode, { type: 'participants.update', data: counts });
}

export function getRoomParticipantCount(roomCode: string): { creators: number; audience: number } {
  const subs = roomListeners.get(roomCode);
  if (!subs) return { creators: 0, audience: 0 };
  let creators = 0;
  let audience = 0;
  for (const sub of subs) {
    if (sub.role === 'creator') creators++;
    else audience++;
  }
  return { creators, audience };
}

export function publishToRoom(roomCode: string, event: SSEMessage): void {
  const subs = roomListeners.get(roomCode);
  if (subs) {
    for (const sub of subs) {
      try {
        sub.listener(event);
      } catch {
        // Listener might have disconnected; cleanup happens on unsubscribe
      }
    }
  }
}
