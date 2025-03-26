'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Home, LogOut, RotateCcw, Mail } from 'lucide-react';
import { Link } from '@/components/ui/link';
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

    // Redirect to login page
    router.push('/');
  };

  return (
    <html>
      <body>
        <div className="bg-background flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader className="flex flex-col items-center space-y-1 pb-2">
              <AlertCircle className="text-destructive mb-2 h-16 w-16" />
              <CardTitle className="text-xl font-semibold">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="default" onClick={reset} className="w-full">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Link>
                </Button>
              </div>

              <Button variant="outline" onClick={handleLogout} className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>

              <div className="mt-4 text-center">
                <a
                  href={`mailto:standup-support@raj.how${error.digest ? `?subject=Error Report: ${error.digest}` : ''}`}
                  className="text-muted-foreground hover:text-primary inline-flex items-center text-sm"
                >
                  <Mail className="mr-1 h-3 w-3" />
                  Contact support at standup-support@raj.how
                </a>
              </div>
            </CardFooter>
          </Card>
        </div>
      </body>
    </html>
  );
}
