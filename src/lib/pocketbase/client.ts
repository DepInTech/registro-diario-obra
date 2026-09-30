import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export function forceRealtimeTeardown(): void {
  try {
    pb.realtime?.unsubscribe()
  } catch (err) {
    console.warn('forceRealtimeTeardown:', err)
  }
}

export { pb }
export default pb
