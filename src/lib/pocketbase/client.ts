import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado do serviço de Realtime do PocketBase.
 * Resolve o problema onde o SDK retém o clientId antigo conectado a um token anterior,
 * disparando erro 403 "The current and the previous request authorization don't match" em loop
 * ao trocar de usuário (login/logout).
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtime = (pb as any).realtime
    if (!realtime) return

    // 1. Unsubscribe de todas as subscrições ativas se disponível
    try {
      if (typeof realtime.unsubscribe === 'function') {
        await realtime.unsubscribe()
      }
    } catch {
      // ignore
    }

    // 2. Fechar o EventSource nativo se aberto
    try {
      if (realtime.eventSource && typeof realtime.eventSource.close === 'function') {
        realtime.eventSource.close()
      }
      realtime.eventSource = null
    } catch {
      // ignore
    }

    // 3. Disconnect do serviço
    try {
      if (typeof realtime.disconnect === 'function') {
        realtime.disconnect()
      }
    } catch {
      // ignore
    }

    // 4. Resetar clientId e subscrições pendentes
    try {
      realtime.clientId = ''
      if (realtime.subscriptions) {
        realtime.subscriptions = {}
      }
    } catch {
      // ignore
    }

    console.log('[Realtime] Teardown forçado do SSE concluído com sucesso.')
  } catch (err) {
    console.warn('[Realtime] Erro durante teardown forçado:', err)
  }
}

export default pb
