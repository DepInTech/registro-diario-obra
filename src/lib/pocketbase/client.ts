import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Teardown helper for realtime subscriptions to ensure clean state
 * during auth switches, reconnects or page unmounts.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch (err) {
    console.warn('Realtime teardown warning:', err)
  }
}

export { pb }
export default pb
