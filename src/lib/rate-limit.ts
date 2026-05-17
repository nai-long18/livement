const rateMap = new Map<string, { count: number; resetAt: number }>();

// Periodically clean up stale entries (every 60 seconds)
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(key);
  }
}

export function rateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  cleanupStaleEntries();

  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: maxRequests - entry.count };
}

export function rateLimitByIp(
  request: Request,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { success: boolean; remaining: number } {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return rateLimit(ip, maxRequests, windowMs);
}
