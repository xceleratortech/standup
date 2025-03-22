import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TranscriptSpeakerProps {
  speaker: string;
  speakerInfo?: {
    userId?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isParticipant: boolean;
  };
  className?: string;
  size?: 'sm' | 'md';
}

export function TranscriptSpeaker({
  speaker,
  speakerInfo,
  className,
  size = 'sm',
}: TranscriptSpeakerProps) {
  // Get avatar size based on prop
  const avatarSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const nameSize = size === 'sm' ? 'text-xs font-medium' : 'text-sm font-medium';

  // If no speaker info, just show the raw speaker text
  if (!speakerInfo) {
    return <span className={cn('text-muted-foreground', textSize, className)}>{speaker}</span>;
  }

  // Get avatar fallback letter (first letter of name or email)
  const getFallback = () => {
    if (speakerInfo.name) return speakerInfo.name[0];
    if (speakerInfo.email) return speakerInfo.email[0];
    return speaker[0] || '?';
  };

  // Get display name (prioritize participant name > email > raw speaker text)
  const displayName = speakerInfo.name || (speakerInfo.isParticipant ? speakerInfo.email : speaker);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <Avatar className={avatarSize}>
        <AvatarImage src={speakerInfo.image || undefined} />
        <AvatarFallback className={textSize}>{getFallback()}</AvatarFallback>
      </Avatar>

      <div className="flex flex-col leading-tight">
        <span className={nameSize}>{displayName}</span>

        {/* Show email as subtitle if we have a name and email is different from display name */}
        {speakerInfo.email && speakerInfo.name && speakerInfo.email !== displayName && (
          <span className={cn('text-muted-foreground', size === 'sm' ? 'text-[10px]' : 'text-xs')}>
            {speakerInfo.email}
          </span>
        )}
      </div>
    </div>
  );
}

export function TranscriptSpeakerLabel({
  speaker,
  speakerMap,
  className,
  size = 'sm',
}: {
  speaker: string;
  speakerMap: Map<string, any>;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const speakerInfo = speakerMap.get(speaker);
  return (
    <TranscriptSpeaker
      speaker={speaker}
      speakerInfo={speakerInfo}
      className={className}
      size={size}
    />
  );
}
