import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra forçadamente a conexão realtime (SSE) ativa.
 * Usada por AuthContext e SyncContext antes de logout / re-subscrição,
 * para garantir um novo handshake limpo sem conexões órfãs.
 * NÃO altera fila de sincronização, sessão nem reenvio — apenas derruba o SSE.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtime = pb.realtime as unknown as { disconnect?: () => void } | undefined
    realtime?.disconnect?.()
  } catch {
    // ignore — teardown best-effort
  }
}

export { pb }
export default pb
