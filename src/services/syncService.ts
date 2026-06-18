const DB_NAME = 'chronicle_sync_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sync_actions';

export interface PendingSyncAction {
  id?: number;
  table: string;
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

export const queueSyncAction = async (
  table: string,
  action: 'insert' | 'update' | 'delete',
  payload: any
): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const syncAction: PendingSyncAction = {
      table,
      action,
      payload,
      timestamp: Date.now()
    };
    store.add(syncAction);
    console.log(`[Offline Sync Queue] Queued ${action} action for ${table}.`);
  } catch (err) {
    console.error('Failed to queue sync action in IndexedDB:', err);
  }
};

export const getPendingSyncActions = async (): Promise<PendingSyncAction[]> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const actions = request.result as PendingSyncAction[];
        actions.sort((a, b) => a.timestamp - b.timestamp);
        resolve(actions);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to fetch pending sync actions:', err);
    return [];
  }
};

export const deletePendingSyncAction = async (id: number): Promise<void> => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.error(`Failed to delete queued action ${id} from IndexedDB:`, err);
  }
};

// Background sync handler
import { supabase, isSupabaseConfigured } from './supabaseClient';

let isSyncing = false;

export const processSyncQueue = async (): Promise<void> => {
  if (isSyncing || !isSupabaseConfigured()) return;
  if (!navigator.onLine) return;

  const actions = await getPendingSyncActions();
  if (actions.length === 0) return;

  isSyncing = true;
  console.log(`[Offline Sync Queue] Processing ${actions.length} pending actions...`);

  for (const action of actions) {
    if (typeof action.id !== 'number') continue;
    
    try {
      const { table, action: op, payload } = action;
      let error = null;

      if (op === 'insert') {
        const { error: dbErr } = await supabase.from(table).insert(payload);
        error = dbErr;
      } else if (op === 'update') {
        if (payload.id) {
          const { error: dbErr } = await supabase.from(table).update(payload).eq('id', payload.id);
          error = dbErr;
        }
      } else if (op === 'delete') {
        if (payload.id) {
          const { error: dbErr } = await supabase.from(table).delete().eq('id', payload.id);
          error = dbErr;
        }
      }

      if (error) {
        console.error(`Supabase sync query error for ${table} ${op}:`, error);
        if (error.code && error.code.startsWith('23')) {
          // PostgreSQL Constraint Violation (discard to prevent infinite queue blocking)
          await deletePendingSyncAction(action.id);
        } else {
          // Network connection error, halt loop to try again later
          break;
        }
      } else {
        await deletePendingSyncAction(action.id);
        console.log(`[Offline Sync Queue] Successfully synced ${op} on ${table}.`);
      }
    } catch (err) {
      console.error('Exception during offline queue background sync execution:', err);
      break;
    }
  }

  isSyncing = false;
};

// Register automatic event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Connection Status] System is back online. Initiating sync...');
    processSyncQueue();
  });
  
  window.addEventListener('load', () => {
    if (navigator.onLine) {
      processSyncQueue();
    }
  });
}
