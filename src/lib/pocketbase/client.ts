import PocketBase from 'pocketbase'

// URL do backend Skip Cloud — injetada em tempo de build via VITE_POCKETBASE_URL (set_env).
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
