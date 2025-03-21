'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MeetingTranscriptionProps {
  transcription: string;
}

export default function MeetingTranscription({
  transcription,
}: MeetingTranscriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h2 className='flex items-center gap-2 text-xl font-semibold'>
          <FileText className='h-5 w-5' />
          Transcription
        </h2>
        <Button
          variant='ghost'
          size='sm'
          onClick={() => setIsExpanded(!isExpanded)}
          className='gap-1'
        >
          {isExpanded ? (
            <>
              <ChevronUp className='h-4 w-4' />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className='h-4 w-4' />
              Show More
            </>
          )}
        </Button>
      </div>

      <div
        className={cn(
          'overflow-hidden rounded-md border p-4',
          !isExpanded && 'max-h-40'
        )}
      >
        <div className={cn(!isExpanded && 'mask-fade')}>
          <pre className='font-sans text-sm whitespace-pre-wrap'>
            {transcription}
          </pre>
        </div>
      </div>
    </div>
  );
}
