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
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/toast';

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
  const [showMobileQueue, setShowMobileQueue] = useState(false);

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

  const { isConnected } = useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update' || event.type === 'vote.update' ||
        event.type === 'question.new' || event.type === 'wordcloud.update') {
      fetchInteractions();
    }
  });

  const { toast } = useToast();

  async function handleToggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'live' ? 'closed' : 'live';
    await fetch(`/api/room/${roomCode}/interaction`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    toast(newStatus === 'live' ? '互动已开启' : '互动已关闭', 'success');
    fetchInteractions();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/room/${roomCode}/interaction?id=${id}`, { method: 'DELETE' });
    if (activeId === id) setActiveId(null);
    toast('互动已删除', 'success');
    fetchInteractions();
  }

  const activeInteraction = interactions.find(i => i.id === activeId);

  // Shared queue panel
  const queuePanel = (
    <div className="flex flex-col h-full">
      <div className="p-2 shrink-0">
        <AddInteractionDialog roomCode={roomCode} onAdded={fetchInteractions} />
      </div>
      <div className="flex-1 overflow-hidden">
        <InteractionQueue
          interactions={interactions}
          activeId={activeId}
          onSelect={(id) => { setActiveId(id); setShowMobileQueue(false); }}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );

  return (
    <div className="h-dvh flex flex-col bg-background">
      {!isConnected && (
        <div className="bg-amber-500/90 text-black text-center text-sm py-1.5 shrink-0">
          实时连接已断开，正在重连...
        </div>
      )}
      <RoomHeader roomCode={roomCode} />

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Sidebar */}
        <div className="hidden lg:flex w-72 border-r border-slate-200 dark:border-slate-800 flex-col shrink-0">
          {queuePanel}
        </div>

        {/* Main content area */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-7 bg-slate-200 dark:bg-slate-800 rounded w-48" />
              <div className="space-y-2">
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            </div>
          ) : activeInteraction ? (
            <div>
              <h3 className="text-lg lg:text-xl font-semibold mb-4">{activeInteraction.title}</h3>
              {activeInteraction.type === 'poll' && (
                <PollResults roomCode={roomCode} interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
              {activeInteraction.type === 'qa' && (
                <QaFeed roomCode={roomCode} interactionId={activeId!} />
              )}
              {activeInteraction.type === 'wordcloud' && (
                <WordCloud roomCode={roomCode} interactionId={activeId!} live={activeInteraction.status === 'live'} />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm lg:text-base">
              添加一个互动环节开始
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Floating queue button + bottom drawer */}
      <div className="lg:hidden">
        {/* FAB */}
        <button
          onClick={() => setShowMobileQueue(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-lg font-bold active:scale-95 transition-transform"
        >
          {interactions.filter(i => i.status === 'live').length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-background" />
          )}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>

        {/* Bottom drawer overlay */}
        <AnimatePresence>
          {showMobileQueue && (
            <>
              <motion.div
                className="fixed inset-0 z-50 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowMobileQueue(false)}
              />
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] bg-background rounded-t-2xl shadow-xl flex flex-col"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              >
                {/* Drawer handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                </div>
                <div className="px-3 pb-3 text-sm font-medium text-center text-slate-500">
                  互动队列 ({interactions.length})
                </div>
                <div className="flex-1 overflow-y-auto">
                  {queuePanel}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
