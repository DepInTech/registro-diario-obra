import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/** Encerra a assinatura de realtime desta instância de forma segura.
 *  Mantida por compatibilidade (AuthContext/SyncContext importam o export nomeado). */
export function forceRealtimeTeardown(): void {
  const disconnect = (pb as unknown as { disconnect?: () => void }).disconnect
  if (typeof disconnect === 'function') {
    disconnect.call(pb)
  }
}

export { pb }
export default pb
