// src/components/creator-dashboard.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { RoomHeader } from '@/components/room-header';
import { InteractionQueue } from '@/components/interaction-queue';
import { AddInteractionDialog } from '@/components/add-interaction-dialog';
import { PollResults } from '@/components/poll-results';
import { QaFeed } from '@/components/qa-feed';
import { WordCloud } from '@/components/word-cloud';
import { useSSE } from '@/hooks/use-sse';

interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud';
  title: string;
  status: 'pending' | 'live' | 'closed';
}

export function CreatorDashboard({ roomCode }: { roomCode: string }) {
  const [interactions, setInteractions] = useState<InteractionData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInteractions = useCallback(async () => {
    const res = await fetch(`/api/room/${roomCode}/interaction`);
    const data = await res.json();
    setInteractions(data);
    if (data.length > 0 && !activeId) {
      setActiveId(data[0].id);
    }
    setLoading(false);
  }, [roomCode, activeId]);

  useEffect(() => {
    fetchInteractions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for SSE events specific to this room
  useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update' || event.type === 'vote.update' ||
        event.type === 'question.new' || event.type === 'wordcloud.update') {
      fetchInteractions();
    }
  });

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'live' ? 'closed' : 'live';
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchInteractions();
  }

  const activeInteraction = interactions.find(i => i.id === activeId);

  return (
    <div className="h-screen flex flex-col">
      <RoomHeader roomCode={roomCode} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Interaction Queue */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-2">
            <AddInteractionDialog roomCode={roomCode} onAdded={fetchInteractions} />
          </div>
          <div className="flex-1 overflow-hidden">
            <InteractionQueue
              interactions={interactions}
              activeId={activeId}
              onSelect={setActiveId}
              onToggleStatus={handleToggleStatus}
            />
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 p-6 overflow-auto">
          {loading ? (
            <p className="text-slate-400">加载中...</p>
          ) : activeInteraction ? (
            <div>
              <h3 className="text-xl font-semibold mb-4">{activeInteraction.title}</h3>
              {activeInteraction.type === 'poll' && (
                <PollResults interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
              {activeInteraction.type === 'qa' && (
                <QaFeed interactionId={activeId!} />
              )}
              {activeInteraction.type === 'wordcloud' && (
                <WordCloud interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              添加一个互动环节开始
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
