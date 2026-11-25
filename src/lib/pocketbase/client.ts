import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra a assinatura realtime de todos os canais ativos.
 * IMPORTAÇÃO: AuthContext e SyncContext importam o NOME `forceRealtimeTeardown`
 * aqui e o default `pb` — os dois exports devem existir SEMPRE neste arquivo.
 * (pb.realtime.destroy() NÃO existe no tipo RealtimeService do SDK pocketbase
 * 0.26 — usar apenas pb.realtime.unsubscribe(), que sem argumento encerra todos.)
 */
export function forceRealtimeTeardown(): void {
  pb.realtime.unsubscribe()
}

export default pb
