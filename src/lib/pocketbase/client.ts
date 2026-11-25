import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Encerra todas as subscriptions realtime ativas (SSE) do SDK.
// Usado por AuthContext e SyncContext no logout e na troca de usuário,
// para que nenhuma subscription do usuário anterior sobreviva.
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtime = (
      pb as unknown as {
        realtime?: {
          subscriptions: Map<string, unknown>
          unsubAll: () => Promise<void> | void
          disconnectAll?: () => void
        }
      }
    ).realtime
    if (!realtime) return
    try {
      await realtime.unsubAll()
    } catch {
      // ignora — já desconectado ou SDK sem unsubAll
    }
    realtime.subscriptions?.clear?.()
    realtime.disconnectAll?.()
  } catch {
    // nunca propaga: teardown é best-effort
  }
}

export { pb }
export default pb
