import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    /* intentionally ignored */
  }
}

export { pb }
export default pb
