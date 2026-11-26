import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb

export function forceRealtimeTeardown() {
  try {
    void pb.realtime.unsubscribe()
  } catch {
    // realtime teardown is best-effort
  }
}
