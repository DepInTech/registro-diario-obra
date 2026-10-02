import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Desconecta e limpa subscrições ativas do Realtime SSE do PocketBase.
 * Utilizado para evitar concorrência e erro 403 no handshake durante troca de usuário/reconexão.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    if ((pb as any).realtime && typeof (pb as any).realtime.unsubscribe === 'function') {
      await (pb as any).realtime.unsubscribe()
    }
  } catch (err) {
    console.warn('[Realtime] Erro ao executar teardown forçado:', err)
  }
}

export { pb }
export default pb
