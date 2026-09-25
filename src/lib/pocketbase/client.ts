import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado e limpo do SSE Realtime do PocketBase.
 * Desinscreve todas as coleções ativas e desconecta a conexão SSE
 * para evitar conflitos de token/clientId e erro 403 entre sessões.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // 1. Tenta desinscrever todas as subscrições ativas via método padrão
    if (typeof pb.realtime?.unsubscribe === 'function') {
      try {
        await pb.realtime.unsubscribe()
      } catch {
        /* ignora falha pontual de unsubscribe */
      }
    }

    // 2. Tenta desconectar a conexão EventSource/SSE se o SDK suportar disconnect
    const realtimeAny = pb.realtime as any
    if (typeof realtimeAny?.disconnect === 'function') {
      try {
        realtimeAny.disconnect()
      } catch {
        /* ignora falha pontual de disconnect */
      }
    }

    // 3. Limpa clientId associado para forçar novo handshake limpo na próxima subscrição
    if (realtimeAny && 'clientId' in realtimeAny) {
      realtimeAny.clientId = ''
    }
  } catch (err) {
    console.warn('[Realtime] Aviso durante forceRealtimeTeardown:', err)
  }
}

export { pb }
export default pb
