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
          // Verify user is active
          if (pbUser && pbUser.active !== false) {
            setUser(pbUser)
            setIsAuthenticated(true)
            // Cache user for offline access
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, pbUser)
          } else {
            pb.authStore.clear()
            setUser(null)
            setIsAuthenticated(false)
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, null)
          }
        } else {
          // Check if offline cached session exists
          const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
          if (cached && cached.active !== false) {
            setUser(cached)
            setIsAuthenticated(true)
          } else {
            setUser(null)
            setIsAuthenticated(false)
          }
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setUser(null)
        setIsAuthenticated(false)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    const unsubscribe = pb.authStore.onChange(async () => {
      try {
        if (pb.authStore.isValid && pb.authStore.record) {
          const currentUser = pb.authStore.record as unknown as EpaUser
          if (currentUser && currentUser.active !== false) {
            setUser(currentUser)
            setIsAuthenticated(true)
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, currentUser)
          } else {
            setUser(null)
            setIsAuthenticated(false)
          }
        } else {
          // If pb.authStore was explicitly cleared or invalid, only keep offline session if truly offline
          if (!navigator.onLine) {
            const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
            if (cached && cached.active !== false) {
              setUser(cached)
              setIsAuthenticated(true)
              return
            }
          }
          setUser(null)
          setIsAuthenticated(false)
        }
      } catch (err) {
        console.error('Auth change handler error:', err)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const login = async (identity: string, password: string) => {
    const trimmedIdentity = identity.trim()
    if (!trimmedIdentity || !password) {
      throw new Error('Por favor, informe seu usuário ou e-mail e sua senha.')
    }

    if (!navigator.onLine) {
      // Offline login attempt: only allowed if previously authenticated user matches
      const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
      if (
        cached &&
        (cached.email.toLowerCase() === trimmedIdentity.toLowerCase() ||
          cached.name.toLowerCase() === trimmedIdentity.toLowerCase())
      ) {
        if (cached.active === false) {
          throw new Error('Usuário desativado. Entre em contato com o administrador.')
        }
        setUser(cached)
        setIsAuthenticated(true)
        return
      }
      throw new Error(
        'Primeiro acesso exige conexão com a internet. Não é possível entrar offline sem sessão prévia.',
      )
    }

    try {
      const res = await pb.collection('users').authWithPassword(trimmedIdentity, password)
      const loggedUser = res.record as unknown as EpaUser
      if (loggedUser.active === false) {
        pb.authStore.clear()
        await offlineStorage.setCache(OFFLINE_AUTH_KEY, null)
        setUser(null)
        setIsAuthenticated(false)
        throw new Error('Usuário desativado. Entre em contato com o administrador.')
      }
      setUser(loggedUser)
      setIsAuthenticated(true)
      await offlineStorage.setCache(OFFLINE_AUTH_KEY, loggedUser)
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message || ''
        if (
          msg.includes('Failed to authenticate') ||
          msg.includes('400') ||
          msg.includes('invalid') ||
          msg.includes('credentials')
        ) {
          throw new Error(
            'Usuário ou senha incorretos. Verifique suas credenciais (ex.: Skip@Pass) e tente novamente.',
          )
        }
        throw err
      }
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
