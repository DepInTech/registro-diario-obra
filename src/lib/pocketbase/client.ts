import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado da conexão realtime (SSE / EventSource) do PocketBase.
 *
 * Utilizado para evitar conflitos de múltiplos canais SSE ou envio de clientId
 * desatualizado após login, logout, alternância de usuário ou perda/retomada de rede,
 * eliminando erros 403 ("The current and the previous request authorization don't match").
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtimeService = (pb as any).realtime
    if (realtimeService) {
      if (typeof realtimeService.unsubscribe === 'function') {
        try {
          await realtimeService.unsubscribe()
        } catch {
          // ignora falhas transitórias durante unsubscribe
        }
      }
      if (typeof realtimeService.disconnect === 'function') {
        try {
          realtimeService.disconnect()
        } catch {
          // ignora falhas transitórias durante disconnect
        }
      }
      // Limpa explicitamente o clientId para forçar novo handshake com credenciais atuais
      if ('clientId' in realtimeService) {
        realtimeService.clientId = ''
      }
    }
  } catch (err) {
    console.warn('[PocketBase] Falha suave no forceRealtimeTeardown:', err)
  }
}

export { pb }
export default pb
