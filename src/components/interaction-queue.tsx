// src/components/interaction-queue.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud' | 'rating' | 'leaderboard';
  title: string;
  status: 'pending' | 'live' | 'closed';
}

const typeLabel = { poll: '投票', qa: '问答', wordcloud: '词云', rating: '评分', leaderboard: '排行榜' };

export function InteractionQueue({
  interactions,
  activeId,
  onSelect,
  onToggleStatus,
  onDelete,
  searchQuery = '',
}: {
  interactions: InteractionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
  onDelete: (id: string) => void;
  searchQuery?: string;
}) {
  const filtered = searchQuery.trim()
    ? interactions.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : interactions;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {filtered.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 p-2.5 lg:p-3 rounded-lg cursor-pointer transition-colors group',
              item.id === activeId
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
            )}
            onClick={() => onSelect(item.id)}
          >
            <Badge variant="outline" className="shrink-0 text-xs">
              {typeLabel[item.type]}
            </Badge>
            <span className="flex-1 truncate text-sm">{item.title}</span>
            <Button
              size="sm"
              variant={item.status === 'live' ? 'destructive' : 'default'}
              className="shrink-0"
              onClick={e => {
                e.stopPropagation();
                onToggleStatus(item.id, item.status);
              }}
            >
              {item.status === 'live' ? '关闭' : '启动'}
            </Button>
            <button
              className="shrink-0 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-red-500 transition-all p-1"
              onClick={e => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="删除"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
        {filtered.length === 0 && searchQuery && (
          <p className="text-slate-400 text-xs text-center py-4">没有匹配的互动</p>
        )}
      </div>
    </ScrollArea>
  );
}
