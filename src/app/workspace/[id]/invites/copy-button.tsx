'use client';

import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function CopyLinkButton({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button size="sm" variant="outline" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy Link'}
    </Button>
  );
}
