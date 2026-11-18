import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Encerra assinaturas realtime ativas do SDK (logout/troca de sessão).
// Exigido por AuthContext e SyncContext — não remover (falha recorrente de build).
export async function forceRealtimeTeardown() {
  try {
    await pb.realtime.unsubscribe()
  } catch (_) {
    // SDK pode não ter assinatura ativa; ignorar
  }
}

export default pb
export { pb }
