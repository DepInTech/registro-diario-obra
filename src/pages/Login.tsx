import { useState } from 'react'
import { Eye, EyeOff, Lock, User, Loader2, AlertCircle, Sun, Moon, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { logoEpa } from '@/components/EpaLogo'

// Imagem estável de alta resolução: Lago límpido cercado por densa floresta e luz solar suave ao amanhecer
const NATURE_BG = 'https://img.usecurling.com/p/1600/1200?q=lake+forest+sunrise'

export function LoginPage() {
  // Nenhum prefill de credencial: os campos começam sempre vazios.
  // (Antes: identity 'annik_almeida@grupoepa.com.br' e password 'Skip@Pass' pré-preenchidos)
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<string | null>(null)
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identity.trim() || !password) {
      setError('Por favor, informe seu e-mail e sua senha.')
      return
    }
    setError(null)
    setForgotPasswordMessage(null)
    setLoading(true)

    try {
      await login(identity.trim(), password)
      // Redirecionamento pós-login é automático via perfil do servidor (Index.tsx)
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

  const handleForgotPassword = () => {
    setForgotPasswordMessage(
      'Para redefinir sua senha, solicite o link de recuperação ao administrador do sistema EPA ou pelo suporte interno de TI.',
    )
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#F7FAF9] text-[#17324D] selection:bg-[#008F68] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Botão de alternância de tema no topo: discreto, harmônico e perfeitamente legível */}
      <div className="absolute top-4 right-4 z-40">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200/90 bg-white/95 text-[11px] font-medium text-[#17324D] shadow-sm backdrop-blur-md transition-all hover:bg-white hover:border-[#008F68]/40 hover:text-[#008F68] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008F68]/30 cursor-pointer"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="h-3.5 w-3.5 text-amber-500" />
              <span className="hidden sm:inline">Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5 text-[#17324D]" />
              <span className="hidden sm:inline">Modo Escuro</span>
            </>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* LADO ESQUERDO (~46%): Natureza, Logo EPA e Pilares EPA   */}
      {/* Visual fixo autônomo e de alto contraste em qualquer tema */}
      {/* ========================================================= */}
      <aside className="relative flex flex-col justify-between w-full lg:w-[46%] xl:w-[47%] min-h-[460px] lg:min-h-screen p-8 sm:p-12 lg:p-14 xl:p-16 overflow-hidden text-white shrink-0 bg-[#063B4A]">
        {/* Imagem de Fundo Realística de Natureza (Lago, Floresta, Amanhecer) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-1000 scale-[1.02]"
          style={{
            backgroundImage: `url('${NATURE_BG}')`,
          }}
          aria-hidden="true"
        />

        {/* Gradiente de escurecimento cuidadoso para garantir contraste WCAG AAA sobre a foto */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#063B4A]/60 via-[#063B4A]/40 to-[#063B4A]/85 pointer-events-none"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/25 pointer-events-none" aria-hidden="true" />

        {/* Conteúdo Institucional */}
        <div className="relative z-10 flex flex-col h-full justify-between gap-10">
          {/* Topo Esquerdo: Logo Oficial EPA sem distorção nem filtros */}
          <div className="pt-2">
            <div className="inline-flex items-center">
              <img
                src={logoEpa}
                alt="EPA — Soluções Ambientais"
                className="h-10 sm:h-12 w-auto max-w-[210px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
              />
            </div>
          </div>

          {/* Centro: Título em destaque e descrição operacional */}
          <div className="max-w-xl my-auto py-6 lg:py-8">
            <h1 className="text-3xl sm:text-4xl lg:text-[40px] xl:text-[44px] font-semibold text-white tracking-tight leading-[1.2] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
              Tecnologia e compromisso{' '}
              <span className="block mt-1">
                com um{' '}
                <span className="text-[#34D399] font-bold drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
                  futuro sustentável.
                </span>
              </span>
            </h1>

            <div className="mt-6 space-y-1.5 text-sm sm:text-base text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] font-normal leading-relaxed">
              <p className="font-semibold text-white">
                Sistema de Gestão de RDO e Planilha de Campo.
              </p>
              <p className="text-white/90 text-xs sm:text-sm">
                Mais controle, agilidade e segurança para suas operações.
              </p>
            </div>
          </div>

          {/* Base: Pilares Institucionais removidos (distinção visual simplificada) */}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* LADO DIREITO (~54%): Fundo claro #F7FAF9 fixo e Card Branco */}
      {/* ========================================================= */}
      <main className="relative flex-1 flex flex-col justify-between items-center p-6 sm:p-10 lg:p-12 min-h-screen bg-[#F7FAF9] text-[#17324D] overflow-hidden">
        {/* Blobs orgânicos sutis em verde conforme referência visual */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-[#00A878]/15 via-[#008F68]/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-12 right-0 h-96 w-96 opacity-60"
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
          className="pointer-events-none absolute -bottom-20 -left-20 h-[380px] w-[380px] rounded-full bg-gradient-to-tr from-[#008F68]/12 via-[#063B4A]/8 to-transparent blur-3xl"
          aria-hidden="true"
        />

        {/* Espaçador flexível no topo */}
        <div className="w-full" />

        {/* Card de Login Centralizado */}
        <div className="relative z-10 w-full max-w-[430px] sm:max-w-[450px] my-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-10 shadow-[0_15px_45px_-10px_rgba(6,59,74,0.08)]">
            {/* Topo do Card: Logo Oficial EPA Centralizada */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <img
                  src={logoEpa}
                  alt="EPA — Soluções Ambientais"
                  className="h-14 sm:h-16 w-auto max-w-[210px] object-contain"
                />
              </div>

              <h2 className="text-2xl sm:text-[26px] font-bold text-[#17324D] tracking-tight">
                Bem-vindo!
              </h2>
              <p className="mt-1 text-sm text-[#475569] font-medium">
                Faça login para acessar o sistema.
              </p>
            </div>

            {/* Mensagem de Erro com ícone */}
            {error && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-red-900">Erro ao entrar</p>
                  <p className="leading-snug text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Mensagem de Instrução de Recuperação */}
            {forgotPasswordMessage && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-50 p-3 text-xs text-emerald-900 animate-in fade-in">
                <div className="space-y-0.5">
                  <p className="font-semibold text-emerald-900">Recuperação de Senha</p>
                  <p className="leading-snug text-emerald-800">{forgotPasswordMessage}</p>
                </div>
              </div>
            )}

            {/* Formulário de Autenticação — somente e-mail, senha e Entrar */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {/* Campo E-mail */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="identity-input"
                  className="block text-xs font-semibold text-[#17324D]"
                >
                  E-mail
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#008F68] transition-colors">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="identity-input"
                    type="email"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="Digite seu e-mail"
                    autoComplete="username"
                    required
                    disabled={loading}
                    className="flex h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-[#17324D] placeholder:text-slate-400 shadow-none transition-all hover:border-slate-400 focus:border-[#008F68] focus:outline-none focus:ring-2 focus:ring-[#008F68]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="password-input"
                  className="block text-xs font-semibold text-[#17324D]"
                >
                  Senha
                </label>
                <div className="relative group">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#008F68] transition-colors">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    className="flex h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-10 text-sm text-[#17324D] placeholder:text-slate-400 shadow-none transition-all hover:border-slate-400 focus:border-[#008F68] focus:outline-none focus:ring-2 focus:ring-[#008F68]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#008F68] transition-colors p-1 rounded-md cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Recuperação de senha */}
              <div className="flex items-center justify-end pt-0.5 text-xs">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="font-semibold text-[#008F68] hover:text-[#005B4F] transition-colors underline-offset-4 hover:underline cursor-pointer"
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

            {/* Nenhum botão de perfil, acesso rápido, credencial demo ou dica de fluxo. */}
            {/* Redirecionamento pós-login é automático pelo perfil gravado no servidor. */}
          </div>
        </div>

        {/* Rodapé discreto no canto inferior direito conforme imagem de referência */}
        <div className="w-full pt-6 pb-1 flex justify-end items-center">
          <div className="text-right text-[11px] text-[#475569] space-y-0.5 select-none">
            <p className="font-medium text-[#334155]">EPA – Soluções Ambientais</p>
            <p className="text-[10px] text-[#64748B]">Versão 1.0.0</p>
          </div>
        </div>
      </main>
    </div>
  )
}
