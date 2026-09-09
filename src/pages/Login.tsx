import { useState } from 'react'
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Loader2,
  AlertCircle,
  ShieldCheck,
  Leaf,
  BarChart3,
  Users2,
  Sun,
  Moon,
  Info,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { logoEpa } from '@/components/EpaLogo'

// Imagem estável de alta resolução: Lago límpido cercado por densa floresta e luz solar suave ao amanhecer
const NATURE_BG = 'https://img.usecurling.com/p/1600/1200?q=lake+forest+sunrise&color=008F68'

export function LoginPage() {
  const [identity, setIdentity] = useState('annik_almeida@grupoepa.com.br')
  const [password, setPassword] = useState('Skip@Pass')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
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
      {/* Botão de alternância de tema discreto no topo */}
      <div className="absolute top-4 right-4 z-40">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          className="h-8 px-2.5 rounded-full border-slate-200/80 bg-white/80 text-[11px] font-medium text-[#17324D] shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-[#008F68] dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-emerald-400"
        >
          {theme === 'dark' ? (
            <span className="flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden sm:inline">Modo Claro</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Moon className="h-3.5 w-3.5 text-slate-600" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </span>
          )}
        </Button>
      </div>

      {/* ========================================================= */}
      {/* LADO ESQUERDO (~46%): Natureza, Logo EPA e Pilares EPA   */}
      {/* ========================================================= */}
      <aside className="relative flex flex-col justify-between w-full lg:w-[46%] xl:w-[47%] min-h-[460px] lg:min-h-screen p-8 sm:p-12 lg:p-14 xl:p-16 overflow-hidden text-white shrink-0">
        {/* Imagem de Fundo Realística de Natureza (Lago, Floresta, Amanhecer) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-[1.02]"
          style={{
            backgroundImage: `url('${NATURE_BG}')`,
          }}
          aria-hidden="true"
        />

        {/* Leve overlay de teal/verde para contraste impecável preservando a vivacidade da foto */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#063B4A]/40 via-transparent to-[#063B4A]/70 pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/15 pointer-events-none"
          aria-hidden="true"
        />

        {/* Conteúdo Institucional */}
        <div className="relative z-10 flex flex-col h-full justify-between gap-10">
          {/* Topo Esquerdo: Logo Oficial EPA sem moldura/fundo branco */}
          <div className="pt-2">
            <div className="inline-flex items-center">
              <img
                src={logoEpa}
                alt="EPA — Soluções Ambientais"
                className="h-10 sm:h-12 w-auto max-w-[210px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
              />
            </div>
          </div>

          {/* Centro: Título em destaque e descrição operacional */}
          <div className="max-w-xl my-auto py-6 lg:py-8">
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] xl:text-[44px] font-semibold text-white tracking-tight leading-[1.2] drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
              Tecnologia e compromisso{' '}
              <span className="block mt-1">
                com um{' '}
                <span className="text-[#34D399] font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                  futuro sustentável.
                </span>
              </span>
            </h1>

            <div className="mt-6 space-y-1 text-sm sm:text-base text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)] font-normal leading-relaxed">
              <p className="font-medium text-white">
                Sistema de Gestão de RDO e Planilha de Campo.
              </p>
              <p className="text-white/85 text-xs sm:text-sm">
                Mais controle, agilidade e segurança para suas operações.
              </p>
            </div>
          </div>

          {/* Base: 4 Pilares Institucionais em linha com ícones delineados e divisórias translúcidas */}
          <div className="pb-2 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 items-start gap-3 sm:gap-0 sm:divide-x sm:divide-white/20">
              {/* Item 1 */}
              <div className="flex flex-col items-center text-center px-2 py-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm text-white shadow-sm mb-2.5 transition-transform hover:scale-110">
                  <ShieldCheck className="h-5 w-5 stroke-[1.75]" />
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-white/95 leading-tight tracking-tight">
                  Conformidade
                  <br />
                  ambiental
                </span>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col items-center text-center px-2 py-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm text-white shadow-sm mb-2.5 transition-transform hover:scale-110">
                  <Leaf className="h-5 w-5 stroke-[1.75]" />
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-white/95 leading-tight tracking-tight">
                  Gestão
                  <br />
                  inteligente
                </span>
              </div>

              {/* Item 3 */}
              <div className="flex flex-col items-center text-center px-2 py-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm text-white shadow-sm mb-2.5 transition-transform hover:scale-110">
                  <BarChart3 className="h-5 w-5 stroke-[1.75]" />
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-white/95 leading-tight tracking-tight">
                  Resultados
                  <br />
                  sustentáveis
                </span>
              </div>

              {/* Item 4 */}
              <div className="flex flex-col items-center text-center px-2 py-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/10 backdrop-blur-sm text-white shadow-sm mb-2.5 transition-transform hover:scale-110">
                  <Users2 className="h-5 w-5 stroke-[1.75]" />
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-white/95 leading-tight tracking-tight">
                  Juntos por
                  <br />
                  um amanhã melhor
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================= */}
      {/* LADO DIREITO (~54%): Fundo claro decorado e Card Branco  */}
      {/* ========================================================= */}
      <main className="relative flex-1 flex flex-col justify-between items-center p-6 sm:p-10 lg:p-12 min-h-screen bg-[#F7FAF9] dark:bg-slate-950 overflow-hidden">
        {/* Blobs orgânicos sutis em verde conforme referência visual */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#00A878]/12 via-[#008F68]/8 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-12 right-0 h-96 w-96 opacity-60 dark:opacity-20"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 400 400"
            className="w-full h-full text-emerald-600/10 fill-current"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M320,60 C380,120 410,220 370,290 C330,360 220,400 140,370 C60,340 10,240 30,160 C50,80 140,40 220,30 C260,25 290,30 320,60 Z"
              opacity="0.6"
            />
          </svg>
        </div>

        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-[#008F68]/10 via-[#063B4A]/6 to-transparent blur-3xl"
          aria-hidden="true"
        />

        {/* Espaçador flexível no topo */}
        <div className="w-full" />

        {/* Card de Login Centralizado e Fiel à Imagem de Referência */}
        <div className="relative z-10 w-full max-w-[430px] sm:max-w-[450px] my-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-10 shadow-[0_15px_45px_-10px_rgba(6,59,74,0.07)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)]">
            {/* Topo do Card: Logo Oficial EPA Centralizada */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <img
                  src={logoEpa}
                  alt="EPA — Soluções Ambientais"
                  className="h-14 sm:h-16 w-auto max-w-[210px] object-contain"
                />
              </div>

              <h2 className="text-2xl sm:text-[26px] font-bold text-[#17324D] dark:text-white tracking-tight">
                Bem-vindo!
              </h2>
              <p className="mt-1 text-sm text-[#64748B] dark:text-slate-400">
                Faça login para acessar o sistema.
              </p>
            </div>

            {/* Mensagem de Erro com ícone */}
            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-50/90 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Erro ao entrar</p>
                  <p className="leading-snug">{error}</p>
                </div>
              </div>
            )}

            {/* Mensagem de Instrução de Recuperação */}
            {forgotPasswordMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-50/90 p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
                <Info className="h-4 w-4 shrink-0 text-[#008F68] mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Recuperação de Senha</p>
                  <p className="leading-snug">{forgotPasswordMessage}</p>
                </div>
              </div>
            )}

            {/* Formulário de Autenticação */}
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
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#008F68] dark:group-focus-within:text-emerald-400 transition-colors">
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
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm text-[#17324D] placeholder:text-slate-400 transition-all hover:border-slate-300 focus-visible:border-[#008F68] focus-visible:ring-2 focus-visible:ring-[#008F68]/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/20 shadow-none"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-semibold text-[#17324D] dark:text-slate-300"
                >
                  Senha
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#008F68] dark:group-focus-within:text-emerald-400 transition-colors">
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
                    className="h-11 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm text-[#17324D] placeholder:text-slate-400 transition-all hover:border-slate-300 focus-visible:border-[#008F68] focus-visible:ring-2 focus-visible:ring-[#008F68]/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-emerald-500 dark:focus-visible:ring-emerald-500/20 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#008F68] dark:hover:text-emerald-400 transition-colors p-1 rounded-md"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Opções: Lembrar-me e Esqueceu sua senha? */}
              <div className="flex items-center justify-between pt-0.5 text-xs">
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

              {/* Botão Entrar com seta */}
              <button
                type="submit"
                disabled={loading}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#008F68] text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#00A878] active:bg-[#005B4F] active:scale-[0.99] disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>Entrar</span>
                    <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                  </span>
                )}
              </button>
            </form>

            {/* Separador EPA sutil e Acessos Rápidos de Demonstração */}
            <div className="mt-7">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
                </div>
                <div className="relative bg-white px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:bg-slate-900 dark:text-slate-500 uppercase">
                  EPA
                </div>
              </div>

              {/* Botões de Acesso Rápido estilizados discretamente */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => handleQuickFill('annik_almeida@grupoepa.com.br')}
                  className="group rounded-xl border border-slate-200/90 bg-[#F7FAF9]/70 py-2 px-1.5 text-center transition-all hover:border-[#008F68] hover:bg-emerald-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-emerald-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-[#008F68] dark:text-emerald-400 text-xs">
                    Admin
                  </p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Annik</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('tecnico@grupoepa.com.br')}
                  className="group rounded-xl border border-slate-200/90 bg-[#F7FAF9]/70 py-2 px-1.5 text-center transition-all hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-blue-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-blue-600 dark:text-blue-400 text-xs">Técnico</p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Marina</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('operador@grupoepa.com.br')}
                  className="group rounded-xl border border-slate-200/90 bg-[#F7FAF9]/70 py-2 px-1.5 text-center transition-all hover:border-teal-500 hover:bg-teal-50/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-teal-600/50 dark:hover:bg-slate-800"
                >
                  <p className="font-semibold text-teal-600 dark:text-teal-400 text-xs">Operador</p>
                  <p className="text-[10px] text-[#64748B] dark:text-slate-400 truncate">Carlos</p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé discreto no canto inferior direito conforme imagem de referência */}
        <div className="w-full pt-6 pb-1 flex justify-end items-center">
          <div className="text-right text-[11px] text-[#64748B]/80 dark:text-slate-500 space-y-0.5 select-none">
            <p className="font-medium text-slate-500 dark:text-slate-400">
              EPA – Soluções Ambientais
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-600">Versão 1.0.0</p>
          </div>
        </div>
      </main>
    </div>
  )
}
