import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// teardown do realtime — usa apenas pb.realtime.unsubscribe() (pb.realtime.destroy()
// não existe no SDK pocketbase 0.26 e quebra o tsc). Necessário para o logout
// de tabelas no tablet e exigido por AuthContext e SyncContext.
export function forceRealtimeTeardown() {
  try {
    pb.realtime.unsubscribe()
  } catch (_) {
    // realtime pode não estar ativo — nada a fazer
  }
}

export { pb }
export default pb
