'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body className="min-h-dvh flex items-center justify-center bg-background text-foreground">
        <div className="text-center space-y-4 p-8">
          <p className="text-6xl">!</p>
          <h2 className="text-xl font-semibold">出了点问题</h2>
          <p className="text-slate-500 text-sm">应用遇到了严重错误，请刷新页面重试。</p>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
