import { VoiceSample } from '../voice-setup-page';
import { Trash2, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AudioPlayer } from '@/components/ui/audio-player';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VoiceSampleListProps {
  samples: VoiceSample[];
  onSampleDelete: (sampleId: string) => void;
  togglePlayAudio: (sampleId: string) => void;
  onRerecord?: (sampleIndex: number) => void; // New prop for re-recording
}

export function VoiceSampleList({
  samples,
  onSampleDelete,
  togglePlayAudio,
  onRerecord,
}: VoiceSampleListProps) {
  if (samples.length === 0) {
    return null;
  }

  // Extract sample number from name if possible
  const getSampleNumber = (sampleName: string): number | null => {
    const match = sampleName.match(/Sample\s+(\d):/i);
    return match ? parseInt(match[1]) : null;
  };

  return (
    <div className="mb-6 space-y-4">
      <h2 className="text-xl font-semibold">Your Voice Samples</h2>
      <div className="space-y-3">
        {samples.map((sample) => {
          const sampleNumber = getSampleNumber(sample.sampleName);

          return (
            <Card key={sample.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{sample.sampleName}</CardTitle>
                  <div className="flex space-x-1">
                    {onRerecord && sampleNumber && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onRerecord(sampleNumber)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Re-record this sample</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onSampleDelete(sample.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete this sample</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-normal">
                    {sample.duration || '00:00'}
                  </Badge>
                  {sample.createdAt && (
                    <p className="text-muted-foreground text-xs">
                      {formatDistanceToNow(sample.createdAt, { addSuffix: true })}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-1 pb-3">
                {sample.audioUrl && (
                  <AudioPlayer
                    src={sample.audioUrl}
                    isPlaying={sample.isPlaying || false}
                    onPlayPause={() => togglePlayAudio(sample.id)}
                    totalDurationSeconds={
                      sample.durationSeconds ? parseInt(sample.durationSeconds, 10) : undefined
                    }
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
