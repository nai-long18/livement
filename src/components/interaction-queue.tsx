// src/components/interaction-queue.tsx
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface InteractionData {
  id: string;
  type: 'poll' | 'qa' | 'wordcloud';
  title: string;
  status: 'pending' | 'live' | 'closed';
}

const typeLabel = { poll: '投票', qa: '问答', wordcloud: '词云' };

export function InteractionQueue({
  interactions,
  activeId,
  onSelect,
  onToggleStatus,
}: {
  interactions: InteractionData[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleStatus: (id: string, current: string) => void;
}) {
  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {interactions.map(item => (
          <div
            key={item.id}
            className={cn(
              'flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors',
              item.id === activeId
                ? 'bg-primary/10 border border-primary/30'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
            )}
            onClick={() => onSelect(item.id)}
          >
            <Badge variant="outline" className="shrink-0">
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
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
