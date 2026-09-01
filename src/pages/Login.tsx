import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, Loader2, AlertCircle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { EpaLogo, logoEpa } from '@/components/EpaLogo'

export function LoginPage() {
  const [identity, setIdentity] = useState('annik_almeida@grupoepa.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identity.trim() || !password) {
      setError('Por favor, informe seu usuário/e-mail e senha.')
      return
    }
    setError(null)
    setLoading(true)

    try {
      await login(identity.trim(), password)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Usuário ou senha incorretos.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = (email: string) => {
    setIdentity(email)
    setPassword('Skip@Pass')
    setError(null)
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-slate-100 selection:bg-emerald-500 selection:text-white dark:bg-slate-950">
      {/* Top bar with theme toggle */}
      <header className="flex h-16 items-center justify-between px-6 border-b border-slate-800/80">
        <EpaLogo className="scale-90 origin-left" />
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="text-xs text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {theme === 'dark' ? '☀ Modo Claro' : '🌙 Modo Escuro'}
        </Button>
      </header>

      <main className="flex flex-1 items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-emerald-400 mb-2 shadow-inner">
                <img src={logoEpa} alt="EPA Logo" className="h-16 w-auto object-contain" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Sistema EPA de Gestão
              </h1>
              <p className="text-xs text-slate-400">
                Acesso restrito para operação ambiental, RDO e planilhas
              </p>
            </div>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300 animate-in fade-in duration-200">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-red-200">Falha na autenticação</p>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Usuário ou E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="seu.email@grupoepa.com.br"
                    autoComplete="username"
                    required
                    disabled={loading}
                    className="h-11 border-slate-800 bg-slate-950/80 pl-10 text-sm text-white placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">Senha</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="h-11 border-slate-800 bg-slate-950/80 pl-10 pr-10 text-sm text-white placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="mt-2 h-11 w-full bg-emerald-600 font-medium text-white transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  'Entrar no sistema'
                )}
              </Button>
            </form>

            {/* Quick profiles for convenience */}
            <div className="mt-8 border-t border-slate-800/80 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-center mb-3">
                Acessos Rápidos (Demonstração)
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('annik_almeida@grupoepa.com.br')}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center transition hover:border-emerald-600/50 hover:bg-slate-800"
                >
                  <p className="font-semibold text-emerald-400">Admin</p>
                  <p className="text-[10px] text-slate-500 truncate">Annik</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('tecnico@grupoepa.com.br')}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center transition hover:border-blue-600/50 hover:bg-slate-800"
                >
                  <p className="font-semibold text-blue-400">Técnico</p>
                  <p className="text-[10px] text-slate-500 truncate">Marina</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('operador@grupoepa.com.br')}
                  className="rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-center transition hover:border-teal-600/50 hover:bg-slate-800"
                >
                  <p className="font-semibold text-teal-400">Operador</p>
                  <p className="text-[10px] text-slate-500 truncate">Carlos</p>
                </button>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-500">
            <p>
              Grupo EPA &copy; {new Date().getFullYear()} · Sistema Integrado de Gestão Ambiental
            </p>
            <p className="mt-1">PWA habilitado · Operação offline com sincronização automática</p>
          </div>
        </div>
      </main>
    </div>
  )
}
