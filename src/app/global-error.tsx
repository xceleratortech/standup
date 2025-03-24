'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Home, LogIn, LogOut, RotateCcw } from 'lucide-react';
import { signOut } from '@/lib/auth-client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  const handleLogout = async () => {
    // Clear any authentication tokens from storage
    await signOut();

    // Redirect to home page
    router.push('/');
  };

  return (
    <html lang="en">
      <body className="bg-background font-sans">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="bg-card text-card-foreground w-full max-w-md overflow-hidden rounded-lg shadow-lg">
            <div className="flex flex-col items-center space-y-1 p-6 pb-2">
              <AlertCircle className="text-destructive mb-2 h-16 w-16" />
              <h1 className="text-xl font-semibold">Something went wrong</h1>
            </div>
            <div className="space-y-4 p-6 pt-0">
              <p className="text-muted-foreground text-center">
                We're sorry, but we encountered an unexpected issue.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <div className="bg-muted rounded-md p-4 text-sm">
                  <p className="font-mono break-words">{error.message}</p>
                  {error.digest && (
                    <p className="text-muted-foreground mt-2 font-mono text-xs">
                      Error ID: {error.digest}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col space-y-2 pt-2">
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={reset}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap shadow"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Try Again
                  </button>
                  <Link
                    href="/"
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Link>
                </div>
                <div className="grid w-full grid-cols-2 gap-2">
                  <button
                    onClick={handleLogout}
                    className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
