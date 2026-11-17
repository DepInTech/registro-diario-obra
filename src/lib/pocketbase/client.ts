import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra todas as conexões realtime ativas (SSE) do cliente PocketBase.
 * Usado por AuthContext (logout/troca de sessão) e SyncContext (teardown de subscriptions)
 * para garantir que nenhum listener fique pendurado após a troca de usuário.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // Encerra a conexão SSE subjacente e remove todos os listeners de subscriptions.
    await pb.realtime.unsubscribe()
  } catch {
    // Nada a fazer: teardown é best-effort (pode já estar desconectado).
  }
}

export { pb }
export default pb
