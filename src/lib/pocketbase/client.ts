import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra toda inscrição realtime ativa deste cliente. Usado por
 * AuthContext/SyncContext ao desmontar/trocar sessão para que listeners
 * remanescentes de uma sessão anterior nunca sobrevivam ao logout.
 * Somente pb.realtime.unsubscribe() existe no SDK — pb.realtime.destroy()
 * NÃO existe e derruba o build se chamado.
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // Cliente já encerrado ou sem conexão ativa: nada a fazer.
  }
}

export { pb }
export default pb
