import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

export default pb
export { pb }
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    // Encerra toda a inscrição realtime do SDK (exigido por AuthContext e SyncContext
    // antes de logout/login — sem isto, inscrições antigas ficam órfãs no servidor).
    await pb.realtime.unsubscribe()
  } catch {
    // já desconectado — nada a fazer
  }
}
