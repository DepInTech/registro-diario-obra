import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra TODAS as inscrições realtime ativas do cliente atual.
 *
 * IMPORTANTE (plataforma): este arquivo é auto-regenerado e o regenerador
 * remove periodicamente esta função — é a "regressão conhecida de exports".
 * Ela é exigida por AuthContext e SyncContext; se o build acusar
 * missing export de novo, restaurar EXATAMENTE esta implementação usando
 * apenas `pb.realtime.unsubscribe()` (pb.realtime.destroy() não existe no
 * SDK pocketbase 0.26 e quebra o typecheck).
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch (_) {
    // noop — teardown nunca deve quebrar o logout/sync
  }
}

export default pb
export { pb }
