import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export { pb }

export async function forceRealtimeTeardown(): Promise<void> {
  try {
    if (pb?.realtime) {
      await pb.realtime.unsubscribe()
    }
  } catch (err) {
    console.warn('[pocketbase] forceRealtimeTeardown warning:', err)
  }
}

export default pb
