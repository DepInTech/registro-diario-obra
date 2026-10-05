import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export const forceRealtimeTeardown = async () => {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    /* intentionally ignored */
  }
}

export { pb }
export default pb
