import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CassetteTape } from 'lucide-react';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export default async function Home() {
  // Check auth status to show correct CTA
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const features = [
    {
      title: 'Meeting Outcomes',
      description: 'Extract personalized action items and summaries for individuals or teams',
      icon: '✓',
    },
    {
      title: 'Audio Diarization',
      description: 'Split audio into different speaker streams for clear attribution',
      icon: '🔊',
    },
    {
      title: 'Voice Recognition',
      description: 'Identify speakers by their unique voice patterns',
      icon: '🎙️',
    },
    {
      title: 'Auto Organization',
      description: 'Auto-identify speakers and add them as meeting participants',
      icon: '🔄',
    },
  ];

  const steps = [
    'Create a workspace for your team',
    'Invite team members and setup voice IDs',
    'Create meetings and add participants',
    'Record meeting discussions',
    'Generate personalized action items and summaries',
  ];

  return (
    <main className="bg-background flex min-h-screen flex-col items-center">
      {/* Navigation */}
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
              {session ? <Link href="/">Dashboard</Link> : <Link href="/login">Sign In</Link>}
            </Button>
          </nav>

          {/* Mobile menu button - Static version */}
          <div className="flex md:hidden">
            <Button variant="outline" size="icon" className="h-10 w-10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" x2="21" y1="6" y2="6" />
                <line x1="3" x2="21" y1="12" y2="12" />
                <line x1="3" x2="21" y1="18" y2="18" />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section - simplified CTAs */}
      <section className="w-full py-24 md:py-32">
        <div className="container mx-auto max-w-7xl space-y-10 px-4 text-center md:px-8">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className="rounded-md px-3 py-1 text-sm font-medium tracking-wider uppercase"
              >
                Alpha Release
              </Badge>
            </div>
            <h1 className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text pb-1 text-5xl font-bold text-transparent md:text-6xl">
              Extract meaning, not minutes
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl md:text-2xl">
              Use AI to transcribe, separate speakers, and extract personalized action items from
              real-life meetings. No more wasted time.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            {session ? (
              <Button asChild size="lg" className="h-12 px-8">
                <Link href="/">Continue to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="h-12 px-8">
                  <Link href="/login?tab=signup">Create Account</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8">
                  <a
                    href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fxrehpicx%2Fstandup.git"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Deploy Your Own
                  </a>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Problem statement section - improved layout */}
      <section className="w-full border-t border-b py-16">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-12 space-y-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight">The meeting problem</h2>
            <p className="text-muted-foreground mx-auto max-w-3xl text-lg">
              In-person meetings are recorded as a single audio stream, with all voices merged
              together. This makes it impossible for AI to distinguish who said what, leaving you
              with no way to extract what actually matters to you.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-muted/40 border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Traditional meeting recording
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-mono text-sm">
                <p>
                  <span className="text-primary">00:01:23</span> → "I think we should prioritize the
                  frontend work..."
                </p>
                <p>
                  <span className="text-primary">00:02:47</span> → "No, we need to focus on the API
                  first because..."
                </p>
                <p>
                  <span className="text-primary">00:04:15</span> → "Let's create a plan to address
                  both concerns..."
                </p>
                <p className="text-muted-foreground mt-4 italic">
                  Who said what? What's relevant to you?
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-primary text-sm font-medium">With STANDUP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-blue-100 text-xs text-blue-600">
                        A
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Alex</span>
                  </div>
                  <p>
                    <span className="text-primary text-xs">00:01:23</span> "I think we should
                    prioritize the frontend work..."
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-green-100 text-xs text-green-600">
                        M
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Maya</span>
                  </div>
                  <p>
                    <span className="text-primary text-xs">00:02:47</span> "No, we need to focus on
                    the API first because..."
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-amber-100 text-xs text-amber-600">
                        J
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">Jamie</span>
                  </div>
                  <p>
                    <span className="text-primary text-xs">00:04:15</span> "Let's create a plan to
                    address both concerns..."
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section - with improved styling */}
      <section id="features" className="w-full bg-slate-50 py-24">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-16 space-y-4 text-center">
            <Badge
              variant="outline"
              className="rounded-md px-3 py-1 text-sm font-medium tracking-wider uppercase"
            >
              Features
            </Badge>
            <h2 className="text-4xl font-bold tracking-tight">Transform how you handle meetings</h2>
            <p className="text-muted-foreground mx-auto max-w-3xl text-lg">
              STANDUP uses voice recognition and AI to personalize meeting outcomes for each
              participant
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <Card key={index} className="border-none shadow-md">
                <CardHeader>
                  <div className="text-primary mb-3 text-3xl">{feature.icon}</div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section - redesigned to be more compact */}
      <section id="how-it-works" className="w-full py-24">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-12 space-y-4 text-center">
            <Badge
              variant="outline"
              className="rounded-md px-3 py-1 text-sm font-medium tracking-wider uppercase"
            >
              Workflow
            </Badge>
            <h2 className="text-4xl font-bold tracking-tight">How it works</h2>
            <p className="text-muted-foreground mx-auto max-w-3xl text-lg">
              Streamlined workflow designed for productive teams
            </p>
          </div>

          <div className="mx-auto max-w-lg">
            <ol className="border-primary/30 relative space-y-10 border-l">
              {steps.map((step, index) => (
                <li key={index} className="ml-6">
                  <span className="bg-primary text-primary-foreground absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full">
                    {index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{step}</h3>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-16 flex justify-center">
            <Button asChild size="lg">
              <Link href="https://standup.raj.how">Start using STANDUP</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Tech Stack Section - updated styling */}
      {/* <section className="w-full bg-slate-50 py-24">
        <div className="container mx-auto max-w-7xl px-4 md:px-8">
          <div className="mb-12 space-y-4 text-center">
            <Badge
              variant="outline"
              className="rounded-md px-3 py-1 text-sm font-medium tracking-wider uppercase"
            >
              Technology
            </Badge>
            <h2 className="text-4xl font-bold tracking-tight">Built with modern tech</h2>
            <p className="text-muted-foreground mx-auto max-w-3xl text-lg">
              Leveraging cutting-edge AI and web technologies
            </p>
          </div>

          <div className="mb-8 flex flex-wrap justify-center gap-3">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Next.js 15
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Gemini AI
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Node.js
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              Bun
            </Badge>
          </div>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground italic">
              ⚠️ This project is currently in alpha stage. I'm actively improving it!
            </p>
          </div>
        </div>
      </section> */}

      {/* CTA Section - simplified and more focused */}
      <section className="bg-primary text-primary-foreground w-full py-24">
        <div className="container mx-auto max-w-7xl space-y-10 px-4 text-center md:px-8">
          <div className="space-y-6">
            <h2 className="text-4xl font-bold tracking-tight">
              Ready to make meetings productive again?
            </h2>
            <p className="text-primary-foreground/90 mx-auto max-w-2xl text-xl">
              Stop sitting through meetings that waste your time. Extract exactly what matters to
              you.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            {session ? (
              <Button asChild size="lg" variant="secondary" className="h-12 px-8">
                <Link href="/">Go to Dashboard</Link>
              </Button>
            ) : (
              <Button asChild size="lg" variant="secondary" className="h-12 px-8 shadow-lg">
                <Link href="/login?tab=signup">Get Started Now</Link>
              </Button>
            )}
            {!session && (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10 h-12 bg-transparent px-8"
              >
                <Link href="/login">Already have an account?</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer remains the same */}
      <footer className="bg-muted/40 w-full border-t">
        <div className="container mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CassetteTape className="text-primary h-6 w-6" />
                <h3 className="text-lg font-bold">STANDUP</h3>
              </div>
              <p className="text-muted-foreground max-w-sm">
                Extract meaning, not minutes. Transform your in-person meetings with AI-powered
                diarization and personalized outcomes.
              </p>
            </div>
            <div className="space-y-4 md:text-right">
              <h3 className="text-lg font-bold">Created by</h3>
              <p className="text-muted-foreground">
                <a href="https://raj.how" className="text-primary hover:underline">
                  Raj Sharma (raj.how)
                </a>
              </p>
              <div className="flex gap-4 md:justify-end">
                <a
                  href="https://github.com/xrehpicx"
                  className="text-muted-foreground hover:text-primary"
                >
                  GitHub
                </a>
                <a href="https://raj.how" className="text-muted-foreground hover:text-primary">
                  Website
                </a>
              </div>
            </div>
          </div>
          <div className="text-muted-foreground mt-8 border-t pt-8 text-center text-sm">
            <p>⚠️ This project is currently in alpha stage. I'm actively improving it!</p>
            <p className="mt-2">Released under the GPL-3.0 License</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
