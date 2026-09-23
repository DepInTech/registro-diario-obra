import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { EpaUser } from '@/types/epa'
import { offlineStorage } from '@/services/offlineStorage'
import { hashPasswordWithSalt } from '@/services/auth'
import { toast } from '@/hooks/use-toast'

interface CachedUserSession {
  user: {
    id: string
    email: string
    name: string
    role: 'admin' | 'technician'
    active?: boolean
  }
  passwordHash: string
  token: string
}

interface AuthContextType {
  user: EpaUser | null
  isAuthenticated: boolean
  isOfflineSession: boolean
  isLoading: boolean
  login: (identity: string, password: string) => Promise<void>
  logout: () => void
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (val: boolean) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isOfflineSession: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
})

const OFFLINE_AUTH_KEY = 'epa_offline_session_user'
const OFFLINE_CREDENTIALS_KEY = 'epa_offline_credentials'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EpaUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [isOfflineSession, setIsOfflineSession] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false)

  // Salva credenciais seguras para autenticação offline posterior
  const persistUserOfflineCredential = async (
    loggedUser: EpaUser,
    password: string,
    token: string,
  ) => {
    try {
      const email = loggedUser.email?.trim().toLowerCase()
      if (!email) return

      const hash = await hashPasswordWithSalt(password, email)
      const credData: CachedUserSession = {
        user: {
          id: loggedUser.id,
          email: loggedUser.email,
          name: loggedUser.name,
          role: loggedUser.role,
          active: loggedUser.active !== false,
        },
        passwordHash: hash,
        token: token || pb.authStore.token || '',
      }

      // Salva no IndexedDB e também no localStorage como redundância resiliente
      await offlineStorage.setCache(`${OFFLINE_CREDENTIALS_KEY}_${email}`, credData)
      await offlineStorage.setCache(OFFLINE_AUTH_KEY, loggedUser)
      try {
        localStorage.setItem(`${OFFLINE_CREDENTIALS_KEY}_${email}`, JSON.stringify(credData))
      } catch {
        /* intentionally ignored */
      }
    } catch (saveErr) {
      console.warn('Erro ao salvar credencial offline:', saveErr)
    }
  }

  // Tenta autenticação offline com as credenciais salvas
  const tryOfflineLogin = async (identity: string, password: string): Promise<boolean> => {
    const emailKey = identity.trim().toLowerCase()
    let cachedSession: CachedUserSession | null = null

    try {
      cachedSession = await offlineStorage.getCache<CachedUserSession>(
        `${OFFLINE_CREDENTIALS_KEY}_${emailKey}`,
      )
    } catch {
      /* intentionally ignored */
    }

    if (!cachedSession) {
      try {
        const stored = localStorage.getItem(`${OFFLINE_CREDENTIALS_KEY}_${emailKey}`)
        if (stored) {
          cachedSession = JSON.parse(stored) as CachedUserSession
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // Se não encontrou pelo e-mail direto, tenta buscar a sessão geral salva
    if (!cachedSession) {
      try {
        const fallbackUser = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
        if (fallbackUser && fallbackUser.email) {
          const fbEmail = fallbackUser.email.toLowerCase()
          if (fbEmail === emailKey || fallbackUser.name?.toLowerCase() === emailKey) {
            cachedSession = await offlineStorage.getCache<CachedUserSession>(
              `${OFFLINE_CREDENTIALS_KEY}_${fbEmail}`,
            )
            if (!cachedSession) {
              const stored = localStorage.getItem(`${OFFLINE_CREDENTIALS_KEY}_${fbEmail}`)
              if (stored) cachedSession = JSON.parse(stored) as CachedUserSession
            }
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    if (!cachedSession) {
      throw new Error(
        'Sem conexão à internet e nenhuma credencial salva neste dispositivo. Conecte-se ao menos uma vez para autenticar.',
      )
    }

    if (cachedSession.user?.active === false) {
      throw new Error('Usuário desativado. Entre em contato com o administrador.')
    }

    const inputHash = await hashPasswordWithSalt(password, cachedSession.user.email)
    if (inputHash !== cachedSession.passwordHash) {
      throw new Error('Usuário ou senha incorretos. Verifique suas credenciais e tente novamente.')
    }

    // Credencial válida: inicia sessão offline
    const sessionUser = cachedSession.user as unknown as EpaUser
    setUser(sessionUser)
    setIsAuthenticated(true)
    setIsOfflineSession(true)

    // Se havia token salvo, restaura no authStore local do PocketBase
    if (cachedSession.token) {
      try {
        pb.authStore.save(cachedSession.token, sessionUser as any)
      } catch {
        /* intentionally ignored */
      }
    }

    toast({
      title: 'Modo Offline',
      description: 'Sessão iniciada em modo offline com dados salvos neste dispositivo.',
    })

    return true
  }

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
            setIsOfflineSession(!navigator.onLine)
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, pbUser)
          } else {
            pb.authStore.clear()
            setUser(null)
            setIsAuthenticated(false)
            setIsOfflineSession(false)
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, null)
          }
        } else {
          // Check if offline cached session exists
          const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
          if (cached && cached.active !== false) {
            setUser(cached)
            setIsAuthenticated(true)
            setIsOfflineSession(true)
          } else {
            setUser(null)
            setIsAuthenticated(false)
            setIsOfflineSession(false)
          }
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setUser(null)
        setIsAuthenticated(false)
        setIsOfflineSession(false)
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
          // If pb.authStore was explicitly cleared or invalid, keep offline session if truly offline
          if (!navigator.onLine) {
            const cached = await offlineStorage.getCache<EpaUser>(OFFLINE_AUTH_KEY)
            if (cached && cached.active !== false) {
              setUser(cached)
              setIsAuthenticated(true)
              setIsOfflineSession(true)
              return
            }
          }
          setUser(null)
          setIsAuthenticated(false)
          setIsOfflineSession(false)
        }
      } catch (err) {
        console.error('Auth change handler error:', err)
      }
    })

    // Listener de retorno de conexão: revalida authRefresh em segundo plano sem deslogar
    const handleOnline = async () => {
      if (pb.authStore.isValid && pb.authStore.token) {
        try {
          const refreshed = await pb.collection('users').authRefresh<EpaUser>()
          if (refreshed?.record) {
            setUser(refreshed.record)
            setIsOfflineSession(false)
            await offlineStorage.setCache(OFFLINE_AUTH_KEY, refreshed.record)
          }
        } catch (refreshErr) {
          console.warn(
            'Revalidação de sessão online falhou em segundo plano (mantendo sessão local):',
            refreshErr,
          )
        }
      }
    }

    window.addEventListener('online', handleOnline)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  const login = async (identity: string, password: string) => {
    const trimmedIdentity = identity.trim()
    if (!trimmedIdentity || !password) {
      throw new Error('Por favor, informe seu usuário ou e-mail e sua senha.')
    }

    // Se estiver offline de imediato pelo navegador
    if (!navigator.onLine) {
      await tryOfflineLogin(trimmedIdentity, password)
      return
    }

    // Se estiver online, tenta autenticar com o PocketBase
    try {
      const res = await pb.collection('users').authWithPassword(trimmedIdentity, password)
      const loggedUser = res.record as unknown as EpaUser
      if (loggedUser.active === false) {
        pb.authStore.clear()
        await offlineStorage.setCache(OFFLINE_AUTH_KEY, null)
        setUser(null)
        setIsAuthenticated(false)
        setIsOfflineSession(false)
        throw new Error('Usuário desativado. Entre em contato com o administrador.')
      }

      setUser(loggedUser)
      setIsAuthenticated(true)
      setIsOfflineSession(false)

      // Persiste perfil e verificador de credencial offline (hash SHA-256)
      await persistUserOfflineCredential(loggedUser, password, res.token)
    } catch (err: unknown) {
      // Se a falha for de conectividade ("Failed to fetch", "NetworkError", status 0 ou timeout),
      // tenta autenticar offline com as credenciais cacheadas antes de falhar
      const errMsg = err instanceof Error ? err.message : String(err)
      const isNetworkError =
        !navigator.onLine ||
        errMsg.toLowerCase().includes('failed to fetch') ||
        errMsg.toLowerCase().includes('networkerror') ||
        errMsg.toLowerCase().includes('connection') ||
        errMsg.toLowerCase().includes('offline') ||
        (err as any)?.status === 0

      if (isNetworkError) {
        await tryOfflineLogin(trimmedIdentity, password)
        return
      }

      // Se foi erro de credencial inválida no servidor
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
    setIsOfflineSession(false)
    setHasUnsavedChanges(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isOfflineSession,
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
