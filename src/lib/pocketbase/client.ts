import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Sessão atual — exportada como default E nomeada (o projeto importa nos dois formatos)
export default pb
export { pb }

// Encerra listeners de realtime sem descartar a sessão (usado pelo SyncContext
// no teardown — logout/reset não pode deixar subscriptions penduradas)
export function forceRealtimeTeardown() {
  try {
    ;(pb.realtime as any).setEventListener(null)
  } catch {
    /* noop */
  }
}
