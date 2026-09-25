import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export async function forceRealtimeTeardown(): Promise<void> {
  try {
    const realtimeService = (pb as any).realtime
    if (realtimeService && typeof realtimeService.unsubscribe === 'function') {
      await realtimeService.unsubscribe()
    }
  } catch {
    // ignore
  }
}

export { pb }
export default pb
