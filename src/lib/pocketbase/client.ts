import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Teardown agressivo do canal realtime (exigido por AuthContext e SyncContext).
// Usa a API pública do SDK: unsubscribe() sem argumentos remove TODAS as
// subscrições e o próprio SDK fecha a conexão SSE quando não resta nenhuma.
// Garante que nenhum clientId antigo seja reutilizado em nova conexão
// (evita o erro 403 "authorization don't match" no handshake SSE).
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    // noop — teardown é sempre best-effort
  }
}

export { pb }
export default pb
