import { useEffect, useRef, useState } from 'react';

export function useSimulatedEMG(isPaused = false) {
  const [sample, setSample] = useState({ t: 0, biceps: 0 });
  const startTime = useRef(Date.now());
  const pausedRef = useRef(isPaused);

  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pausedRef.current) return;

      const t = (Date.now() - startTime.current) / 1000;
      const cycle = (Math.sin((t * 2 * Math.PI) / 2.5) + 1) / 2;
      let biceps = cycle * (0.92 + Math.random() * 0.08);

      setSample({ t, biceps: Math.min(1, Math.max(0, biceps)) });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return sample;
}