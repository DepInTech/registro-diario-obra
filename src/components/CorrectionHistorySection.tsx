import React, { useState } from 'react'
import { ReturnCycle, ChangeDetail } from '@/types/epa'
import {
  History,
  ArrowRight,
  UserCheck,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CorrectionHistorySectionProps {
  changeHistory?: ReturnCycle[]
  cycles?: ReturnCycle[]
  currentStatus: string
  isAdmin?: boolean
  documentType?: 'field_sheet' | 'rdo'
}

export const CorrectionHistorySection: React.FC<CorrectionHistorySectionProps> = ({
  changeHistory,
  cycles,
  currentStatus,
  isAdmin = false,
  documentType = 'field_sheet',
}) => {
  const activeHistory = cycles || changeHistory
  const [expandedCycles, setExpandedCycles] = useState<Record<string, boolean>>({})

  if (!activeHistory || activeHistory.length === 0) {
    return null
  }

  const toggleCycle = (id: string) => {
    setExpandedCycles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Ordena os ciclos do mais recente para o mais antigo
  const sortedCycles = [...activeHistory].reverse()

  return (
    <section className="epa-card p-6 border-l-4 border-l-amber-500 space-y-4">
      <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Histórico das Alterações após Devolução
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {activeHistory.length} ciclo{activeHistory.length > 1 ? 's' : ''}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Rastreamento de solicitações de correção do Administrador e alterações realizadas pelo
              Técnico
            </p>
          </div>
        </div>

        {currentStatus === 'submitted' && isAdmin && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <CheckCircle2 className="h-4 w-4" />
            Reenviado para sua análise
          </span>
        )}
      </div>

      <div className="space-y-4">
        {sortedCycles.map((cycle, cycleIndex) => {
          const cycleNumber = activeHistory.length - cycleIndex
          const isLatest = cycleIndex === 0
          // Por padrão expande o ciclo mais recente
          const isExpanded =
            expandedCycles[cycle.id] !== undefined ? expandedCycles[cycle.id] : isLatest

          const formattedReturnDate = cycle.returnedAt
            ? new Date(cycle.returnedAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Data não informada'

          const formattedCorrectedDate =
            cycle.correctedAt || cycle.submittedAt
              ? new Date(cycle.correctedAt || cycle.submittedAt!).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null

          const changesCount = cycle.changes?.length || 0

          return (
            <div
              key={cycle.id || cycleIndex}
              className={cn(
                'rounded-xl border transition-all duration-200 overflow-hidden',
                isLatest
                  ? 'border-amber-300/80 bg-amber-50/30 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40',
              )}
            >
              {/* Header do Ciclo (Clicável para recolher/expandir) */}
              <div
                onClick={() => toggleCycle(cycle.id)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/40 select-none border-b border-transparent data-[expanded=true]:border-slate-200 dark:data-[expanded=true]:border-slate-800"
                data-expanded={isExpanded}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-xs shadow-sm">
                    {cycleNumber}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Ciclo de Correção #{cycleNumber}
                      </span>
                      {isLatest && (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          MAIS RECENTE
                        </span>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {changesCount} alteraç{changesCount === 1 ? 'ão' : 'ões'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        Devolvido em {formattedReturnDate}
                      </span>
                      {cycle.returnedByName && (
                        <span>
                          · por <b>{cycle.returnedByName}</b>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">
                    {isExpanded ? (
                      <>
                        Ocultar detalhes <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Ver alterações <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Corpo do Ciclo */}
              {isExpanded && (
                <div className="p-4 sm:p-5 space-y-4 text-xs">
                  {/* Devolução para correção (Admin) */}
                  <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 dark:border-amber-800 dark:bg-amber-950/40 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                      <span className="flex items-center gap-1.5 text-xs">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        Devolução para correção
                      </span>
                      <span className="text-[11px] font-normal text-amber-800 dark:text-amber-300">
                        {cycle.returnedByName ? `Devolvido por: ${cycle.returnedByName}` : ''} (
                        {formattedReturnDate})
                      </span>
                    </div>

                    <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded border border-amber-200/80 dark:border-amber-900 text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                      {cycle.returnReason || 'Ajustes solicitados.'}
                    </div>

                    {/* Campos solicitados para alteração */}
                    {cycle.requestedFields && cycle.requestedFields.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 block mb-1">
                          Campos solicitados para alteração:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cycle.requestedFields.map((fieldId, idx) => {
                            const label = cycle.requestedFieldsLabels?.[idx] || fieldId
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100"
                              >
                                🟨 {label}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Alterações realizadas pelo Técnico */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-1.5 dark:border-slate-800">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide text-[11px]">
                        Alterações realizadas pelo Técnico ({changesCount})
                      </h4>
                      {cycle.correctedByName && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>
                            Corrigido por: <b>{cycle.correctedByName}</b>
                            {formattedCorrectedDate && <> em {formattedCorrectedDate}</>}
                          </span>
                        </div>
                      )}
                    </div>

                    {changesCount === 0 ? (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center text-slate-500 dark:text-slate-400">
                        Nenhuma alteração registrada neste ciclo até o momento.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                        {cycle.changes.map((change, chIdx) => (
                          <div
                            key={chIdx}
                            className="p-3 sm:p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                                  {change.label || change.field}
                                </span>
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300 uppercase">
                                  Alterado
                                </span>
                              </div>

                              {/* Formato 0 → 1 e Comparação Antes vs Depois */}
                              <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                                <div className="rounded bg-rose-50 px-2.5 py-1 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1.5 max-w-full overflow-hidden text-ellipsis">
                                  <span className="font-semibold text-[10px] uppercase text-rose-500">
                                    Antes:
                                  </span>
                                  <span className="font-mono text-xs break-all">
                                    {change.previousValue}
                                  </span>
                                </div>

                                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />

                                <div className="rounded bg-emerald-50 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1.5 max-w-full overflow-hidden text-ellipsis font-semibold">
                                  <span className="font-semibold text-[10px] uppercase text-emerald-500">
                                    Novo:
                                  </span>
                                  <span className="font-mono text-xs break-all">
                                    {change.newValue}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {(change.changedByName || change.changedAt) && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 self-start md:self-center text-left md:text-right shrink-0">
                                {change.changedByName && (
                                  <div>
                                    Por: <b>{change.changedByName}</b>
                                  </div>
                                )}
                                {change.changedAt && (
                                  <div>
                                    {new Date(change.changedAt).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
