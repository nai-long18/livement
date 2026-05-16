// src/hooks/use-sse.ts
'use client';

import { useEffect, useRef, useState } from 'react';

interface SSEMessage {
  type: string;
  data: unknown;
}

export function useSSE(
  roomCode: string,
  onEvent: (event: SSEMessage) => void,
  role: 'creator' | 'audience' = 'audience'
): { isConnected: boolean } {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let attempt = 0;

    function connect() {
      eventSource = new EventSource(`/api/room/${roomCode}/stream?role=${role}`);

      eventSource.onopen = () => {
        setIsConnected(true);
        attempt = 0;
      };

      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          onEventRef.current({ type: event.type || 'message', data });
        } catch {
          // Ignore parse errors (e.g., ping comments)
        }
      };

      eventSource.addEventListener('ping', handleMessage);
      eventSource.addEventListener('participants.update', handleMessage);
      eventSource.addEventListener('interaction.update', handleMessage);
      eventSource.addEventListener('vote.update', handleMessage);
      eventSource.addEventListener('question.new', handleMessage);
      eventSource.addEventListener('question.upvote', handleMessage);
      eventSource.addEventListener('wordcloud.update', handleMessage);
      eventSource.addEventListener('room.close', handleMessage);

      eventSource.onerror = () => {
        setIsConnected(false);
        eventSource?.close();

        // Exponential backoff with jitter to avoid thundering herd
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000) + (Math.random() * 1000);
        attempt++;
        reconnectTimeout = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      eventSource?.close();
    };
  }, [roomCode, role]);

  return { isConnected };
}
