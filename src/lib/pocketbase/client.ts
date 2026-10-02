import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export function forceRealtimeTeardown(): void {
  try {
    pb.realtime.unsubscribe()
  } catch (_) {
    /* intentionally ignored */
  }
}

export default pb
