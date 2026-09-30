import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export const forceRealtimeTeardown = () => {
  try {
    pb.realtime.unsubscribe()
  } catch (err) {
    console.warn('Realtime teardown warning:', err)
  }
}

export default pb
