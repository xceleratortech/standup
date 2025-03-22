'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, createContext, useContext } from 'react';

// Create a context for transcription state
interface TranscriptionContextType {
  isGenerating: boolean;
  setIsGenerating: (state: boolean) => void;
}

const TranscriptionContext = createContext<TranscriptionContextType | undefined>(undefined);

export function useTranscriptionContext() {
  const context = useContext(TranscriptionContext);
  if (context === undefined) {
    throw new Error('useTranscriptionContext must be used within a TranscriptionProvider');
  }
  return context;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TranscriptionContext.Provider value={{ isGenerating, setIsGenerating }}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </TranscriptionContext.Provider>
    </QueryClientProvider>
  );
}
