import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

// Encerra TODAS as assinaturas realtime ativas deste cliente PocketBase.
// Usado por AuthContext/SyncContext no logout e na troca de conta para que
// assinaturas da sessão anterior não vazar para a nova.
export function forceRealtimeTeardown() {
  try {
    pb.beforeSend = undefined
    // @ts-expect-error acesso interno do SDK para derrubar a conexão SSE ativa
    if (pb.realtime?.eventSource) {
      // @ts-expect-error acesso interno do SDK para derrubar a conexão SSE ativa
      pb.realtime.eventSource.close()
      // @ts-expect-error acesso interno do SDK para derrubar a conexão SSE ativa
      pb.realtime.eventSource = null
      // @ts-expect-error acesso interno do SDK para derrubar a conexão SSE ativa
      pb.realtime.subscriptions = {}
    }
  } catch (e) {
    console.warn('forceRealtimeTeardown: falha ao encerrar realtime:', e)
  }
}
