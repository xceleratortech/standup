'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function LoadingBar() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Reset loading state for new navigations
    setLoading(true);
    setProgress(0);

    // Begin progress animation
    const timer1 = setTimeout(() => setProgress(30), 100);
    const timer2 = setTimeout(() => setProgress(60), 500);
    const timer3 = setTimeout(() => setProgress(80), 1000);
    const timer4 = setTimeout(() => {
      setProgress(100);
      const finalTimer = setTimeout(() => {
        setLoading(false);
      }, 200);

      return () => clearTimeout(finalTimer);
    }, 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [pathname, searchParams]);

  return (
    <div
      className={cn(
        'fixed top-0 right-0 left-0 z-50 h-1 transform bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-in-out',
        loading ? 'opacity-100' : 'opacity-0'
      )}
      style={{
        width: `${progress}%`,
        transition: 'width 0.5s ease-in-out',
      }}
    />
  );
}
