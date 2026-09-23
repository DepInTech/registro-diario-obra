import pb from '@/lib/pocketbase/client'
import type { EpaUser } from '@/types/epa'

export const currentUser = () => pb.authStore.record as EpaUser | null
export const isAuthenticated = () => pb.authStore.isValid

/**
 * Computes SHA-256 hash with email as salt
 */
export async function hashPasswordWithSalt(password: string, email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase()
  const salted = `${normalizedEmail}:${password}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(salted)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  // Fallback if crypto.subtle is somehow unavailable
  let hash = 0
  for (let i = 0; i < salted.length; i++) {
    const char = salted.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

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
    // In offline mode, do not clear auth store automatically on fetch failure
    if (navigator.onLine) {
      pb.authStore.clear()
    }
    return null
  }
}
