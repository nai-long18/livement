// src/app/room/[code]/present/page.tsx
import { PresentationView } from '@/components/presentation-view';

export default async function PresentPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <PresentationView roomCode={code} />;
}
