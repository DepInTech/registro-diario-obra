import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export { pb }

export async function forceRealtimeTeardown(): Promise<void> {
  try {
    if (pb?.realtime) {
      await pb.realtime.unsubscribe()
    }
  } catch {
    // Silently ignore teardown errors on unmounted / aborted sockets
  }
}

export default pb
