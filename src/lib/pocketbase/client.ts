import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra todas as assinaturas de realtime ativas.
 * IMPORTANTE: usar apenas pb.realtime.unsubscribe() — pb.realtime.destroy()
 * não existe no tipo RealtimeService e quebra o tsc.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    pb.realtime.unsubscribe()
  } catch {
    // ignore: teardown é best-effort durante logout/reset
  }
}

export { pb }
export default pb
