import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado e limpo da conexão realtime do PocketBase.
 * Cancela todas as subscrições ativas, fecha o EventSource interno do pb.realtime,
 * desconecta e reseta o clientId para evitar o erro 403 "The current and the previous
 * request authorization don't match" em trocas de usuário ou reconexões.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // 1. Unsubscribe de todas as coleções conhecidas no client
    if (typeof (pb as any).realtime?.unsubscribe === 'function') {
      try {
        await (pb as any).realtime.unsubscribe()
      } catch {
        // ignore
      }
    }

    // 2. Fechamento explícito do EventSource interno se existir
    const realtime = (pb as any).realtime
    if (realtime) {
      if (realtime.eventSource) {
        try {
          if (typeof realtime.eventSource.close === 'function') {
            realtime.eventSource.close()
          }
        } catch {
          // ignore
        }
        try {
          realtime.eventSource = null
        } catch {
          // ignore
        }
      }

      // 3. Reset do clientId interno do realtime service
      if ('clientId' in realtime) {
        try {
          realtime.clientId = ''
        } catch {
          // ignore
        }
      }

      // 4. Se houver método disconnect ou close no próprio realtime service
      if (typeof realtime.disconnect === 'function') {
        try {
          realtime.disconnect()
        } catch {
          // ignore
        }
      }
    }
  } catch (err) {
    console.warn('[Realtime] Erro durante forceRealtimeTeardown:', err)
  }
}

export default pb
