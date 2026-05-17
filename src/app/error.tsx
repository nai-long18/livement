'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <p className="text-6xl">!</p>
        <h2 className="text-xl font-semibold">出了点问题</h2>
        <p className="text-slate-500 text-sm">页面加载时遇到了错误，请重试。</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          重试
        </button>
      </div>
    </div>
  );
}
