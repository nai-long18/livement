// src/lib/session.ts
import { cookies } from 'next/headers';
import { nanoid } from 'nanoid';

const SESSION_COOKIE = 'lm_sid';

export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE);
  if (existing) return existing.value;

  const id = nanoid();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return id;
}
