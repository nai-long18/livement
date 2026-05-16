// src/app/api/room/[code]/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getRoom } from '@/lib/room';
import { getVoteResults, getQuestions, getWordCloudData, getInteraction } from '@/lib/interaction';

// BOM for Excel UTF-8 compatibility
const BOM = '﻿';

function formatCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(cell => {
      // Escape cells containing comma or quote
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(','));
  }
  return BOM + lines.join('\n');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = getRoom(code);
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'poll' | 'qa' | 'wordcloud';
  const interactionId = searchParams.get('interactionId');

  if (!type || !interactionId) {
    return NextResponse.json({ error: 'type and interactionId required' }, { status: 400 });
  }

  let csv: string;

  switch (type) {
    case 'poll': {
      const results = getVoteResults(interactionId);
      csv = formatCsv(['选项', '票数', '百分比'], results.options.map(o => {
        const pct = results.total > 0 ? Math.round((o.count / results.total) * 100) + '%' : '0%';
        return [o.option_text, String(o.count), pct];
      }));
      break;
    }
    case 'qa': {
      const questions = getQuestions(interactionId) as Record<string, unknown>[];
      csv = formatCsv(['问题', '提问者', '赞数', '状态', '时间'], questions.map((q) => [
        String(q.content || ''),
        String(q.asker_name || ''),
        String(q.upvotes || 0),
        q.answered ? '已回答' : '待回答',
        String(q.created_at || ''),
      ]));
      break;
    }
    case 'wordcloud': {
      const words = getWordCloudData(interactionId);
      csv = formatCsv(['词汇', '频次'], words.map((w: { word: string; count: number }) => [
        w.word, String(w.count),
      ]));
      break;
    }
    default:
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-${interactionId.slice(0, 6)}.csv"`,
    },
  });
}
