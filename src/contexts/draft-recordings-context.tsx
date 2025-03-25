'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  ) => Promise<string | null>;
  deleteDraftRecording: (id: string) => Promise<void>;
  getDraftRecordingById: (id: string) => DraftRecording | undefined;
}

const DraftRecordingsContext = createContext<DraftRecordingsContextType | undefined>(undefined);

// IndexedDB setup
const DB_NAME = 'StandupRecordingsDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Helper function to open IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(new Error('Failed to open IndexedDB'));

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// Completely rewritten IndexedDB operations
export function DraftRecordingsProvider({ children }: { children: ReactNode }) {
  const [draftRecordings, setDraftRecordings] = useState<DraftRecording[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load draft recordings from IndexedDB on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      loadRecordingsFromIndexedDB();
    }
  }, [isInitialized]);

  // Load recordings from IndexedDB with simplified approach
  const loadRecordingsFromIndexedDB = async () => {
    if (typeof window === 'undefined') return;

    try {
      // Open database first
      const db = await openDB();

      // Simple promise-based transaction
      const getRecordingsFromDB = () =>
        new Promise<any[]>((resolve, reject) => {
          try {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => {
              console.error('Error getting recordings', event);
              reject(new Error('Failed to get recordings'));
            };
          } catch (error) {
            console.error('Transaction error', error);
            reject(error);
          }
        });

      // Get recordings and process them
      const storedRecordings = await getRecordingsFromDB();

      if (storedRecordings && storedRecordings.length > 0) {
        const processedRecordings = storedRecordings.map((recording) => ({
          ...recording,
          blob: new Blob([recording.blobArrayBuffer], {
            type: recording.blobType || 'audio/mp3',
          }),
        }));

        setDraftRecordings(processedRecordings);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to load draft recordings from IndexedDB:', error);
      fallbackToLocalStorage();
      setIsInitialized(true);
    }
  };

  // Try to load from localStorage if IndexedDB fails
  const fallbackToLocalStorage = () => {
    if (typeof window === 'undefined') return;

    try {
      const draftsJson = localStorage.getItem('draftRecordings');
      if (draftsJson) {
        const allDrafts = JSON.parse(draftsJson);
        if (Array.isArray(allDrafts)) {
          const processedDrafts = allDrafts.map((draft: any) => ({
            ...draft,
            blob: new Blob([new Uint8Array(draft.blobData)], {
              type: draft.blobType || 'audio/mp3',
            }),
          }));

          setDraftRecordings(processedDrafts);

          // Migrate data to IndexedDB - but do this after a delay
          setTimeout(() => {
            processedDrafts.forEach((draft) => {
              migrateRecordingToIndexedDB(draft).catch((err) =>
                console.error(`Migration failed for recording ${draft.id}:`, err)
              );
            });
          }, 2000);
        }
      }
    } catch (localStorageError) {
      console.error('Failed to load from localStorage fallback:', localStorageError);
    }
  };

  // Special method just for migration to avoid transaction issues
  const migrateRecordingToIndexedDB = async (recording: DraftRecording): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const db = await openDB();

      return new Promise<void>((resolve, reject) => {
        try {
          // Create a new transaction for each migration
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          // Convert blob to ArrayBuffer for storage
          const reader = new FileReader();
          reader.readAsArrayBuffer(recording.blob);

          reader.onload = () => {
            try {
              const blobArrayBuffer = reader.result as ArrayBuffer;

              // Prepare the record
              const recordingToStore = {
                id: recording.id,
                duration: recording.duration,
                createdAt: recording.createdAt,
                name: recording.name,
                blobArrayBuffer,
                blobType: recording.blob.type,
                formattedDuration: recording.formattedDuration,
              };

              // Store it
              const request = store.put(recordingToStore);

              request.onsuccess = () => resolve();
              request.onerror = (event) => {
                console.error('Put error during migration', event);
                reject(new Error('Failed to migrate recording'));
              };
            } catch (error) {
              console.error('Error in reader onload', error);
              reject(error);
            }
          };

          reader.onerror = () => {
            reject(new Error('Failed to read blob during migration'));
          };

          transaction.oncomplete = () => resolve();
          transaction.onerror = (event) => {
            console.error('Transaction error during migration', event);
            reject(new Error('Transaction failed during migration'));
          };
        } catch (error) {
          console.error('Error setting up migration transaction', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error opening DB for migration:', error);
      throw error;
    }
  };

  // Save a recording to IndexedDB - completely rewritten
  const saveRecordingToIndexedDB = async (recording: DraftRecording): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const db = await openDB();

      // Use FileReader to get ArrayBuffer from Blob
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsArrayBuffer(recording.blob);
      });

      // Create object to store
      const recordingToStore = {
        id: recording.id,
        duration: recording.duration,
        createdAt: recording.createdAt,
        name: recording.name,
        blobArrayBuffer: arrayBuffer,
        blobType: recording.blob.type,
        formattedDuration: recording.formattedDuration,
      };

      // Simple promise-based transaction
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          const request = store.put(recordingToStore);

          request.onsuccess = () => {
            console.log(`Successfully saved recording ${recording.id}`);
            resolve();
          };

          request.onerror = (event) => {
            console.error('Error saving recording', event);
            reject(new Error('Failed to save recording to IndexedDB'));
          };

          transaction.onerror = (event) => {
            console.error('Transaction error when saving', event);
            reject(new Error('Transaction failed when saving'));
          };
        } catch (error) {
          console.error('Error in save transaction setup', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error in saveRecordingToIndexedDB:', error);
      throw error;
    }
  };

  // Delete a recording from IndexedDB - completely rewritten
  const deleteRecordingFromIndexedDB = async (id: string): Promise<void> => {
    if (typeof window === 'undefined') return;

    try {
      const db = await openDB();

      // Simple promise-based transaction
      return new Promise<void>((resolve, reject) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          const request = store.delete(id);

          request.onsuccess = () => {
            console.log(`Successfully deleted recording ${id}`);
            resolve();
          };

          request.onerror = (event) => {
            console.error('Error deleting recording', event);
            reject(new Error('Failed to delete recording from IndexedDB'));
          };

          transaction.onerror = (event) => {
            console.error('Transaction error when deleting', event);
            reject(new Error('Transaction failed when deleting'));
          };
        } catch (error) {
          console.error('Error in delete transaction setup', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Error in deleteRecordingFromIndexedDB:', error);
      throw error;
    }
  };

  // Add a new recording to drafts - now async
  const addDraftRecording = async (
    blob: Blob,
    durationSeconds: number,
    formattedDuration?: string
  ): Promise<string | null> => {
    try {
      const newDraft: DraftRecording = {
        id: crypto.randomUUID(),
        blob,
        duration: durationSeconds,
        createdAt: new Date().toISOString(),
        name: `Recording ${new Date().toLocaleString()}`,
        formattedDuration,
      };

      // Update state first
      const updatedDrafts = [...draftRecordings, newDraft];
      setDraftRecordings(updatedDrafts);

      // Then save to IndexedDB
      await saveRecordingToIndexedDB(newDraft);

      // Update metadata in localStorage for cross-tab communication
      const metadataList = updatedDrafts.map((draft) => ({
        id: draft.id,
        duration: draft.duration,
        createdAt: draft.createdAt,
        name: draft.name,
        formattedDuration: draft.formattedDuration,
        blobType: draft.blob.type,
      }));

      localStorage.setItem('draftRecordingsMetadata', JSON.stringify(metadataList));

      return newDraft.id;
    } catch (error) {
      console.error('Failed to save draft recording:', error);
      return null;
    }
  };

  // Delete a draft recording - now async
  const deleteDraftRecording = async (id: string): Promise<void> => {
    try {
      const updatedDrafts = draftRecordings.filter((draft) => draft.id !== id);
      setDraftRecordings(updatedDrafts);

      // Delete from IndexedDB
      await deleteRecordingFromIndexedDB(id);

      // Update metadata in localStorage
      const metadataList = updatedDrafts.map((draft) => ({
        id: draft.id,
        duration: draft.duration,
        createdAt: draft.createdAt,
        name: draft.name,
        formattedDuration: draft.formattedDuration,
        blobType: draft.blob.type,
      }));

      if (metadataList.length === 0) {
        localStorage.removeItem('draftRecordingsMetadata');
      } else {
        localStorage.setItem('draftRecordingsMetadata', JSON.stringify(metadataList));
      }
    } catch (error) {
      console.error('Failed to delete draft recording:', error);
      throw error;
    }
  };

  // Listen for storage events from other tabs using the metadata
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'draftRecordingsMetadata' && isInitialized) {
        // Reload recordings from IndexedDB when metadata changes in another tab
        loadRecordingsFromIndexedDB();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isInitialized]);

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
    throw new Error('useDraftRecordings must be used within a DraftRecordingsProvider');
  }
  return context;
}
