import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra a subscrição realtime atual (pb.realtime.unsubscribe).
 * Exportação OBRIGATÓRIA: AuthContext e SyncContext importam { forceRealtimeTeardown }.
 * Removê-la quebra tsc e build (erro recorrente já resolvido 4x — v0.0.232/234/237/239).
 */
export function forceRealtimeTeardown() {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // sem subscrição ativa — nada a fazer
  }
}

export { pb }
export default pb
