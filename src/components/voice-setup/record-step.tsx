import { useState } from 'react';
import { VoiceSample } from '../voice-setup-page';
import { VoiceSampleList } from './voice-sample-list';
import { Button } from '@/components/ui/button';
import { Mic, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { useVoiceIdentityDownloadUrl } from '@/lib/hooks/use-queries';
import { getVoiceSampleText } from '@/lib/config/voice-samples';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { RecordingInterface } from './recording-interface';

interface RecordStepProps {
  workspaceId: string;
  voiceSamples: VoiceSample[];
  onSampleDeleted: (sampleId: string) => void;
  onDeleteAll: () => void;
  onBackClick: () => void;
  onContinueClick: () => void;
  allSamplesCompleted: boolean;
  togglePlayAudio: (sampleId: string) => void;
  onRecordingSaved: (updatedSamples: VoiceSample[]) => void;
}

export function RecordStep({
  workspaceId,
  voiceSamples,
  onSampleDeleted,
  onDeleteAll,
  onBackClick,
  onContinueClick,
  allSamplesCompleted,
  togglePlayAudio,
  onRecordingSaved,
}: RecordStepProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSampleText, setCurrentSampleText] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [recordingSampleIndex, setRecordingSampleIndex] = useState<number | null>(null);

  const { mutateAsync: getDownloadUrl } = useVoiceIdentityDownloadUrl();

  // Determine available sample slots (1, 2, 3) that aren't yet filled
  const getAvailableSampleSlots = () => {
    const existingSamples = voiceSamples.filter((s) => s.id !== 'temp-recording');

    // Try to extract sample numbers from names (Sample 1: xyz, etc.)
    const usedSlots = existingSamples
      .map((sample) => {
        const match = sample.sampleName.match(/Sample\s+(\d):/i);
        return match ? parseInt(match[1]) : null;
      })
      .filter((num) => num !== null) as number[];

    // Return available slots (1, 2, 3)
    return [1, 2, 3].filter((num) => !usedSlots.includes(num));
  };

  // Set the appropriate sample text based on available slots
  useEffect(() => {
    if (!isRecording) {
      const availableSlots = getAvailableSampleSlots();
      // Use the first available slot or default to the next number in sequence
      const nextSlot =
        availableSlots.length > 0
          ? availableSlots[0]
          : voiceSamples.filter((s) => s.id !== 'temp-recording').length + 1;

      if (nextSlot <= 3) {
        setCurrentSampleText(getVoiceSampleText(nextSlot));
        setRecordingSampleIndex(nextSlot);
      }
    }
  }, [voiceSamples, isRecording]);

  // Fetch the audio URL for a sample
  const fetchAudioUrl = async (sampleId: string, fileKey: string) => {
    try {
      const { downloadUrl } = await getDownloadUrl(fileKey);
      return downloadUrl;
    } catch (error) {
      console.error('Error fetching audio URL:', error);
      toast.error('Failed to load voice sample');
      return undefined;
    }
  };

  const handleStartRecording = (sampleIndex?: number) => {
    if (sampleIndex) {
      // If a specific sample index is provided, use it
      setRecordingSampleIndex(sampleIndex);
      setCurrentSampleText(getVoiceSampleText(sampleIndex));
    } else {
      // Otherwise use the next available slot
      const availableSlots = getAvailableSampleSlots();
      const slotToUse =
        availableSlots.length > 0
          ? availableSlots[0]
          : voiceSamples.filter((s) => s.id !== 'temp-recording').length + 1;

      setRecordingSampleIndex(slotToUse);
      setCurrentSampleText(getVoiceSampleText(slotToUse));
    }

    setIsRecording(true);
  };

  const handleCancelRecording = () => {
    setIsRecording(false);
  };

  const handleRecordingSaved = async (newSample: VoiceSample) => {
    setIsRecording(false);

    // Add the new sample to the list but filter out any temporary recording
    const updatedSamples = [...voiceSamples.filter((s) => s.id !== 'temp-recording'), newSample];

    // Fetch the audio URL for the new sample
    if (newSample.fileKey) {
      const audioUrl = await fetchAudioUrl(newSample.id, newSample.fileKey);
      if (audioUrl) {
        // Update the sample with the audio URL
        newSample.audioUrl = audioUrl;
      }
    }

    // Let the parent component know about the updated samples
    onRecordingSaved(updatedSamples);
  };

  const samplesCount = voiceSamples.filter((s) => s.id !== 'temp-recording').length;
  const remainingSamples = 3 - samplesCount;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {allSamplesCompleted ? 'Your Voice Samples' : `Record Voice Samples (${samplesCount}/3)`}
        </h1>
        <p className="text-muted-foreground text-lg">
          {allSamplesCompleted
            ? 'All voice samples have been recorded. You can review or replace them below.'
            : `Record ${remainingSamples} more sample${remainingSamples !== 1 ? 's' : ''} to complete your voice identity.`}
        </p>
      </div>

      <div className="rounded-lg border p-6">
        {/* Voice Sample List */}
        <VoiceSampleList
          samples={voiceSamples.filter((s) => s.id !== 'temp-recording')}
          onSampleDelete={onSampleDeleted}
          togglePlayAudio={togglePlayAudio}
          onRerecord={handleStartRecording}
        />

        {/* Recording Interface or Start Recording Button */}
        {isRecording ? (
          <RecordingInterface
            workspaceId={workspaceId}
            currentSampleText={currentSampleText}
            sampleNumber={recordingSampleIndex || samplesCount + 1}
            onCancel={handleCancelRecording}
            onSaved={handleRecordingSaved}
          />
        ) : (
          // Show the start recording button if not at max samples and not already recording
          !voiceSamples.some((s) => s.id === 'temp-recording') &&
          remainingSamples > 0 &&
          !isRecording && (
            <div className="flex flex-col items-center rounded-lg border p-6">
              <h2 className="mb-4 text-xl font-semibold">
                Record Sample {recordingSampleIndex || samplesCount + 1} of 3
              </h2>
              {currentSampleText && (
                <div className="mb-4">
                  <p className="mb-2 text-center font-medium">{currentSampleText.title}</p>
                  <p className="text-muted-foreground text-center text-sm">
                    You'll be asked to read a short passage with common meeting phrases.
                  </p>
                </div>
              )}
              <Button onClick={() => handleStartRecording()} size="lg" className="mt-4">
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Button>
            </div>
          )
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" onClick={onBackClick}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Introduction
        </Button>

        <div className="flex items-center gap-2">
          {samplesCount > 0 && !isRecording && (
            <Button variant="outline" onClick={onDeleteAll} className="border-red-300">
              <Trash2 className="mr-2 h-4 w-4 text-red-500" />
              Delete All Samples
            </Button>
          )}

          {allSamplesCompleted && (
            <Button onClick={onContinueClick}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
