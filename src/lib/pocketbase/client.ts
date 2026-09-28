import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export const forceRealtimeTeardown = async (): Promise<void> => {
  try {
    if (pb && pb.realtime) {
      await pb.realtime.unsubscribe()
    }
  } catch (err) {
    console.warn('[forceRealtimeTeardown] Error unsubscribing realtime:', err)
  }
}

export { pb }
export default pb
