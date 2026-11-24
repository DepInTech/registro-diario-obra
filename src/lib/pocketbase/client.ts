import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export { pb }
export default pb

/**
 * Encerra conexões realtime ativas do PocketBase.
 * Usado pelo SyncContext e AuthContext ao trocar de sessão/dispositivo.
 */
export function forceRealtimeTeardown() {
  try {
    pb.realtime?.unsubscribe()
  } catch {
    // noop: teardown best-effort, nunca deve quebrar logout/sync
  }
}
