import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { askEpaCopilot } from '@/services/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StructuredMessage } from '@/components/StructuredMessage'
import { dataService } from '@/services/epa'
import type { Project } from '@/types/epa'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

const DEFAULT_WELCOME = `### 📋 Bem-vindo ao EPA Copilot
**Assistente Técnico & Gerencial** de acompanhamento de obras e relatórios do Grupo EPA.

Posso gerar a análise executiva completa dos projetos e RDOs com:
- **Visão Geral** e **Resumo Executivo**
- **Tabela de Indicadores Principais**
- **Detalhamento do Último RDO** e Atividades
- **Histórico dos Últimos RDOs**
- **Segurança, Interferências e Pendências**
- **Poços de Monitoramento**
- **Pontos de Atenção** (🟢 Normal, 🟡 Atenção, 🔴 Crítico)
- **Próximos Passos** e **Recomendações Técnicas**

*Selecione um projeto abaixo ou faça uma pergunta direta.*`

export function Copilot() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: DEFAULT_WELCOME,
    },
  ])

  const scrollRef = useRef<HTMLDivElement>(null)

  // Load accessible projects for contextual quick actions
  useEffect(() => {
    let active = true
    dataService
      .projects()
      .then((data) => {
        if (!active) return
        setProjects(data)
        if (data.length > 0) {
          setSelectedProjectId(data[0].id)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, busy])

  const submit = async (event?: FormEvent, forcedMessage?: string) => {
    event?.preventDefault()
    const value = (forcedMessage ?? input).trim()
    if (!value || busy) return
    if (!forcedMessage) setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: value }])
    setBusy(true)

    try {
      const selectedProject = projects.find((p) => p.id === selectedProjectId)
      const projectPrompt = selectedProject
        ? `[Projeto Ativo: ${selectedProject.name} (Código: ${selectedProject.epa_code})] ${value}`
        : value

      const result = await askEpaCopilot(projectPrompt, conversationId, selectedProjectId)
      setConversationId(result.conversation_id)
      setMessages((prev) => [...prev, { role: 'assistant', content: result.content }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            error instanceof Error ? error.message : 'Não foi possível processar sua solicitação.',
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  const quick = (value: string) => {
    submit(undefined, value)
  }

  const handleClear = () => {
    setMessages([{ role: 'assistant', content: DEFAULT_WELCOME }])
    setConversationId(null)
  }

  const activeProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-5 z-40 flex h-14 items-center gap-2.5 rounded-full bg-emerald-700 px-5 text-white shadow-xl shadow-emerald-900/25 transition hover:-translate-y-1 hover:bg-emerald-800 md:bottom-7 md:right-7',
          open && 'pointer-events-none opacity-0',
        )}
        aria-label="Abrir assistente EPA Copilot"
      >
        <Sparkles className="h-5 w-5 text-emerald-200" />
        <span className="hidden text-sm font-semibold sm:inline">EPA Copilot</span>
      </button>

      {open && (
        <div
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-emerald-900/15 bg-white shadow-2xl transition-all duration-200 dark:border-slate-800 dark:bg-slate-900',
            expanded
              ? 'bottom-4 right-4 h-[calc(100vh-32px)] w-[calc(100vw-32px)] max-w-4xl'
              : 'bottom-20 right-3 h-[min(680px,82vh)] w-[calc(100vw-24px)] max-w-[490px] md:bottom-7 md:right-7',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-emerald-800/20 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-emerald-100 shadow-inner">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tracking-tight">EPA Copilot</span>
                  <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-200 uppercase">
                    Gerencial
                  </span>
                </div>
                <p className="text-xs text-emerald-100/90">Assistente de Acompanhamento de Obras</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                title="Limpar histórico"
                onClick={handleClear}
                className="h-8 w-8 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title={expanded ? 'Reduzir janela' : 'Expandir janela'}
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 text-white/80 hover:bg-white/15 hover:text-white"
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Fechar Copilot"
                onClick={() => setOpen(false)}
                className="h-8 w-8 text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Project Selector bar */}
          {projects.length > 0 && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
              <span className="font-medium text-slate-500 dark:text-slate-400">Projeto foco:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.epa_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Messages Body */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 dark:bg-slate-950/40"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'transition-all duration-200',
                  message.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-700 px-4 py-2.5 text-sm text-white shadow-sm'
                    : 'w-full rounded-2xl rounded-tl-sm border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900',
                )}
              >
                {message.role === 'user' ? (
                  <p className="leading-relaxed whitespace-pre-line">{message.content}</p>
                ) : (
                  <StructuredMessage content={message.content} />
                )}
              </div>
            ))}

            {busy && (
              <div className="flex w-fit items-center gap-3 rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Analisando RDOs, poços e indicadores do projeto...</span>
              </div>
            )}
          </div>

          {/* Quick Actions (aligned with user 21-rule spec) */}
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-slate-50/90 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/80">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                quick(
                  activeProject
                    ? `Apresente a visão executiva completa e situação atual do projeto ${activeProject.name}`
                    : 'Apresente a visão executiva completa e situação atual do projeto',
                )
              }
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              <Sparkles className="h-3 w-3" />
              Visão Executiva Completa
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                quick('Qual foi a última atividade realizada e detalhes do último RDO?')
              }
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-800 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              <FileText className="h-3 w-3" />
              Último RDO & Atividades
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                quick('Houve algum acidente de segurança ou interferência registrada?')
              }
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900"
            >
              <ShieldCheck className="h-3 w-3" />
              Segurança & Interferências
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                quick('Existem pendências e quais são os próximos passos recomendados?')
              }
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900"
            >
              <FileSpreadsheet className="h-3 w-3" />
              Pendências & Próximos Passos
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                quick('Quais são as informações registradas sobre poços e tamponamento?')
              }
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Poços & Tamponamento
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={submit}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre projetos, RDOs, poços, segurança..."
              disabled={busy}
              className="border-slate-200 text-sm focus-visible:ring-emerald-600 dark:border-slate-700 dark:bg-slate-800"
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              className="h-10 w-10 shrink-0 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
