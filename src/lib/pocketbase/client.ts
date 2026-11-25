import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

export async function forceRealtimeTeardown(): Promise<void> {
  try {
    ;(pb as unknown as { disconnect?: () => void }).disconnect?.()
  } catch {
    // best-effort: nunca lançar erro
  }
}
