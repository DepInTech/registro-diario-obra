import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Derruba forçadamente o canal SSE de realtime atual.
 * Usado por AuthContext e SyncContext em login/logout/renovação de sessão
 * para evitar envio de clientId antigo com novas credenciais.
 */
export function forceRealtimeTeardown() {
  try {
    pb.realtime?.unsubscribe?.()
  } catch {
    // silencioso: teardown é best-effort
  }
}

export default pb
