import { useEffect, useState } from 'react'
import {
  Accessibility,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sun,
  Contrast,
  Underline,
  Type,
  X,
} from 'lucide-react'

const CDN_URL =
  'https://cdn.jsdelivr.net/gh/PrabothCharith/accessibility-plugin@main/accessibility-menu.min.js'

export function AccessibilityLoader() {
  const [cdnLoaded, setCdnLoaded] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Estados dos recursos de acessibilidade nativos do fallback
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0)
  const [highContrast, setHighContrast] = useState(false)
  const [inverted, setInverted] = useState(false)
  const [highlightLinks, setHighlightLinks] = useState(false)
  const [readableFont, setReadableFont] = useState(false)

  useEffect(() => {
    let isMounted = true

    // Carregamento dinâmico assíncrono e resiliente do plugin externo
    const script = document.createElement('script')
    script.src = CDN_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'

    const timeoutId = setTimeout(() => {
      // Se após 3.5 segundos o script do CDN não tiver injetado menu ou falhou, ativa fallback elegante
      if (isMounted) {
        const existingExternalMenu =
          document.querySelector('#accessibility-menu') ||
          document.querySelector('.accessibility-menu') ||
          document.querySelector("[class*='accessibility-menu']") ||
          document.querySelector("[id*='accessibility-menu']") ||
          document.querySelector("[id*='accessibility-btn']")
        if (!existingExternalMenu) {
          setUseFallback(true)
        }
      }
    }, 3500)

    script.onload = () => {
      if (!isMounted) return
      clearTimeout(timeoutId)
      // Checa se o plugin realmente instanciou a UI no DOM
      setTimeout(() => {
        if (!isMounted) return
        const existingExternalMenu =
          document.querySelector('#accessibility-menu') ||
          document.querySelector('.accessibility-menu') ||
          document.querySelector("[class*='accessibility-menu']") ||
          document.querySelector("[id*='accessibility-menu']") ||
          document.querySelector("[id*='accessibility-btn']")

        if (existingExternalMenu) {
          setCdnLoaded(true)
          setUseFallback(false)
        } else {
          setUseFallback(true)
        }
      }, 500)
    }

    script.onerror = () => {
      if (!isMounted) return
      clearTimeout(timeoutId)
      console.warn(
        'Accessibility plugin CDN indisponível ou bloqueado por CSP/Offline. Ativando menu de acessibilidade nativo integrado.',
      )
      setUseFallback(true)
    }

    try {
      document.body.appendChild(script)
    } catch (e) {
      console.warn('Erro ao anexar script de acessibilidade:', e)
      setUseFallback(true)
    }

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [])

  // Aplica estilos dinâmicos de acessibilidade caso o fallback nativo esteja ativo
  useEffect(() => {
    if (!useFallback) return

    // Ajuste de tamanho de fonte no HTML
    const htmlEl = document.documentElement
    if (fontSizeOffset === 0) {
      htmlEl.style.fontSize = ''
    } else {
      htmlEl.style.fontSize = `${100 + fontSizeOffset * 10}%`
    }

    // Alto contraste
    if (highContrast) {
      document.body.classList.add('epa-a11y-high-contrast')
    } else {
      document.body.classList.remove('epa-a11y-high-contrast')
    }

    // Inversão de cores
    if (inverted) {
      document.body.classList.add('epa-a11y-inverted')
    } else {
      document.body.classList.remove('epa-a11y-inverted')
    }

    // Destacar links
    if (highlightLinks) {
      document.body.classList.add('epa-a11y-highlight-links')
    } else {
      document.body.classList.remove('epa-a11y-highlight-links')
    }

    // Fonte de fácil leitura
    if (readableFont) {
      document.body.classList.add('epa-a11y-readable-font')
    } else {
      document.body.classList.remove('epa-a11y-readable-font')
    }
  }, [useFallback, fontSizeOffset, highContrast, inverted, highlightLinks, readableFont])

  const handleReset = () => {
    setFontSizeOffset(0)
    setHighContrast(false)
    setInverted(false)
    setHighlightLinks(false)
    setReadableFont(false)
    document.documentElement.style.fontSize = ''
    document.body.classList.remove(
      'epa-a11y-high-contrast',
      'epa-a11y-inverted',
      'epa-a11y-highlight-links',
      'epa-a11y-readable-font',
    )
  }

  // Se o script do CDN carregou com sucesso e inseriu seu próprio widget, o fallback não é renderizado
  if (cdnLoaded && !useFallback) {
    return null
  }

  // Se fallback estiver ativado (CDN off/bloqueado/lento), renderiza menu flutuante elegante
  if (!useFallback) {
    return null
  }

  return (
    <aside
      id="epa-native-accessibility"
      aria-label="Ferramentas de acessibilidade"
      className="fixed z-40 select-none bottom-20 right-4 lg:bottom-6 lg:right-6 print:hidden"
    >
      {/* Botão flutuante para abrir menu de acessibilidade */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          aria-label="Abrir menu de acessibilidade"
          aria-expanded={false}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#086B63] text-white shadow-xl hover:bg-[#06544e] focus:outline-none focus:ring-2 focus:ring-[#086B63] focus:ring-offset-2 transition-transform active:scale-95"
          title="Opções de Acessibilidade"
        >
          <Accessibility className="h-6 w-6" />
        </button>
      )}

      {/* Janela modal do menu de acessibilidade */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Menu de Acessibilidade EPA"
          className="w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <Accessibility className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">Acessibilidade</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Ajustes visuais e leitura
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Fechar menu de acessibilidade"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {/* Controle de Tamanho de Fonte */}
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/60">
              <span className="text-xs font-semibold block mb-1.5">Tamanho do Texto</span>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => setFontSizeOffset((prev) => Math.max(-2, prev - 1))}
                  disabled={fontSizeOffset <= -2}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Diminuir texto"
                >
                  <ZoomOut className="h-3.5 w-3.5" /> A-
                </button>
                <span className="text-xs font-mono px-2 text-slate-600 dark:text-slate-300">
                  {fontSizeOffset === 0
                    ? 'Padrão'
                    : `${fontSizeOffset > 0 ? '+' : ''}${fontSizeOffset * 10}%`}
                </span>
                <button
                  type="button"
                  onClick={() => setFontSizeOffset((prev) => Math.min(4, prev + 1))}
                  disabled={fontSizeOffset >= 4}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Aumentar texto"
                >
                  <ZoomIn className="h-3.5 w-3.5" /> A+
                </button>
              </div>
            </div>

            {/* Alternadores de visualização */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition ${
                  highContrast
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <Contrast className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Alto Contraste</span>
              </button>

              <button
                type="button"
                onClick={() => setInverted(!inverted)}
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition ${
                  inverted
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="h-4 w-4 shrink-0 text-amber-500" />
                <span>Inverter Cores</span>
              </button>

              <button
                type="button"
                onClick={() => setHighlightLinks(!highlightLinks)}
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition ${
                  highlightLinks
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <Underline className="h-4 w-4 shrink-0 text-blue-500" />
                <span>Destacar Links</span>
              </button>

              <button
                type="button"
                onClick={() => setReadableFont(!readableFont)}
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition ${
                  readableFont
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                }`}
              >
                <Type className="h-4 w-4 shrink-0 text-indigo-500" />
                <span>Fonte Legível</span>
              </button>
            </div>

            {/* Redefinir tudo */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Redefinir Ajustes
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
