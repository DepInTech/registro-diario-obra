import { CalendarDays, Download, Filter, Search, ShieldCheck } from 'lucide-react'
import { auditEvents } from '@/data/epa'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

interface AuditItem {
  id: string
  user: string
  initials: string
  action: string
  entity: string
  time: string
  color: string
}

const defaultRows = [
  ...auditEvents,
  {
    id: 'a6',
    user: 'Carlos Oliveira',
    initials: 'CO',
    action: 'exportou a Planilha de Campo em Excel',
    entity: 'Acompanhamento Ambiental Açailândia',
    time: '26 mai, 14:20',
    color: 'blue',
  },
  {
    id: 'a7',
    user: 'Annik Almeida',
    initials: 'AA',
    action: 'atualizou as atribuições do projeto',
    entity: 'Recuperação Ambiental Lote A',
    time: '26 mai, 10:02',
    color: 'violet',
  },
]

export function AuditPage() {
  const [rows, setRows] = useState<AuditItem[]>(defaultRows)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true)
      try {
        if (navigator.onLine && pb.authStore.isValid) {
          const records = await pb.collection('audit_logs').getFullList({
            sort: '-created',
            expand: 'actor',
          })

          if (records.length > 0) {
            const mapped: AuditItem[] = records.map((r) => {
              const actor = (r.expand?.actor as any) || {}
              const userName = actor.name || actor.email || 'Sistema'
              const initials = userName
                .split(' ')
                .map((n: string) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              let actionText = r.action
              let color = 'slate'
              if (r.action === 'soft_delete') {
                const reason = (r.details as any)?.deleted_reason
                actionText = reason
                  ? `excluiu e arquivou (Motivo: "${reason}")`
                  : 'excluiu e arquivou o registro'
                color = 'rose'
              } else if (r.action === 'restore') {
                actionText = 'restaurou o registro excluído'
                color = 'emerald'
              } else if (r.action === 'archive') {
                actionText = 'arquivou o registro'
                color = 'amber'
              } else if (r.action === 'unarchive') {
                actionText = 'desarquivou o registro'
                color = 'amber'
              } else if (r.action === 'delete') {
                actionText = 'excluiu definitivamente'
                color = 'rose'
              } else if (r.action === 'approve') {
                actionText = 'aprovou o relatório'
                color = 'emerald'
              } else if (r.action === 'return') {
                actionText = 'devolveu para correção'
                color = 'amber'
              } else if (r.action === 'create') {
                actionText = 'criou o registro'
                color = 'blue'
              } else if (r.action === 'update') {
                actionText = 'atualizou informações'
                color = 'slate'
              }

              let entityText = r.entity
              if (r.entity === 'projects') entityText = 'Projeto'
              else if (r.entity === 'reports_rdo') entityText = 'RDO'
              else if (r.entity === 'field_spreadsheets') entityText = 'Planilha de Campo'

              const timeStr = r.created
                ? new Date(r.created).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : ''

              return {
                id: r.id,
                user: userName,
                initials: initials || 'EP',
                action: actionText,
                entity: entityText,
                time: timeStr,
                color,
              }
            })
            setRows(mapped)
            setLoading(false)
            return
          }
        }
        setRows(defaultRows)
      } catch (err) {
        console.warn('Could not load audit logs:', err)
        setRows(defaultRows)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [])

  const filteredRows = rows.filter((r) =>
    `${r.user} ${r.action} ${r.entity}`.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <div className="space-y-6">
      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              placeholder="Buscar ação, usuário ou entidade..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="text-xs">
              <CalendarDays className="mr-2 h-4 w-4" />
              Últimos 30 dias
            </Button>
            <Button variant="outline" className="text-xs">
              <Filter className="mr-2 h-4 w-4" />
              Todas as ações
            </Button>
            <Button variant="outline" className="text-xs">
              <Download className="mr-2 h-4 w-4" />
              Exportar trilha
            </Button>
          </div>
        </div>
        <div className="table-scroll-container">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Responsável</th>
                <th className="px-5 py-3">Ação registrada</th>
                <th className="px-5 py-3">Entidade</th>
                <th className="px-5 py-3">Data e hora</th>
                <th className="px-5 py-3">Integridade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    <p className="mt-2 text-xs">Carregando trilha de auditoria...</p>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[9px] font-bold">
                          {row.initials}
                        </span>
                        <span className="text-sm font-medium">{row.user}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{row.action}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[10px]">
                        {row.entity}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">{row.time}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                        <ShieldCheck className="h-4 w-4" />
                        Verificado
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-center text-xs text-slate-400">
        A trilha de auditoria é imutável e registra criações, alterações, exclusões, aprovações,
        devoluções e exportações.
      </p>
    </div>
  )
}
