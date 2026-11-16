import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra à força o canal SSE de tempo real: remove todas as subscrições e
 * invalida o clientId atual, forçando um handshake novo (novo clientId) na
 * próxima subscrição. Usado no login/logout/troca de usuário para nunca enviar
 * um clientId antigo com credenciais novas.
 */
export async function forceRealtimeTeardown() {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    // ignore — canal pode nem existir ainda
  }
  try {
    ;(pb as unknown as { realtime: { clientId: string | null } }).realtime.clientId = null
  } catch {
    // ignore
  }
}

export { pb }
export default pb
