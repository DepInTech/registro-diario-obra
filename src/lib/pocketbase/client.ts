import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra todos os subscriptions realtime ativos do PocketBase.
 * Chamado no logout e em ciclos de sincronização para evitar listeners órfãos
 * que reaparecem após troca de usuário (múltiplos updates duplicados).
 */
export const forceRealtimeTeardown = async (): Promise<void> => {
  try {
    pb.realtime?.unsubscribe()
  } catch {
    // ignora erros de teardown — o socket pode já estar fechado
  }
  try {
    // client realtime expõe client_id: fechar força nova conexão/ID limpo
    const anyRt = pb.realtime as unknown as
      | { clientId?: string; socket?: { close?: () => void } }
      | undefined
    if (anyRt?.socket?.close) anyRt.socket.close()
    if (anyRt && 'clientId' in anyRt) anyRt.clientId = undefined
  } catch {
    // ignora — teardown é best-effort
  }
}

export { pb }
export default pb
