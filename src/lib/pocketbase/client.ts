import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Desmonta forçadamente todas as assinaturas realtime ativas do PocketBase.
 * Usado pelo SyncContext ao encerrar sessão/renovar token — sem isso, assinaturas
 * órfãs da conta anterior continuam recebendo eventos.
 */
export function forceRealtimeTeardown() {
  try {
    void pb.realtime.unsubscribeByPrefix?.('')
  } catch {
    // best effort — nenhum teardown deve derrubar a sessão
  }
}

export default pb
export { pb }
