'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InferSelectModel } from 'drizzle-orm';
import { userVoiceIdentity } from '@/lib/db/schema';
import { useVoiceIdentityOperations } from '@/lib/hooks/use-queries';

import { IntroductionStep } from '@/components/voice-setup/introduction-step';
import { toast } from 'sonner';
import { deleteUserVoiceIdentity, deleteUserVoiceIdentitySample } from '@/lib/actions/workspace';
import { CompletionStep } from './voice-setup/completion-step';
import { DeleteConfirmDialog } from './voice-setup/delete-confirm-dialog';
import { RecordStep } from './voice-setup/record-step';

interface VoiceSetupPageProps {
  workspaceId: string;
  initialVoiceIdentities: InferSelectModel<typeof userVoiceIdentity>[];
}

export interface VoiceSample {
  id: string;
  fileKey: string;
  sampleName: string;
  duration?: string;
  durationSeconds?: string;
  createdAt?: Date;
  audioUrl?: string;
  isPlaying?: boolean;
}

export function VoiceSetupPage({ workspaceId, initialVoiceIdentities }: VoiceSetupPageProps) {
  const [step, setStep] = useState(0);
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [allSamplesCompleted, setAllSamplesCompleted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sampleToDelete, setSampleToDelete] = useState<string | null>(null);
  const [deleteAllSamples, setDeleteAllSamples] = useState(false);

  const router = useRouter();
  const { invalidateVoiceIdentity } = useVoiceIdentityOperations();

  // Initialize voice samples from provided identities
  useEffect(() => {
    if (initialVoiceIdentities && initialVoiceIdentities.length > 0) {
      const samples = initialVoiceIdentities.map((identity) => ({
        id: identity.id,
        fileKey: identity.fileKey,
        sampleName:
          identity.sampleName || `Voice Sample ${initialVoiceIdentities.indexOf(identity) + 1}`,
        duration: identity.duration || '00:00',
        durationSeconds: identity.durationSeconds || '0',
        createdAt: identity.createdAt ? new Date(identity.createdAt) : undefined,
        isPlaying: false,
      }));
      setVoiceSamples(samples);
      setAllSamplesCompleted(samples.length >= 3);

      // If we already have samples, start at the review step
      if (samples.length > 0) {
        setStep(1);
      }
    }
  }, [initialVoiceIdentities]);

  const handleDeleteSample = (sampleId: string) => {
    setSampleToDelete(sampleId);
    setDeleteAllSamples(false);
    setShowDeleteConfirm(true);
  };

  const handleDeleteAllSamples = () => {
    setSampleToDelete(null);
    setDeleteAllSamples(true);
    setShowDeleteConfirm(true);
  };

  const deleteSample = async () => {
    try {
      if (deleteAllSamples) {
        await deleteUserVoiceIdentity({ workspaceId });
        toast.success('All voice samples deleted');
        setVoiceSamples([]);
        setAllSamplesCompleted(false);
        setStep(0); // Go back to introduction step
      } else if (sampleToDelete) {
        await deleteUserVoiceIdentitySample({ workspaceId, sampleId: sampleToDelete });
        toast.success('Voice sample deleted');

        // Remove from our local state
        setVoiceSamples((prev) => prev.filter((sample) => sample.id !== sampleToDelete));

        // Update completion status
        setAllSamplesCompleted(voiceSamples.length - 1 >= 3);
      }

      setShowDeleteConfirm(false);
      setSampleToDelete(null);
      setDeleteAllSamples(false);

      // Invalidate queries to refresh the data
      invalidateVoiceIdentity(workspaceId);
    } catch (error) {
      toast.error('Failed to delete voice sample');
      console.error('Error deleting voice sample:', error);
    }
  };

  const returnToWorkspace = () => {
    router.push(`/workspace/${workspaceId}`);
  };

  // Handle moving between steps
  const goToStep = (stepNumber: number) => {
    setStep(stepNumber);
  };

  // Handle when recording is complete and saved
  const onRecordingSaved = (updatedSamples: VoiceSample[]) => {
    setVoiceSamples(updatedSamples);
    setAllSamplesCompleted(updatedSamples.length >= 3);

    // If all samples completed, go to completion step
    if (updatedSamples.length >= 3) {
      setStep(2);
    }
  };

  // Handle toggling audio playback
  const togglePlayAudio = (sampleId: string) => {
    setVoiceSamples((prev) =>
      prev.map((sample) => ({
        ...sample,
        isPlaying: sample.id === sampleId ? !sample.isPlaying : false,
      }))
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return <IntroductionStep onContinue={() => goToStep(1)} />;
      case 1:
        return (
          <RecordStep
            workspaceId={workspaceId}
            voiceSamples={voiceSamples}
            onSampleDeleted={handleDeleteSample}
            onDeleteAll={handleDeleteAllSamples}
            onBackClick={() => goToStep(0)}
            onContinueClick={() => goToStep(2)}
            allSamplesCompleted={allSamplesCompleted}
            togglePlayAudio={togglePlayAudio}
            onRecordingSaved={onRecordingSaved}
          />
        );
      case 2:
        return (
          <CompletionStep
            onReturnToWorkspace={returnToWorkspace}
            onReviewSamples={() => goToStep(1)}
          />
        );
      default:
        return <IntroductionStep onContinue={() => goToStep(1)} />;
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12 pb-20">
      {renderStep()}

      <DeleteConfirmDialog
        showDialog={showDeleteConfirm}
        deleteAllSamples={deleteAllSamples}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSampleToDelete(null);
          setDeleteAllSamples(false);
        }}
        onConfirm={deleteSample}
      />
    </div>
  );
}
