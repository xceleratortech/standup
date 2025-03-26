'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CassetteTape, Menu, X } from 'lucide-react';
import { Session } from 'better-auth/types';
import { useSession } from '@/lib/auth-client';

export function HomeNavBar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { data } = useSession();

  return (
    <header className="bg-background/95 sticky top-0 z-40 w-full border-b backdrop-blur">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
            <CassetteTape className="text-primary h-6 w-6" />
            <span className="text-primary">STANDUP</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <div className="flex gap-6">
            <Link href="#features" className="hover:text-primary text-sm font-medium">
              Features
            </Link>
            <Link href="#how-it-works" className="hover:text-primary text-sm font-medium">
              How It Works
            </Link>
            <Link
              href="https://github.com/xrehpicx/standup"
              target="_blank"
              className="hover:text-primary text-sm font-medium"
            >
              GitHub
            </Link>
          </div>

          <Button asChild>
            {data ? <Link href="/">Dashboard</Link> : <Link href="/login">Sign In</Link>}
          </Button>
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="bg-background space-y-2 border-t px-4 py-4 shadow-lg">
            <Link
              href="#features"
              className="hover:bg-muted block rounded px-3 py-2 text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="hover:bg-muted block rounded px-3 py-2 text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              How It Works
            </Link>
            <Link
              href="https://github.com/xrehpicx/standup"
              target="_blank"
              className="hover:bg-muted block rounded px-3 py-2 text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              GitHub
            </Link>
            <div className="pt-2">
              <Button asChild className="w-full">
                {data ? (
                  <Link href="/" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                ) : (
                  <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                    Sign In
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
