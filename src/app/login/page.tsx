import { Authenticate } from '@/components/auth';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/components/ui/link';

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If already authenticated, redirect to main app
  if (session) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Auth form */}
      <div className="w-full max-w-md">
        <Authenticate />

        {/* Navigation links below the form */}
        <div className="mt-8 text-center">
          <Link
            href="/home"
            className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to home page
          </Link>
        </div>
      </div>
    </div>
  );
}
