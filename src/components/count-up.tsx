'use client';

import { useState, useEffect } from 'react';

export function CountUp({ target }: { target: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const duration = 500;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const linearProgress = Math.min(elapsed / duration, 1);
      const progress = 1 - Math.pow(1 - linearProgress, 3);
      setCount(Math.round(progress * target));
      if (linearProgress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);

  return <>{count}</>;
}
