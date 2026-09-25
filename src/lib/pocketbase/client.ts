import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado do canal de tempo real (EventSource / SSE) do PocketBase.
 * Centralizado e seguro para alternância de usuários ou limpeza de conexão,
 * prevenindo o erro 403 "The current and the previous request authorization don't match".
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtimeService = (pb as any).realtime
    if (realtimeService) {
      if (typeof realtimeService.unsubscribe === 'function') {
        try {
          await realtimeService.unsubscribe()
        } catch {
          // ignore
        }
      }
      if (typeof realtimeService.disconnect === 'function') {
        try {
          realtimeService.disconnect()
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // Teardown defensivo nunca deve lançar exceção
  }
}

export default pb
