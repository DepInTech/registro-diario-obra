import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)

export default pb

// Teardown completo do realtime (usado por AuthContext e SyncContext no logout).
// API pública do SDK: pb.realtime.unsubscribe() sem argumentos remove todas as subscriptions.
export function forceRealtimeTeardown() {
  try {
    pb.realtime.unsubscribe()
  } catch (e) {
    console.warn('forceRealtimeTeardown:', e)
  }
}
