import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

export function forceRealtimeTeardown() {
  try {
    pb.beforeSend = undefined
    pb.afterSend = undefined
  } catch {
    // noop
  }
  try {
    ;(pb.realtime as unknown as { eventSource?: EventSource })?.eventSource?.close?.()
  } catch {
    // noop
  }
  try {
    // Encerra a assinatura ativa (realtime do PocketBase mantém 1 conexão por cliente)
    void pb.collection('_superusers').unsubscribe()
  } catch {
    // noop
  }
}
