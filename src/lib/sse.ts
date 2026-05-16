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
const roomListeners = new Map<string, Set<Listener>>();

export function subscribeToRoom(roomCode: string, listener: Listener): () => void {
  if (!roomListeners.has(roomCode)) {
    roomListeners.set(roomCode, new Set());
  }
  roomListeners.get(roomCode)!.add(listener);

  return () => {
    roomListeners.get(roomCode)?.delete(listener);
  };
}

export function publishToRoom(roomCode: string, event: SSEMessage): void {
  const listeners = roomListeners.get(roomCode);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Listener might have disconnected; cleanup happens on unsubscribe
      }
    }
  }
}
