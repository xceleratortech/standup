interface Window {
  addDraftRecording?: (
    blob: Blob,
    durationSeconds: number,
    formattedDuration?: string
  ) => string | null;
}
