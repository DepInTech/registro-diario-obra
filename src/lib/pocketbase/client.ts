import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra de forma limpa e forçada qualquer conexão SSE/realtime ativa no PocketBase SDK.
 * Evita conflito 403 ("The current and the previous request authorization don't match")
 * após login, logout ou troca de credencial/token.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtime = (pb as any).realtime
    if (realtime) {
      if (typeof realtime.unsubscribe === 'function') {
        try {
          await realtime.unsubscribe()
        } catch {
          // ignore
        }
      }
      if (typeof realtime.disconnect === 'function') {
        try {
          realtime.disconnect()
        } catch {
          // ignore
        }
      }
      // Limpa clientId cacheado se existir no serviço interno
      if (realtime.clientId !== undefined) {
        realtime.clientId = ''
      }
      if (realtime.subscriptions) {
        realtime.subscriptions = {}
      }
    }
  } catch (err) {
    console.warn('[PocketBase] Erro no forceRealtimeTeardown:', err)
  }
}

export default pb
