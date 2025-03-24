/**
 * Sample texts for voice identification.
 * These are designed to:
 * 1. Be short enough for a quick recording
 * 2. Cover common words used in meetings
 * 3. Provide diverse speech patterns for better voice identification
 */

export const voiceSampleTexts = [
  {
    id: 1,
    title: 'Introduction',
    text: "Hi team, I wanted to share a quick update on our project. We're making good progress and staying on track.",
  },
  {
    id: 2,
    title: 'Question',
    text: 'I have a question about the timeline. Could we discuss this in more detail during our next meeting?',
  },
  {
    id: 3,
    title: 'Summary',
    text: "Let's review our action items: update documentation, contact the client, and finish the design by Friday.",
  },
];

export const getVoiceSampleText = (sampleNumber: number) => {
  // Ensure we get a valid sample (1-3)
  const index = Math.min(Math.max(sampleNumber, 1), 3) - 1;
  return voiceSampleTexts[index];
};
