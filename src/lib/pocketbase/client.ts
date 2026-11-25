import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

/** Teardown manual do Realtime sem destruir o serviço (não existe no SDK 0.26). */
export const forceRealtimeTeardown = async () => {
  try {
    await pb.realtime.unsubscribe()
  } catch (_) {
    // silencioso: unsubscribe já pode ter sido efetuado
  }
}

export { pb }
export default pb
