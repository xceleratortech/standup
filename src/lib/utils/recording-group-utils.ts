import { DraftRecording } from '@/contexts/draft-recordings-context';

/**
 * Creates a new recording group ID
 * @returns A string UUID for the new group
 */
export function createRecordingGroupId(): string {
  return crypto.randomUUID();
}

/**
 * Assigns group information to an array of recordings
 *
 * @param recordings Array of recordings to group together
 * @param groupId Optional group ID (will generate one if not provided)
 * @returns The modified recordings with group information
 */
export function assignRecordingGroup(
  recordings: DraftRecording[],
  groupId?: string
): DraftRecording[] {
  const groupIdToUse = groupId || createRecordingGroupId();

  return recordings.map((recording, index) => ({
    ...recording,
    groupId: groupIdToUse,
    segmentIndex: index,
  }));
}

/**
 * Calculates the total duration of a group of recordings
 *
 * @param recordings Array of recordings in the group
 * @returns Total duration in seconds
 */
export function calculateGroupDuration(recordings: DraftRecording[]): number {
  return recordings.reduce((sum, recording) => sum + recording.duration, 0);
}

/**
 * Formats a duration in seconds to MM:SS format
 *
 * @param durationSeconds Duration in seconds
 * @returns Formatted duration string (MM:SS)
 */
export function formatDuration(durationSeconds: number): string {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.floor(durationSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Creates metadata for a recording group
 *
 * @param recordings Array of recordings in the group
 * @param groupId Group ID
 * @param groupName Optional name for the group
 * @returns Object with group metadata
 */
export function createGroupMetadata(
  recordings: DraftRecording[],
  groupId: string,
  groupName?: string
) {
  const totalDuration = calculateGroupDuration(recordings);
  const createdAt = recordings[0]?.createdAt || new Date().toISOString();

  return {
    id: groupId,
    name: groupName || `Recording Group ${new Date().toLocaleString()}`,
    createdAt,
    totalDuration,
    segmentCount: recordings.length,
    formattedDuration: formatDuration(totalDuration),
  };
}
