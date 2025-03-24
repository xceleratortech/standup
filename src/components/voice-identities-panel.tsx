'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import VoiceIdentityDialog from '@/components/voice-identity-dialog';
import { useVoiceIdentities } from '@/lib/hooks/use-queries';
import { Badge } from '@/components/ui/badge';

export function VoiceIdentitiesPanel({ workspaceId }: { workspaceId: string }) {
  const { data: voiceIdentities = [], isLoading } = useVoiceIdentities(workspaceId);

  const hasVoiceIdentities = voiceIdentities?.length > 0;
  const samplesCount = voiceIdentities?.length || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold">Voice Samples</CardTitle>
          <CardDescription>
            Record voice samples to improve speaker recognition in transcriptions
          </CardDescription>
        </div>
        <VoiceIdentityDialog
          workspaceId={workspaceId}
          hasVoiceIdentity={hasVoiceIdentities}
          voiceIdentities={voiceIdentities}
          buttonVariant="outline"
          buttonLabel={
            <>
              {hasVoiceIdentities ? 'Manage' : 'Add'} Voice Samples
              {samplesCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {samplesCount}/3
                </Badge>
              )}
            </>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground text-sm">
          {isLoading ? (
            'Loading voice samples...'
          ) : hasVoiceIdentities ? (
            <>
              <p className="mb-2">
                You've recorded {samplesCount}/3 voice samples. Each sample helps our system better
                recognize your voice during meetings.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {voiceIdentities.map((identity) => (
                  <li key={identity.id}>
                    {identity.sampleName || 'Voice Sample'} (
                    {identity.duration || 'Unknown duration'})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p>
                No voice samples added yet. Add voice samples to help identify your voice in meeting
                transcriptions.
              </p>
              <p className="mt-2">
                You'll be asked to read three short passages that include common meeting phrases to
                create your voice profile.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
