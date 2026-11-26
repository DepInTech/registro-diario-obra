import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Desconecta o canal realtime do PocketBase. Usado por AuthContext e
 * SyncContext (logout/troca de usuário). IMPORTANTE: usar apenas
 * pb.realtime.unsubscribe() — pb.realtime.destroy() não existe no SDK.
 */
export function forceRealtimeTeardown() {
  try {
    void pb.realtime.unsubscribe()
  } catch {
    // teardown é best-effort
  }
}

export { pb }
export default pb
