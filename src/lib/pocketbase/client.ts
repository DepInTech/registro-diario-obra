import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export { pb }
export async function forceRealtimeTeardown() {
  try {
    pb.beforeSend = undefined
  } catch {
    // noop
  }
  try {
    await pb
      .collection('_superusers')
      .authRefresh()
      .catch(() => undefined)
  } catch {
    // noop — best effort teardown, nunca interrompe logout/switch
  }
  try {
    pb.realtime?.unsubscribe?.()
  } catch {
    // noop
  }
}

export default pb
