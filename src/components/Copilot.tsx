import { FormEvent, useState } from 'react'
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react'
import { askEpaCopilot } from '@/services/workspace'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

export function Copilot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Olá, sou o EPA Copilot. Posso resumir RDOs, analisar extrações e sinalizar desvios de resíduos.',
    },
  ])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const value = input.trim()
    if (!value || busy) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: value }])
    setBusy(true)
    try {
      const result = await askEpaCopilot(value, conversationId)
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
    setInput(value)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-20 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-emerald-700 px-4 text-white shadow-xl shadow-emerald-900/20 transition hover:-translate-y-1 hover:bg-emerald-800 lg:bottom-7 lg:right-7',
          open && 'pointer-events-none opacity-0',
        )}
      >
        <Sparkles className="h-5 w-5" />
        <span className="hidden text-sm font-semibold sm:inline">EPA Copilot</span>
      </button>
      {open && (
        <div className="fixed bottom-20 right-3 z-50 flex h-[min(620px,75vh)] w-[calc(100vw-24px)] max-w-[390px] flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-2xl lg:bottom-7 lg:right-7">
          <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-800 to-teal-700 px-4 py-4 text-white">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">EPA Copilot</p>
              <p className="text-xs text-emerald-100">Assistente técnico · dados protegidos</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'ml-auto rounded-br-md bg-emerald-700 text-white'
                    : 'rounded-bl-md border bg-white text-slate-700 shadow-sm',
                )}
              >
                {message.content}
              </div>
            ))}
            {busy && (
              <div className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border bg-white px-3.5 py-2.5 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando dados...
              </div>
            )}
          </div>
          {messages.length < 3 && (
            <div className="flex gap-2 overflow-x-auto border-t px-3 py-2 text-xs">
              <button
                onClick={() => quick('Resuma os últimos RDOs do projeto de Açailândia')}
                className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800"
              >
                Resumir RDOs
              </button>
              <button
                onClick={() => quick('Há anomalias nos resíduos líquidos?')}
                className="whitespace-nowrap rounded-full bg-amber-50 px-3 py-1.5 text-amber-800"
              >
                Analisar resíduos
              </button>
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2 border-t bg-white p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre uma obra..."
              className="border-slate-200"
            />
            <Button
              size="icon"
              disabled={busy || !input.trim()}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  )
}
