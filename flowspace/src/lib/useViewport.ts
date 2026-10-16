import { useEffect, useState } from 'react';

/** True for tall, narrow viewports (phones in portrait). */
export function usePortrait() {
  const get = () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.15;
  const [p, setP] = useState(get);
  useEffect(() => {
    const on = () => setP(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return p;
}
