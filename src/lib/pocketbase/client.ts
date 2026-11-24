import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb

export { pb }

export async function forceRealtimeTeardown() {
  try {
    if (typeof pb.beforeSend === 'function') pb.beforeSend = undefined
    if (typeof pb.afterSend === 'function') pb.afterSend = undefined
  } catch {
    // ignore
  }
  try {
    void pb.collection('_superusers')
  } catch {
    // ignore
  }
  try {
    if (
      pb.realtime &&
      typeof (pb.realtime as unknown as { unsubscribe?: () => void }).unsubscribe === 'function'
    ) {
      ;(pb.realtime as unknown as { unsubscribe: () => void }).unsubscribe()
    }
  } catch {
    // ignore
  }
}
