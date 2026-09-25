import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Tears down all realtime subscriptions and aborts any active SSE connection.
 * Used by AuthContext and SyncContext to safely reset the client state.
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // Ignore teardown errors
  }
}

export default pb
