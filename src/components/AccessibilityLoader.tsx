import { useEffect, useState, useRef } from 'react'
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

// URL exata do CDN solicitada pelo usuário (mantida rigorosamente)
const CDN_URL =
  'https://cdn.jsdelivr.net/gh/PrabothCharith/accessibility-plugin@main/accessibility-menu.min.js'

// Seletores comuns usados pelo plugin externo para seu botão flutuante e container
const EXTERNAL_SELECTORS = [
  '#accessibility-menu',
  '.accessibility-menu',
  "[class*='accessibility-menu']",
  "[id*='accessibility-menu']",
  "[id*='accessibility-btn']",
  "[class*='accessibility-btn']",
  "[id*='accessibility-icon']",
  "[class*='accessibility-icon']",
  '#asw-menu',
  '.asw-menu',
  '#asw-widget',
  '.asw-widget',
  '.asw-btn',
  '#asw-btn',
]

function checkExternalPluginPresent(): boolean {
  if (typeof document === 'undefined') return false
  return EXTERNAL_SELECTORS.some((sel) => {
    try {
      const el = document.querySelector(sel)
      return el !== null
    } catch {
      return false
    }
  })
}

export function AccessibilityLoader() {
  const [cdnLoaded, setCdnLoaded] = useState(false)
  const [hasExternalMenu, setHasExternalMenu] = useState(false)
  const [useFallback, setUseFallback] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const observerRef = useRef<MutationObserver | null>(null)

  // Estados dos recursos de acessibilidade nativos do fallback
  const [fontSizeOffset, setFontSizeOffset] = useState<number>(0)
  const [highContrast, setHighContrast] = useState(false)
  const [inverted, setInverted] = useState(false)
  const [highlightLinks, setHighlightLinks] = useState(false)
  const [readableFont, setReadableFont] = useState(false)

  // 1. Tratamento global de erros para scripts externos / plugin de acessibilidade
  // Impede que eventuais erros de runtime não tratados do script do CDN derrubem a aplicação React
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const filename = event.filename || ''
      const message = (event.message || '').toLowerCase()

      const isA11yPluginError =
        filename.includes('accessibility') ||
        filename.includes('jsdelivr') ||
        filename.includes('PrabothCharith') ||
        message.includes('accessibility') ||
        message.includes('font-size') ||
        message.includes('contrast')

      if (isA11yPluginError) {
        console.warn(
          'Isolamento de erro no plugin de acessibilidade CDN:',
          event.error || event.message,
        )
        // Previne que a exceção propague para os manipuladores globais que quebram a interface
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonStr = String(event.reason || '').toLowerCase()
      if (
        reasonStr.includes('accessibility') ||
        reasonStr.includes('jsdelivr') ||
        reasonStr.includes('prbothcharith')
      ) {
        console.warn('Isolamento de rejeição no plugin de acessibilidade CDN:', event.reason)
        event.preventDefault()
      }
    }

    window.addEventListener('error', handleWindowError, true)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleWindowError, true)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // 2. Observa o DOM para detectar se o script do CDN inseriu a UI no documento
  useEffect(() => {
    // Verificação inicial
    if (checkExternalPluginPresent()) {
      setHasExternalMenu(true)
      setCdnLoaded(true)
      setUseFallback(false)
      return
    }

    const observer = new MutationObserver(() => {
      if (checkExternalPluginPresent()) {
        setHasExternalMenu(true)
        setCdnLoaded(true)
        setUseFallback(false)
      }
    })

    observerRef.current = observer

    try {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
    } catch (e) {
      console.warn('MutationObserver não pôde ser iniciado em document.body:', e)
    }

    return () => {
      observer.disconnect()
      observerRef.current = null
    }
  }, [])

  // 3. Carregamento do script CDN original de forma segura e não bloqueante
  useEffect(() => {
    let isMounted = true

    // Verifica se o script já existe no documento
    const existingScript = document.querySelector(`script[src="${CDN_URL}"]`)
    if (existingScript) {
      // Script já adicionado anteriormente
      setTimeout(() => {
        if (!isMounted) return
        if (checkExternalPluginPresent()) {
          setCdnLoaded(true)
          setHasExternalMenu(true)
          setUseFallback(false)
        } else {
          setUseFallback(true)
        }
      }, 1000)
      return
    }

    // Criar tag de script com atributos seguros
    const script = document.createElement('script')
    script.src = CDN_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.setAttribute('data-purpose', 'epa-external-accessibility-plugin')

    // Timeout de segurança: se após 4s o script do CDN não tiver injetado sua UI, ativa o fallback nativo
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        if (!checkExternalPluginPresent()) {
          setUseFallback(true)
        }
      }
    }, 4000)

    script.onload = () => {
      if (!isMounted) return
      clearTimeout(timeoutId)
      // O plugin pode levar alguns milissegundos para inicializar e criar a UI
      const checkInterval = setInterval(() => {
        if (!isMounted) {
          clearInterval(checkInterval)
          return
        }
        if (checkExternalPluginPresent()) {
          setCdnLoaded(true)
          setHasExternalMenu(true)
          setUseFallback(false)
          clearInterval(checkInterval)
        }
      }, 200)

      setTimeout(() => {
        clearInterval(checkInterval)
        if (isMounted && !checkExternalPluginPresent()) {
          // CDN carregou o JS mas não injetou UI, ativa fallback para o usuário ter acessibilidade
          setUseFallback(true)
        }
      }, 3000)
    }

    script.onerror = () => {
      if (!isMounted) return
      clearTimeout(timeoutId)
      console.warn(
        'Script de acessibilidade CDN indisponível (offline/CSP/rede). Ativando fallback EPA nativo.',
      )
      setUseFallback(true)
    }

    // Adiciona o script ao document.body de forma assíncrona pós-ciclo de montagem
    const appendTimer = setTimeout(() => {
      try {
        if (isMounted && !document.querySelector(`script[src="${CDN_URL}"]`)) {
          document.body.appendChild(script)
        }
      } catch (e) {
        console.warn('Erro ao anexar script CDN de acessibilidade:', e)
        if (isMounted) setUseFallback(true)
      }
    }, 100)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
      clearTimeout(appendTimer)
    }
  }, [])

  // 4. Aplica estilos dinâmicos de acessibilidade apenas quando o fallback nativo EPA está ativado
  useEffect(() => {
    if (!useFallback || hasExternalMenu) return

    // Ajuste de tamanho de fonte no HTML
    const htmlEl = document.documentElement
    if (fontSizeOffset === 0) {
      htmlEl.style.fontSize = ''
    } else {
      htmlEl.style.fontSize = `${100 + fontSizeOffset * 10}%`
    }

    // Classes de acessibilidade aplicadas ao body
    const bodyCls = document.body.classList
    if (highContrast) {
      bodyCls.add('epa-a11y-high-contrast')
    } else {
      bodyCls.remove('epa-a11y-high-contrast')
    }

    if (inverted) {
      bodyCls.add('epa-a11y-inverted')
    } else {
      bodyCls.remove('epa-a11y-inverted')
    }

    if (highlightLinks) {
      bodyCls.add('epa-a11y-highlight-links')
    } else {
      bodyCls.remove('epa-a11y-highlight-links')
    }

    if (readableFont) {
      bodyCls.add('epa-a11y-readable-font')
    } else {
      bodyCls.remove('epa-a11y-readable-font')
    }
  }, [
    useFallback,
    hasExternalMenu,
    fontSizeOffset,
    highContrast,
    inverted,
    highlightLinks,
    readableFont,
  ])

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

  // Se o menu do CDN foi instanciado no DOM, NUNCA exibe o fallback nativo (evita sobreposição)
  if (hasExternalMenu || (cdnLoaded && !useFallback)) {
    return null
  }

  // Se o fallback ainda não foi autorizado (aguardando CDN tentar carregar), não renderiza nada ainda
  if (!useFallback) {
    return null
  }

  return (
    <aside
      id="epa-native-accessibility"
      aria-label="Ferramentas de acessibilidade"
      className="fixed z-[45] select-none bottom-20 right-4 lg:bottom-6 lg:right-6 print:hidden"
    >
      {/* Botão flutuante para abrir menu de acessibilidade nativo */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          type="button"
          aria-label="Abrir menu de acessibilidade"
          aria-expanded={false}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#086B63] text-white shadow-xl hover:bg-[#06544e] focus:outline-none focus:ring-2 focus:ring-[#086B63] focus:ring-offset-2 transition-transform active:scale-95 cursor-pointer"
          title="Opções de Acessibilidade"
        >
          {/* Universal Access Circle Icon (Accessibility do lucide-react) */}
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {/* Janela modal do menu de acessibilidade nativo */}
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
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
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
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
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
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
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
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition cursor-pointer ${
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
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition cursor-pointer ${
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
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition cursor-pointer ${
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
                className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border text-left transition cursor-pointer ${
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
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80 transition cursor-pointer"
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
