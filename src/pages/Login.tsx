import { useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Cpu,
  Leaf,
  Users,
  Sun,
  Moon,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { logoEpa } from '@/components/EpaLogo'

export function LoginPage() {
  const [identity, setIdentity] = useState('annik_almeida@grupoepa.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(true)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null)
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identity.trim() || !password) {
      setError('Por favor, informe seu usuário ou e-mail e sua senha.')
      return
    }
    setError(null)
    setForgotPasswordMessage(null)
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
    setForgotPasswordMessage(null)
  }

  const handleForgotPassword = () => {
    setForgotPasswordMessage(
      'Para redefinir sua senha, solicite o link de recuperação ao administrador do sistema EPA ou pelo suporte interno de TI.',
    )
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#F7FAF9] dark:bg-slate-950 text-[#17324D] dark:text-slate-100 selection:bg-[#008F68] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Botão de alternância de tema no topo à direita */}
      <div className="absolute top-4 right-4 z-30">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          className="h-9 px-3 rounded-full border-slate-200/80 bg-white/80 text-xs font-medium text-[#17324D] shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-[#008F68] hover:border-[#008F68]/30 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-emerald-400"
        >
          {theme === 'dark' ? (
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>Modo Claro</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5 text-slate-600" />
              <span>Modo Escuro</span>
            </span>
          )}
        </Button>
      </div>

      {/* ========================================================= */}
      {/* LADO ESQUERDO (~45%): Área Institucional EPA              */}
      {/* ========================================================= */}
      <aside className="relative flex flex-col justify-between w-full lg:w-[45%] lg:min-h-screen p-6 sm:p-10 lg:p-12 xl:p-14 overflow-hidden bg-[#063B4A] text-white">
        {/* Imagem de fundo temática sustentabilidade/natureza com sobreposição verde/azul escura */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-105 pointer-events-none opacity-25 mix-blend-overlay"
          style={{
            backgroundImage: `url('https://img.usecurling.com/p/1600/1200?q=forest+water+drone&color=063B4A')`,
          }}
          aria-hidden="true"
        />

        {/* Gradientes de sobreposição para garantir legibilidade perfeita */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#063B4A]/95 via-[#005B4F]/90 to-[#063B4A]/95 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,168,120,0.18),transparent_50%)] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#008F68]/20 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Conteúdo Institucional */}
        <div className="relative z-10 flex flex-col h-full justify-between gap-8 lg:gap-12">
          {/* Topo: Logo EPA Oficial */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/95 px-3.5 py-2 shadow-md backdrop-blur-sm transition-transform hover:scale-[1.02]">
              <img
                src={logoEpa}
                alt="EPA — Soluções Ambientais"
                className="h-10 sm:h-11 w-auto max-w-[190px] object-contain"
              />
            </div>
            <div className="hidden sm:block border-l border-white/20 pl-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Soluções Ambientais
              </span>
              <span className="block text-[11px] text-white/70">
                Gestão Integrada de Campo & RDO
              </span>
            </div>
          </div>

          {/* Centro: Título de impacto e descrições */}
          <div className="my-auto py-4 sm:py-6 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 backdrop-blur-sm mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Plataforma Operacional de Campo
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.65rem] font-bold tracking-tight text-white leading-tight sm:leading-snug">
              Tecnologia e compromisso com um{' '}
              <span className="bg-gradient-to-r from-[#00A878] to-emerald-300 bg-clip-text text-transparent underline decoration-[#00A878]/50 decoration-wavy decoration-1 underline-offset-4">
                futuro sustentável
              </span>
              .
            </h1>

            <div className="mt-4 sm:mt-5 space-y-2 text-sm sm:text-base text-white/85 leading-relaxed">
              <p className="font-medium text-white/95">
                Sistema de Gestão de RDO e Planilha de Campo
              </p>
              <p className="text-white/75 text-xs sm:text-sm">
                Mais controle, agilidade e segurança para suas operações ambientais.
              </p>
            </div>
          </div>

          {/* Rodapé institucional: Pequenos blocos com ícones simples */}
          <div className="pt-2">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="group rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-emerald-400/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#008F68]/30 text-emerald-300 group-hover:scale-105 transition-transform">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/95 leading-tight">
                    Conformidade ambiental
                  </span>
                </div>
              </div>

              <div className="group rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-emerald-400/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#008F68]/30 text-emerald-300 group-hover:scale-105 transition-transform">
                    <Cpu className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/95 leading-tight">
                    Gestão inteligente
                  </span>
                </div>
              </div>

              <div className="group rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-emerald-400/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#008F68]/30 text-emerald-300 group-hover:scale-105 transition-transform">
                    <Leaf className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/95 leading-tight">
                    Resultados sustentáveis
                  </span>
                </div>
              </div>

              <div className="group rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:bg-white/10 hover:border-emerald-400/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#008F68]/30 text-emerald-300 group-hover:scale-105 transition-transform">
                    <Users className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-white/95 leading-tight">
                    Juntos por um amanhã melhor
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/50">
              <span>Operação Offline / PWA Habilitado</span>
              <span>EPA &copy; {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* LADO DIREITO (~55%): Card de Login Centralizado           */}
      {/* ========================================================= */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 min-h-screen bg-[#F7FAF9] dark:bg-slate-950">
        <div className="w-full max-w-[440px] transition-all duration-300 animate-in fade-in zoom-in-[0.98]">
          {/* Card de Login Premium / Corporativo */}
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9 shadow-[0_10px_35px_-10px_rgba(6,59,74,0.08)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_10px_35px_-10px_rgba(0,0,0,0.5)] transition-all">
            {/* Topo do Card: Logo Oficial EPA Centralizada */}
            <div className="text-center flex flex-col items-center">
              <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-[#F7FAF9] border border-slate-100 shadow-sm dark:bg-slate-950 dark:border-slate-800 mb-4 transition-transform hover:scale-105">
                <img
                  src={logoEpa}
                  alt="EPA — Soluções Ambientais"
                  className="h-12 sm:h-14 w-auto object-contain"
                />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#17324D] dark:text-white">
                Bem-vindo!
              </h2>
              <p className="mt-1 text-sm text-[#64748B] dark:text-slate-400">
                Faça login para acessar o sistema.
              </p>
            </div>

            {/* Mensagem de Erro */}
            {error && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-50/80 p-3.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Falha na autenticação</p>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Mensagem do Esqueceu sua senha */}
            {forgotPasswordMessage && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/80 p-3.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in duration-200">
                <Info className="h-4 w-4 shrink-0 text-[#008F68] dark:text-emerald-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Recuperação de Acesso</p>
                  <p className="leading-relaxed">{forgotPasswordMessage}</p>
                </div>
              </div>
            )}

            {/* Formulário de Login */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Campo Usuário ou E-mail */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="identity-input"
                  className="block text-xs font-semibold text-[#17324D] dark:text-slate-300"
                >
                  Usuário ou E-mail
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#008F68] transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="identity-input"
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="Digite seu usuário ou e-mail"
                    autoComplete="username"
                    required
                    disabled={loading}
                    className="h-11 rounded-xl border-slate-200/90 bg-[#F7FAF9]/60 pl-10 text-sm text-[#17324D] placeholder:text-slate-400 shadow-none transition-all hover:border-slate-300 focus-visible:border-[#008F68] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#008F68]/15 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-input"
                    className="block text-xs font-semibold text-[#17324D] dark:text-slate-300"
                  >
                    Senha
                  </label>
                </div>
                <div className="relative group">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#008F68] transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="h-11 rounded-xl border-slate-200/90 bg-[#F7FAF9]/60 pl-10 pr-10 text-sm text-[#17324D] placeholder:text-slate-400 shadow-none transition-all hover:border-slate-300 focus-visible:border-[#008F68] focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-[#008F68]/15 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#008F68] dark:hover:text-emerald-400 transition-colors p-1"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Opções extras: Lembrar-me e Esqueceu sua senha? */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[#64748B] dark:text-slate-400 hover:text-[#17324D] dark:hover:text-slate-200">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#008F68] focus:ring-[#008F68]/20 dark:border-slate-700 dark:bg-slate-950 dark:checked:bg-[#008F68]"
                  />
                  <span>Lembrar-me</span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-medium text-[#008F68] hover:text-[#005B4F] dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors underline-offset-4 hover:underline"
                >
                  Esqueceu sua senha?
                </button>
              </div>

              {/* Botão de Login Redesenhado */}
              <button
                type="submit"
                disabled={loading}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#008F68] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#00A878] active:bg-[#005B4F] active:scale-[0.99] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span>Entrar &rarr;</span>
                )}
              </button>
            </form>

            {/* Acessos Rápidos para demonstração / testes em campo */}
            <div className="mt-7 border-t border-slate-100 dark:border-slate-800/80 pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-500 text-center mb-2.5">
                Acessos Rápidos (Demonstração)
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('annik_almeida@grupoepa.com.br')}
                  className="rounded-xl border border-slate-200/80 bg-[#F7FAF9] p-2 text-center transition-all hover:border-[#008F68] hover:bg-emerald-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-[#008F68] dark:text-emerald-400">Admin</p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Annik</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('tecnico@grupoepa.com.br')}
                  className="rounded-xl border border-slate-200/80 bg-[#F7FAF9] p-2 text-center transition-all hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-blue-600 dark:text-blue-400">Técnico</p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Marina</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('operador@grupoepa.com.br')}
                  className="rounded-xl border border-slate-200/80 bg-[#F7FAF9] p-2 text-center transition-all hover:border-teal-500 hover:bg-teal-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-teal-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-teal-600 dark:text-teal-400">Operador</p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Carlos</p>
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé sutil de suporte */}
          <div className="mt-5 text-center text-[11px] text-[#64748B] dark:text-slate-500 space-y-0.5">
            <p>Grupo EPA &copy; {new Date().getFullYear()} · Sistema RDO & Planilha de Campo</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-600">
              Ambiente seguro com criptografia de ponta a ponta
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
