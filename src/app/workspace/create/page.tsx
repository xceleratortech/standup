'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createWorkspace } from '@/lib/actions/workspace';
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function CreateWorkspacePage() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const workspace = await createWorkspace({ name });
      router.push(`/workspace/${workspace.id}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create New Workspace</CardTitle>
          <CardDescription>Create your first workspace to get started</CardDescription>
        </CardHeader>
        <form className="space-y-2" onSubmit={handleSubmit}>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Workspace Name
                </label>
                <Input
                  id="name"
                  placeholder="My Awesome Team"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">{error}</div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <LoadingButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
              loadingText="Creating..."
            >
              Create Workspace
            </LoadingButton>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
