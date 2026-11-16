import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra à força qualquer canal realtime aberto (SSE) do PocketBase.
 * Necessária antes/depois de login, logout e troca de credenciais para evitar
 * reenvio do clientId antigo com novas credenciais.
 */
export function forceRealtimeTeardown(): Promise<void> {
  try {
    return pb.realtime.unsubscribe()
  } catch {
    // Se não houver canal aberto, não há nada a fazer.
    return Promise.resolve()
  }
}

export default pb
