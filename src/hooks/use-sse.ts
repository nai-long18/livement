// src/hooks/use-sse.ts
'use client';

import { useEffect, useRef } from 'react';

interface SSEMessage {
  type: string;
  data: unknown;
}

export function useSSE(
  roomCode: string,
  onEvent: (event: SSEMessage) => void
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const eventSource = new EventSource(`/api/room/${roomCode}/stream`);

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onEventRef.current({ type: event.type || 'message', data });
      } catch {
        // Ignore parse errors (e.g., ping comments)
      }
    };

    eventSource.addEventListener('ping', handleMessage);
    eventSource.addEventListener('interaction.update', handleMessage);
    eventSource.addEventListener('vote.update', handleMessage);
    eventSource.addEventListener('question.new', handleMessage);
    eventSource.addEventListener('question.upvote', handleMessage);
    eventSource.addEventListener('wordcloud.update', handleMessage);
    eventSource.addEventListener('room.close', handleMessage);

    eventSource.onerror = () => {
      // EventSource will auto-reconnect
    };

    return () => {
      eventSource.close();
    };
  }, [roomCode]);
}
