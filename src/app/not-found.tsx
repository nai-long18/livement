import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        <p className="text-6xl">?</p>
        <h2 className="text-xl font-semibold">页面不存在</h2>
        <p className="text-slate-500 text-sm">你访问的页面不存在或已被移除。</p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
