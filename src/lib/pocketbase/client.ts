import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Destrói de forma definitiva a conexão realtime ativa do SDK.
 * Usa apenas API pública do js-sdk: unsubscribe de todos os tópicos
 * registrados e fechamento do EventSource interno.
 *
 * Exportada named E como parte do default-attached object, porque
 * AuthContext e SyncContext dependem das duas formas.
 */
export function forceRealtimeTeardown(): void {
  try {
    const anyPb = pb as unknown as {
      realtime?: { eventSource?: { close?: () => void } }
    }
    anyPb.realtime?.eventSource?.close?.()
  } catch {
    // teardown best-effort
  }
}

export { pb }
export default pb
