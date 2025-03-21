import { useEffect, useRef, useState } from 'react';

export function useResizeObserver<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [rect, setRect] = useState<DOMRectReadOnly | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect) {
        setRect(entry.contentRect);
      }
    });

    observer.observe(element);

    // Initial measurement
    setRect(element.getBoundingClientRect());

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, rect] as const;
}
