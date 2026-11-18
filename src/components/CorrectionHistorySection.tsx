import React from 'react'
import { ReturnCycle } from '@/types/epa'
import { History, UserCheck } from 'lucide-react'

interface CorrectionHistorySectionProps {
  changeHistory?: ReturnCycle[]
  cycles?: ReturnCycle[]
  currentStatus: string
  isAdmin?: boolean
  documentType?: 'field_sheet' | 'rdo'
}

// FUNCIONALIDADE C — Histórico simplificado (apenas apresentação; nada é apagado do banco).
//
// VISÃO ADMIN: apenas, por correção do técnico, uma linha com:
//   campo alterado (rótulo legível) · valor anterior · valor novo · técnico · data e hora.
// Nada de eventos internos, snapshots, IDs técnicos ou logs de sincronização.
//
// VISÃO TÉCNICO: o componente não é renderizado (as páginas só o exibem para isAdmin).
// O técnico vê apenas o banner de correção: campos solicitados, justificativa do admin
// (reviewNotes) e o status da planilha.
export const CorrectionHistorySection: React.FC<CorrectionHistorySectionProps> = ({
  changeHistory,
  cycles,
}) => {
  const activeHistory = cycles || changeHistory

  if (!activeHistory || activeHistory.length === 0) {
    return null
  }

  // Achatas os ciclos em uma lista simples de correções (mais recente primeiro)
  type FlatChange = {
    key: string
    label: string
    previousValue: string
    newValue: string
    changedByName: string
    changedAt: string
  }

  const rows: FlatChange[] = []
  const historyNewestFirst = [...activeHistory].reverse()
  historyNewestFirst.forEach((cycle, cycleIdx) => {
    const changes = cycle.changes || []
    // Dentro do ciclo, a ordem original é cronológica; exibe da mais recente para a mais antiga
    ;[...changes].reverse().forEach((change, chIdx) => {
      rows.push({
        key: `${cycle.id || cycleIdx}-${chIdx}`,
        label: change.label || change.field,
        previousValue: change.previousValue ?? '—',
        newValue: change.newValue ?? '—',
        changedByName: change.changedByName || '—',
        changedAt: change.changedAt || '',
      })
    })
  })

  if (rows.length === 0) {
    return null
  }

  const formatDateTime = (iso: string) =>
    iso
      ? new Date(iso).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  return (
    <section className="epa-card p-6 border-l-4 border-l-amber-500 space-y-4">
      <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Correções do Técnico
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Campos alterados após devolução, com valor anterior e novo
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2.5 font-semibold">Campo</th>
              <th className="px-3 py-2.5 font-semibold">Valor anterior</th>
              <th className="px-3 py-2.5 font-semibold">Valor novo</th>
              <th className="px-3 py-2.5 font-semibold">Técnico</th>
              <th className="px-3 py-2.5 font-semibold">Data e hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                <td className="px-3 py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {row.label}
                </td>
                <td className="px-3 py-3 text-slate-600 dark:text-slate-300 break-all max-w-[220px]">
                  {row.previousValue}
                </td>
                <td className="px-3 py-3 font-semibold text-emerald-800 dark:text-emerald-300 break-all max-w-[220px]">
                  {row.newValue}
                </td>
                <td className="px-3 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                    {row.changedByName}
                  </span>
                </td>
                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {formatDateTime(row.changedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
