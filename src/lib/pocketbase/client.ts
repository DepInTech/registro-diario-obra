import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown helper for realtime connections when logging out or changing context
 */
export function forceRealtimeTeardown(): void {
  try {
    pb.realtime?.unsubscribe()
  } catch (err) {
    console.warn('[PB Client] Realtime teardown warning:', err)
  }
}

export { pb }
export default pb
