import { Metadata } from 'next';
import { getUserVoiceIdentity } from '@/lib/actions/workspace';
import { VoiceSetupPage } from '@/components/voice-setup-page';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Voice Identity Setup | Standup',
  description: 'Set up your voice identity to improve meeting transcription accuracy',
};

export default async function VoiceSetupPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const voiceIdentities = await getUserVoiceIdentity({ workspaceId: id });

  // Pass data to client component
  return <VoiceSetupPage workspaceId={id} initialVoiceIdentities={voiceIdentities.data || []} />;
}
