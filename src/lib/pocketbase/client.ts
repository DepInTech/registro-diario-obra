import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Derruba todas as inscrições realtime abertas. Usado por AuthContext e SyncContext
 * no logout/troca de sessão. Usa somente pb.realtime.unsubscribe() (pb.realtime.destroy()
 * não existe no SDK pocketbase 0.26 e quebra o tsc).
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // ignore: conexão realtime já encerrada
  }
}

export { pb }
export default pb
