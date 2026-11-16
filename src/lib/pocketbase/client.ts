import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown forçado do canal realtime (SSE): derruba a conexão atual e limpa o
 * clientId antigo para evitar 403 "authorization don't match" ao relogar.
 * Exigido por AuthContext e SyncContext como export nomeado.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const rt = (pb as any).realtime
    if (rt && typeof rt.unsubscribe === 'function') {
      await rt.unsubscribe()
    }
  } catch {
    // ignore — teardown é best-effort
  }
}

export default pb
export { pb }
