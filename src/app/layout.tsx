import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import NextTopLoader from 'nextjs-toploader';
import { Toaster } from '@/components/ui/sonner';
import { Providers } from '@/lib/providers';
import { DraftRecordingsProvider } from '@/contexts/draft-recordings-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Standup',
  description: 'Collaborative meeting notes and recordings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextTopLoader initialPosition={0.1} speed={400} color="#2563eb" height={2} />
        <Providers>
          <DraftRecordingsProvider>
            {children}
            <Toaster position="top-right" />
          </DraftRecordingsProvider>
        </Providers>
      </body>
    </html>
  );
}
