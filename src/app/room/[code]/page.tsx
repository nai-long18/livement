// src/app/room/[code]/page.tsx
import { CreatorDashboard } from '@/components/creator-dashboard';

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CreatorDashboard roomCode={code} />;
}
