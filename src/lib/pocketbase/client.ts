import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb

/**
 * Teardown defensivo do realtime antes do logout / troca de ficha.
 * O SDK PocketBase não expõe `disconnect` no tipo público do cliente,
 * então fazemos cast local para um tipo estrutural com `disconnect?`.
 */
export const forceRealtimeTeardown = async (): Promise<void> => {
  try {
    type Disconnectable = { disconnect?: () => void }
    await (pb as unknown as Disconnectable).disconnect?.()
  } catch {
    // best-effort: nunca propagar erro de teardown
  }
}
