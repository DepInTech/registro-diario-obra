import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Derruba a conexão realtime do SDK (SSE) à força, para encerrar assinaturas
 * antigas no logout/troca de sessão. O método é interno ao SDK, por isso o
 * acesso é feito por cast tipado e tolerante a ausência.
 */
export const forceRealtimeTeardown = async (): Promise<void> => {
  const realtime = pb.realtime as unknown as {
    disconnect?: (subscriptionsCount?: number) => void | Promise<void>
  }
  if (typeof realtime?.disconnect === 'function') {
    await realtime.disconnect()
  }
}

export { pb }
export default pb
