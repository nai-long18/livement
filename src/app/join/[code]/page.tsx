// src/app/join/[code]/page.tsx
import { AudienceView } from '@/components/audience-view';

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <AudienceView roomCode={code} />;
}
