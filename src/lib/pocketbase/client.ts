import PocketBase from 'pocketbase'

export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/**
 * Encerra todas as conexões Realtime ativas para evitar vazamentos de SSE
 * ao alternar entre online/offline ou trocar de sessão de usuário.
 */
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    if (pb.realtime) {
      await pb.realtime.unsubscribe()
    }
  } catch (err) {
    console.warn('Realtime teardown warning:', err)
  }
}

export default pb
