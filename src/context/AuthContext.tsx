import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { EpaUser } from '@/types/epa'
import { offlineStorage } from '@/services/offlineStorage'

interface AuthContextType {
  user: EpaUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identity: string, password: string) => Promise<void>
  logout: () => void
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (val: boolean) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
})

const OFFLINE_AUTH_KEY = 'epa_offline_session_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EpaUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)

  useEffect(() => {
    // Check initial auth state
    const initAuth = async () => {
      try {
        if (pb.authStore.isValid && pb.authStore.record) {
          const pbUser = pb.authStore.record as unknown as EpaUser
          setUser(pbUser)
          setIsAuthenticated(true)
          // Cache user for offline access
          await offlineStorage.setCache(OFFLINE_AUTH_KEY, pbUser)
        } else {
          // Check if offline cached session exists
          const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
          if (cached) {
            setUser(cached)
            setIsAuthenticated(true)
          } else {
            setUser(null)
            setIsAuthenticated(false)
          }
        }
      } catch (err) {
        console.error('Auth check error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    const unsubscribe = pb.authStore.onChange(async () => {
      if (pb.authStore.isValid && pb.authStore.record) {
        const currentUser = pb.authStore.record as unknown as EpaUser
        setUser(currentUser)
        setIsAuthenticated(true)
        await offlineStorage.setCache(OFFLINE_AUTH_KEY, currentUser)
      } else {
        const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
        if (!cached) {
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (identity: string, password: string) => {
    if (!navigator.onLine) {
      // Offline login attempt: only allowed if previously authenticated user matches
      const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
      if (
        cached &&
        (cached.email.toLowerCase() === identity.toLowerCase() ||
          cached.name.toLowerCase() === identity.toLowerCase())
      ) {
        setUser(cached)
        setIsAuthenticated(true)
        return
      }
      throw new Error(
        'Primeiro acesso exige conexão com a internet. Não é possível entrar offline sem sessão autorizada.',
      )
    }

    try {
      const res = await pb.collection('users').authWithPassword(identity, password)
      const loggedUser = res.record as unknown as EpaUser
      if (!loggedUser.active) {
        pb.authStore.clear()
        throw new Error('Usuário desativado. Entre em contato com o administrador.')
      }
      setUser(loggedUser)
      setIsAuthenticated(true)
      await offlineStorage.setCache(OFFLINE_AUTH_KEY, loggedUser)
    } catch (err: unknown) {
      if (err instanceof Error) throw err
      throw new Error('Usuário ou senha incorretos.')
    }
  }

  const logout = async () => {
    pb.authStore.clear()
    await offlineStorage.setCache(OFFLINE_AUTH_KEY, null)
    setUser(null)
    setIsAuthenticated(false)
    setHasUnsavedChanges(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        hasUnsavedChanges,
        setHasUnsavedChanges,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
