import { Button } from '@/components/ui/button';

interface DeleteConfirmDialogProps {
  showDialog: boolean;
  deleteAllSamples: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  showDialog,
  deleteAllSamples,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  if (!showDialog) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="text-xl font-semibold">
          {deleteAllSamples ? 'Delete All Voice Samples?' : 'Delete Voice Sample?'}
        </h2>
        <p className="text-muted-foreground my-4">
          {deleteAllSamples
            ? 'Are you sure you want to delete all your voice samples? This action cannot be undone.'
            : 'Are you sure you want to delete this voice sample? This action cannot be undone.'}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {deleteAllSamples ? 'Delete All Samples' : 'Delete Sample'}
          </Button>
        </div>
      </div>
    </div>
  );
}
