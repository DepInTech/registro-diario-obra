import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Derruba todas as conexões realtime ativas do SDK (usado no logout/troca de usuário).
export const forceRealtimeTeardown = async (): Promise<void> => {
  try {
    await pb.realtime.unsubscribe()
  } catch {
    // pode falhar se não houver inscrições — ignorar
  }
  const realtime = pb.realtime as unknown as {
    socket?: { close?: () => void } | null
  }
  if (realtime?.socket) {
    try {
      realtime.socket.close?.()
      realtime.socket = null
    } catch {
      // socket já fechado — ignorar
    }
  }
}

export { pb }
export default pb
