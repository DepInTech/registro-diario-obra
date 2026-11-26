import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Necessário por AuthContext e SyncContext: derruba todas as subscriptions
// realtime antes de trocar de usuário (logout/troca de conta). Não remover.
export async function forceRealtimeTeardown(): Promise<void> {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    // teardown best-effort: falha aqui não pode bloquear logout
  }
}

export default pb
