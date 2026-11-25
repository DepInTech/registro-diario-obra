import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }

/**
 * Encerra as subscriptions realtime do PocketBase (best-effort).
 * O método pode ser privado no tipo do SDK — por isso o cast seguro.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    ;(pb as unknown as { disconnect?: () => void }).disconnect?.()
  } catch {
    // best-effort: nunca lançar erro
  }
}
