import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra conexões realtime ativas do cliente PocketBase.
 * Usado por AuthContext/SyncContext para limpar subscriptions ao trocar de usuário.
 */
export function forceRealtimeTeardown() {
  try {
    pb.realtime?.unsubscribe()
  } catch {
    // noop: teardown é best-effort, nunca deve quebrar logout/refresh
  }
}

export { pb }
export default pb
