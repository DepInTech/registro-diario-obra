import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

/**
 * Derruba completamente o estado de realtime do SDK PocketBase.
 * Usa apenas APIs públicas do js-sdk (unsubscribe / removeAllListeners de EventTarget).
 */
export function forceRealtimeTeardown() {
  try {
    pb.realtime.unsubscribe()
  } catch (_) {
    /* noop */
  }
  try {
    ;(pb.realtime as unknown as { removeAllListeners?: () => void }).removeAllListeners?.()
  } catch (_) {
    /* noop */
  }
}
