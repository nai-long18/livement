// src/hooks/use-session.ts
'use client';
import { useState, useEffect } from 'react';

export function useSessionId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    // Read session ID from cookie on client side
    const match = document.cookie.match(/(?:^|;\s*)lm_sid=([^;]*)/);
    if (match) {
      setId(match[1]);
    } else {
      // Generate a fallback for clients where httpOnly cookie fails
      const fallback = Math.random().toString(36).slice(2) + Date.now().toString(36);
      document.cookie = `lm_sid=${fallback};path=/;max-age=2592000;samesite=lax`;
      setId(fallback);
    }
  }, []);

  return id;
}
