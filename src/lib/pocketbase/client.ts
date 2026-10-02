import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado do serviço SSE / Realtime do PocketBase.
 * Desconecta EventSource/SSE e reseta clientId para evitar erros 403 e concorrência
 * de conexões antigas entre reconexões ou trocas de usuário/dispositivo.
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
      // Reseta eventSource e clientId internos se presentes
      if (realtimeService.eventSource) {
        try {
          realtimeService.eventSource.close()
        } catch {
          // ignore
        }
        realtimeService.eventSource = null
      }
      if ('clientId' in realtimeService) {
        realtimeService.clientId = ''
      }
    }
  } catch {
    // Teardown silencioso e seguro
  }
}

export default pb
