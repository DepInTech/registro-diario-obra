import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown universal e forçado de todas as conexões Realtime SSE ativas no PocketBase.
 * Usado pelo AuthContext (no logout/login) e pelo SyncContext para evitar conexões zumbis
 * e garantir reconexão limpa com os novos tokens.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch (err) {
    console.warn('[PocketBase] Erro ao desinscrever realtime durante teardown:', err)
  }
}

export default pb
