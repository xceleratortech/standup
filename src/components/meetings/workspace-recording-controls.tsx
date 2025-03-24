'use client';

import { RecordingControls } from './recording-controls';

interface WorkspaceRecordingControlsProps {
  workspaceId: string;
  workspaceName?: string;
}

export default function WorkspaceRecordingControls({
  workspaceId,
  workspaceName,
}: WorkspaceRecordingControlsProps) {
  return (
    <div className="bg-background sticky right-0 bottom-0 left-0 z-10">
      <div className="container mx-auto py-2">
        <RecordingControls workspaceId={workspaceId} workspaceName={workspaceName} />
      </div>
    </div>
  );
}
