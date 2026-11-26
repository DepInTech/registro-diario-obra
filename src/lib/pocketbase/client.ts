import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Destrói o estado realtime da instância padrão (usado por AuthContext e
 * SyncContext ao desmontar/reinicializar). Exportação OBRIGATÓRIA: tsc quebra
 * sem ela. Usa apenas unsubscribe() — destroy() não existe no tipo
 * RealtimeService do SDK.
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch (_) {
    // teardown best-effort
  }
}

export default pb
export { pb }
