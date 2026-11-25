import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

export function forceRealtimeTeardown() {
  const client = pb as unknown as { disconnect?: () => void }
  try {
    client.disconnect?.()
  } catch {
    // teardown silencioso: o cliente pode já estar desconectado
  }
}
