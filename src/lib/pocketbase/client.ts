import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/** Encerra assinaturas realtime (usado em logout/troca de usuário).
 * NOTA: apenas unsubscribe() — pb.realtime.destroy() não existe no SDK
 * pocketbase 0.26 e quebra o tsc. */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch (_) {
    // teardown best-effort: nunca bloquear logout/sync por falha aqui
  }
}

export default pb
