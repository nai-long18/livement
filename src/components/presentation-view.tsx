// src/components/presentation-view.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PollResults } from '@/components/poll-results';
import { QaFeed } from '@/components/qa-feed';
import { WordCloud } from '@/components/word-cloud';
import QRCode from 'qrcode';

export function PresentationView({ roomCode }: { roomCode: string }) {
  const [activeInteraction, setActiveInteraction] = useState<{
    id: string;
    type: 'poll' | 'qa' | 'wordcloud';
    title: string;
    status: string;
    config?: string;
  } | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    const joinUrl = `${window.location.origin}/join/${roomCode}`;
    QRCode.toDataURL(joinUrl, { width: 200, margin: 1 })
      .then(setQrDataUrl);
  }, [roomCode]);

  const { isConnected } = useSSE(roomCode, (event) => {
    if (event.type === 'interaction.update') {
      const data = event.data as { id: string; type: string; title: string; status: string; config?: string };
      if (data.status === 'live') {
        setActiveInteraction(data as typeof activeInteraction);
      } else if (data.status === 'closed' && activeInteraction?.id === data.id) {
        setActiveInteraction(null);
      }
    }
  });

  // Fetch current active interaction on mount
  useEffect(() => {
    fetch(`/api/room/${roomCode}/interaction`)
      .then(r => r.json())
      .then(data => {
        const live = data.find((i: { status: string }) => i.status === 'live');
        if (live) setActiveInteraction(live);
      });
  }, [roomCode]);

  return (
    <main className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {!isConnected && (
        <div className="bg-amber-500/90 text-black text-center text-sm py-1.5">
          实时连接已断开，正在重连...
        </div>
      )}
      {/* Content Area */}
      <div className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          {activeInteraction ? (
            <motion.div
              key={activeInteraction.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-4xl"
            >
              <h1 className="text-3xl md:text-5xl font-bold text-center mb-8">
                {activeInteraction.title}
              </h1>
              {activeInteraction.type === 'poll' && (
                <PollResults roomCode={roomCode} interactionId={activeInteraction.id} live isCreator initialRevealed={activeInteraction.config ? JSON.parse(activeInteraction.config).revealed === true : false} />
              )}
              {activeInteraction.type === 'qa' && (
                <QaFeed roomCode={roomCode} interactionId={activeInteraction.id} />
              )}
              {activeInteraction.type === 'wordcloud' && (
                <WordCloud roomCode={roomCode} interactionId={activeInteraction.id} live />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-3xl md:text-5xl font-bold text-slate-600 mb-4">
                等待开始
              </p>
              <p className="text-slate-500 text-lg">
                加入码: <span className="font-mono tracking-widest text-cyan-400">{roomCode}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Bar */}
      <footer className="h-14 border-t border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            参与人数: {participantCount}
          </span>
          <button
            onClick={() => setShowQR(!showQR)}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
          >
            {showQR ? '隐藏二维码' : '显示二维码'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }}
            className="text-slate-500 text-sm hover:text-slate-300 transition-colors"
            title="全屏"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
          <span className="text-slate-700 text-xs">Powered by LiveMent</span>
        </div>
      </footer>

      {/* QR Overlay */}
      {showQR && qrDataUrl && (
        <div className="absolute bottom-16 right-4 bg-white p-3 rounded-lg shadow-lg">
          <img src={qrDataUrl} alt="加入二维码" className="w-36 h-36" />
          <p className="text-slate-800 text-xs text-center mt-1 font-mono tracking-widest">
            {roomCode}
          </p>
        </div>
      )}
    </main>
  );
}
