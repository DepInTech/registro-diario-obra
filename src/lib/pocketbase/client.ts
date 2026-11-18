import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Força o teardown de todas as subscriptions realtime do PocketBase.
 * Fecha o canal SSE aberto e limpa o clientId em memória, garantindo
 * que uma nova sessão/subscrição reabra o canal com estado limpo
 * (evita envio de clientId antigo com novas credenciais).
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // Acessa o serviço interno de realtime do SDK via cast para qualquer,
    // pois seus métodos são privados na tipagem pública.
    const realtime = (pb as any).realtime as
      | {
          unsubscribeByPrefix?: (prefix: string) => Promise<void>
          disconnect?: () => void
          clientId?: string
        }
      | undefined
    if (!realtime) return
    if (typeof realtime.unsubscribeByPrefix === 'function') {
      await realtime.unsubscribeByPrefix('')
    }
    if (typeof realtime.disconnect === 'function') {
      realtime.disconnect()
    }
    if (realtime.clientId) {
      realtime.clientId = ''
    }
  } catch {
    // Teardown é best-effort: nunca deve derrubar o fluxo chamador
  }
}

export { pb }
export default pb
