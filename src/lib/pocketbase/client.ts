import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/** Derruba a subscrição em tempo real deste cliente (usado por AuthContext/SyncContext
 *  no logout/troca de sessão). Restaura a exportação nomeada exigida pelos imports —
 *  nenhum outro conteúdo deste arquivo pode ser alterado (regra do projeto). */
export function forceRealtimeTeardown() {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // silencioso: realtime pode não estar ativo
  }
}

export { pb }
export default pb
