import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Derruba o canal de realtime (SSE) da instância atual do cliente.
 *
 * Obrigatório para AuthContext/SyncContext (import nomeado): garante que um
 * clientId antigo não seja reenviado com credenciais novas ao religar o canal
 * após login/logout/troca de usuário.
 *
 * NOTA DE PLATAFORMA: pb.realtime.destroy() NÃO existe nesta versão do SDK —
 * somente unsubscribe(). A limpeza é feita removendo TODOS os listeners de
 * realtime registrados, sem recriar o cliente (o cliente é singleton do app).
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    /* canal já inexistente: teardown idempotente */
  }
}

export { pb }
export default pb
