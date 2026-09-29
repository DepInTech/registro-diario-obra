import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado de conexões em tempo real (SSE/subscrições do PocketBase).
 * Utilizado pelo AuthContext e SyncContext para evitar handshake 403 e concorrência de SSE
 * ao deslogar, logar novamente ou alternar credenciais.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtime = (pb as any).realtime
    if (realtime) {
      if (typeof realtime.unsubscribe === 'function') {
        await realtime.unsubscribe().catch(() => {})
      }
      if (typeof realtime.disconnect === 'function') {
        realtime.disconnect()
      }
      // Limpa clientId SSE caso exista internamente
      if ('clientId' in realtime) {
        realtime.clientId = ''
      }
    }
  } catch (err) {
    console.warn('[Realtime] Erro durante teardown forçado de SSE:', err)
  }
}

export default pb
