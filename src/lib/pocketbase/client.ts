import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Executa teardown forçado do canal único SSE/Realtime do PocketBase.
 * Usado em fluxos de login, logout e troca de credenciais para prevenir
 * o erro 403 ("The current and the previous request authorization don't match")
 * e garantir reconexão limpa sem instanciar conexões paralelas.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // 1. Desinscreve todas as subscrições ativas no SDK
    if (pb.realtime && typeof pb.realtime.unsubscribe === 'function') {
      await pb.realtime.unsubscribe()
    }
  } catch (err) {
    console.debug('[RealtimeTeardown] Erro ao desinscrever:', err)
  }

  try {
    // 2. Fecha conexão SSE subjacente e cancela requests pendentes de realtime se disponíveis
    const rt = pb.realtime as any
    if (rt) {
      if (typeof rt.disconnect === 'function') {
        rt.disconnect()
      } else if (rt.eventSource && typeof rt.eventSource.close === 'function') {
        rt.eventSource.close()
        rt.eventSource = null
        rt.clientId = ''
      }
    }
  } catch (err) {
    console.debug('[RealtimeTeardown] Erro ao fechar EventSource:', err)
  }
}

export default pb
