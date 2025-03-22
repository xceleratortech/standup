'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

export interface DraftRecording {
  id: string;
  blob: Blob;
  duration: number;
  createdAt: string;
  name: string;
  blobData?: number[];
  blobType?: string;
  formattedDuration?: string; // MM:SS format
}

interface DraftRecordingsContextType {
  draftRecordings: DraftRecording[];
  addDraftRecording: (
    blob: Blob,
    durationSeconds: number,
    formattedDuration?: string
  ) => string | null;
  deleteDraftRecording: (id: string) => void;
  getDraftRecordingById: (id: string) => DraftRecording | undefined;
}

const DraftRecordingsContext = createContext<
  DraftRecordingsContextType | undefined
>(undefined);

export function DraftRecordingsProvider({ children }: { children: ReactNode }) {
  const [draftRecordings, setDraftRecordings] = useState<DraftRecording[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load draft recordings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      try {
        const draftsJson = localStorage.getItem('draftRecordings');
        if (draftsJson) {
          const allDrafts = JSON.parse(draftsJson);
          // Process stored drafts to recreate Blobs
          if (Array.isArray(allDrafts)) {
            const processedDrafts = allDrafts.map((draft: any) => ({
              ...draft,
              blob: new Blob([new Uint8Array(draft.blobData)], {
                type: draft.blobType || 'audio/webm',
              }),
            }));
            setDraftRecordings(processedDrafts);
          }
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to load draft recordings:', error);
        setIsInitialized(true);
      }
    }

    // Listen for storage events from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'draftRecordings') {
        try {
          const draftsJson = event.newValue;
          if (draftsJson) {
            const allDrafts = JSON.parse(draftsJson);
            if (Array.isArray(allDrafts)) {
              const processedDrafts = allDrafts.map((draft: any) => ({
                ...draft,
                blob: new Blob([new Uint8Array(draft.blobData)], {
                  type: draft.blobType || 'audio/webm',
                }),
              }));
              setDraftRecordings(processedDrafts);
            }
          } else {
            setDraftRecordings([]);
          }
        } catch (error) {
          console.error('Failed to process storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isInitialized]);

  // Expose to window for global access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).addDraftRecording = addDraftRecording;
    }
    return () => {
      if (
        typeof window !== 'undefined' &&
        'addDraftRecording' in (window as any)
      ) {
        delete (window as any).addDraftRecording;
      }
    };
  }, [draftRecordings]);

  // Add a new recording to drafts
  const addDraftRecording = (
    blob: Blob,
    durationSeconds: number,
    formattedDuration?: string
  ) => {
    try {
      const newDraft: DraftRecording = {
        id: crypto.randomUUID(),
        blob,
        duration: durationSeconds,
        createdAt: new Date().toISOString(),
        name: `Recording ${new Date().toLocaleString()}`,
        formattedDuration, // Add the formatted duration
      };

      // Update state
      const updatedDrafts = [...draftRecordings, newDraft];
      setDraftRecordings(updatedDrafts);

      // Convert blob to array buffer for storage
      const fileReader = new FileReader();
      fileReader.readAsArrayBuffer(blob);
      fileReader.onload = () => {
        const blobData = Array.from(
          new Uint8Array(fileReader.result as ArrayBuffer)
        );

        // Store all drafts with the blob data
        const draftsForStorage = updatedDrafts.map((draft) => ({
          id: draft.id,
          duration: draft.duration,
          createdAt: draft.createdAt,
          name: draft.name,
          blobData:
            draft.id === newDraft.id
              ? blobData
              : draftRecordings.find((d) => d.id === draft.id)?.blobData || [],
          blobType: blob.type,
        }));

        localStorage.setItem(
          'draftRecordings',
          JSON.stringify(draftsForStorage)
        );
      };

      return newDraft.id;
    } catch (error) {
      console.error('Failed to save draft recording:', error);
      return null;
    }
  };

  // Delete a draft recording
  const deleteDraftRecording = (id: string) => {
    try {
      const updatedDrafts = draftRecordings.filter((draft) => draft.id !== id);
      setDraftRecordings(updatedDrafts);

      // Update localStorage
      if (updatedDrafts.length === 0) {
        localStorage.removeItem('draftRecordings');
      } else {
        const draftsForStorage = updatedDrafts.map((draft) => {
          const existingDraft = draftRecordings.find((d) => d.id === draft.id);
          return {
            id: draft.id,
            duration: draft.duration,
            createdAt: draft.createdAt,
            name: draft.name,
            blobData: existingDraft?.blobData || [],
            blobType: existingDraft?.blob.type,
          };
        });

        localStorage.setItem(
          'draftRecordings',
          JSON.stringify(draftsForStorage)
        );
      }
    } catch (error) {
      console.error('Failed to delete draft recording:', error);
    }
  };

  // Get a draft recording by ID
  const getDraftRecordingById = (id: string) => {
    return draftRecordings.find((draft) => draft.id === id);
  };

  return (
    <DraftRecordingsContext.Provider
      value={{
        draftRecordings,
        addDraftRecording,
        deleteDraftRecording,
        getDraftRecordingById,
      }}
    >
      {children}
    </DraftRecordingsContext.Provider>
  );
}

export function useDraftRecordings() {
  const context = useContext(DraftRecordingsContext);
  if (context === undefined) {
    throw new Error(
      'useDraftRecordings must be used within a DraftRecordingsProvider'
    );
  }
  return context;
}
