import pb from '@/lib/pocketbase/client'
import type { EpaUser } from '@/types/epa'

export const currentUser = () => pb.authStore.record as EpaUser | null
export const isAuthenticated = () => pb.authStore.isValid
export const login = async (email: string, password: string) => {
  const result = await pb.collection('users').authWithPassword<EpaUser>(email, password)
  return result.record
}
export const logout = () => pb.authStore.clear()
export const refreshAuth = async () => {
  if (!pb.authStore.isValid) return null
  try {
    return (await pb.collection('users').authRefresh<EpaUser>()).record
  } catch {
    pb.authStore.clear()
    return null
  }
}
