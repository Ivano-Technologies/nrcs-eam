/** Offline mutation queue (GRN drafts) — persisted in localStorage until connectivity returns. */

export type GrnOfflineOperation =
  | {
      id: string;
      kind: "createDraft";
      payload: unknown;
      createdAt: number;
    }
  | {
      id: string;
      kind: "updateDraft";
      documentId: number;
      payload: unknown;
      createdAt: number;
    };

const STORAGE_KEY = "nrcs-eam-offline-queue-v1";
const QUEUE_CHANGED = "offline-queue-changed";

function readQueue(): GrnOfflineOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GrnOfflineOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: GrnOfflineOperation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED));
}

export function getOfflineQueueCount(): number {
  return readQueue().length;
}

export type GrnOfflineOperationInput =
  | { kind: "createDraft"; payload: unknown }
  | { kind: "updateDraft"; documentId: number; payload: unknown };

export function enqueueGrnOperation(op: GrnOfflineOperationInput) {
  const item: GrnOfflineOperation = {
    ...op,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  } as GrnOfflineOperation;
  writeQueue([...readQueue(), item]);
  return item.id;
}

export function peekGrnOperations(): GrnOfflineOperation[] {
  return readQueue();
}

export function replaceGrnQueue(items: GrnOfflineOperation[]) {
  if (items.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    writeQueue(items);
  }
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED));
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(QUEUE_CHANGED, handler);
  return () => window.removeEventListener(QUEUE_CHANGED, handler);
}
