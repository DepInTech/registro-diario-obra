import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/** Encerra assinaturas realtime ativas (usado por AuthContext e SyncContext no logout).
 *  IMPORTANTE: usa apenas pb.realtime.unsubscribe() — pb.realtime.destroy() não existe
 *  no tipo RealtimeService e quebra o tsc. */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // silencioso: nada inscrito ou cliente já encerrado
  }
}

export default pb
export { pb }
