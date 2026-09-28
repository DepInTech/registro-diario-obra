import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra de forma limpa e forçada qualquer canal EventSource/SSE aberto pelo PocketBase.
 * Essencial em trocas de autenticação (login/logout/refresh) para evitar o erro 403
 * "The current and the previous request authorization don't match" causado por clientId reutilizado.
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
      // Limpa clientId SSE interno para forçar novo handshake limpo com o token atual
      if ('clientId' in realtimeService) {
        realtimeService.clientId = ''
      }
    }
  } catch (err) {
    console.warn('[forceRealtimeTeardown] Falha não crítica no teardown de realtime:', err)
  }
}

export { pb }
export default pb
