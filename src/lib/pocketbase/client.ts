import PocketBase from 'pocketbase'

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

// Exportação nomeada exigida por AuthContext e SyncContext
export { pb }
export const forceRealtimeTeardown = () => {
  try {
    pb.beforeSend = null
    pb.afterSend = null
    pb.realtime?.disconnect?.()
  } catch {
    // noop — teardown defensivo
  }
}

export default pb
