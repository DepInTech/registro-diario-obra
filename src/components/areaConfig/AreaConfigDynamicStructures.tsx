// Estruturas DINÂMICAS da Configuração de Áreas — espelham as tabelas dinâmicas
// da Planilha de Campo real (FieldSpreadsheets.tsx):
// - Poços de remediação (linhas de extraction_data: poço, bomba, autopump)
// - Saídas do hidrômetro (infiltration_exits)
// - Quantidade de compressores (compressor_count)
// O Admin define aqui a estrutura por área; o Técnico recebe as linhas prontas
// (buildPresetPatch em src/lib/areaConfigPreset.ts) — tabela continua tabela,
// nunca é transformada em campo de texto simples.

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import type { PresetWellRow } from '@/lib/fieldSheetConfigMetadata'

function parseJsonArray(raw: unknown): unknown[] {
  let cur: unknown = raw
  if (typeof cur === 'string') {
    const t = cur.trim()
    if (!t) return []
    try {
      cur = JSON.parse(t)
    } catch {
      return []
    }
  }
  return Array.isArray(cur) ? cur : []
}

/** Quantidade de compressores configurada (padrão 4, limite 1..8) */
export function parseCompressorCount(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 4
  return Math.min(8, Math.max(1, Math.round(n)))
}

function parseWellRows(raw: unknown): PresetWellRow[] {
  return parseJsonArray(raw)
    .filter((r) => r && typeof r === 'object')
    .map((r) => {
      const o = r as Record<string, unknown>
      return {
        well: String(o.well ?? '').trim(),
        pump: String(o.pump ?? '').trim(),
        autopump: String(o.autopump ?? '').trim(),
      }
    })
}

function isRowEmpty(r: PresetWellRow): boolean {
  return r.well.trim() === '' && r.pump.trim() === '' && r.autopump.trim() === ''
}

const gridCols = 'grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr_40px]'

/** Tabela dinâmica de poços de remediação (extraction_data) na configuração da área */
export function WellsPresetTable({
  value,
  onChange,
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  const rows = parseWellRows(value)
  const emit = (next: PresetWellRow[]) => onChange(next.filter((r) => !isRowEmpty(r)))
  const setCell = (i: number, col: keyof PresetWellRow, v: string) => {
    emit(rows.map((r, idx) => (idx === i ? { ...r, [col]: v } : r)))
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
            Poços de remediação desta área
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Mesma estrutura da tabela “Extração/Volume Bombeado”: cada linha vira uma linha da
            planilha do Técnico. Poço/bomba/autopump preenchidos ficam travados em campo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => emit([...rows, { well: '', pump: '', autopump: '' }])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar poço
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-400 dark:border-slate-600">
          Nenhum poço definido: o Técnico adicionará os poços livremente nesta área.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_40px]">
            <span className="epa-label">Poço</span>
            <span className="epa-label">Bomba</span>
            <span className="epa-label">Saída Autopump</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className={gridCols}>
              <Input
                className="min-h-[38px] text-sm"
                placeholder="Ex.: PR-49"
                value={row.well}
                onChange={(e) => setCell(i, 'well', e.target.value)}
              />
              <Input
                className="min-h-[38px] text-sm"
                placeholder="Ex.: Bomba 01"
                value={row.pump}
                onChange={(e) => setCell(i, 'pump', e.target.value)}
              />
              <Input
                className="min-h-[38px] text-sm"
                placeholder="Ex.: A-01"
                value={row.autopump}
                onChange={(e) => setCell(i, 'autopump', e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Remover poço"
                onClick={() => emit(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">{rows.length} poço(s) definido(s)</p>
    </div>
  )
}

/** Lista dinâmica de saídas do hidrômetro (infiltration_exits) na configuração da área */
export function ExitsPresetTable({
  value,
  onChange,
}: {
  value: unknown
  onChange: (v: unknown) => void
}) {
  const rows = parseJsonArray(value).map((v) => String(v ?? '').trim())
  const emit = (next: string[]) => onChange(next.filter((v) => v !== ''))
  const setCell = (i: number, v: string) => emit(rows.map((r, idx) => (idx === i ? v : r)))

  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
            Saídas (hidrômetro geral e saídas)
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Nome das saídas de infiltração desta área. Deixe em branco para o Técnico definir em
            campo.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => emit([...rows, ''])}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Adicionar saída
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-3 text-center text-[11px] text-slate-400 dark:border-slate-600">
          Nenhuma saída definida: o Técnico cadastrará as saídas livremente nesta área.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="min-h-[38px] text-sm"
                placeholder="Ex.: Saída 01"
                value={row}
                onChange={(e) => setCell(i, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Remover saída"
                onClick={() => emit(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">{rows.length} saída(s) definida(s)</p>
    </div>
  )
}

/** Controle da quantidade de compressores (tabela dinâmica da seção Compressores) */
export function CompressorCountControl({
  value,
  onCountChange,
}: {
  value: unknown
  onCountChange: (n: number) => void
}) {
  const count = parseCompressorCount(value)
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
      <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
        Compressores
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-7 px-0"
        disabled={count <= 1}
        onClick={() => onCountChange(count - 1)}
      >
        −
      </Button>
      <span className="w-6 text-center text-sm font-bold text-slate-800 dark:text-slate-100">
        {count}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 w-7 px-0"
        disabled={count >= 8}
        onClick={() => onCountChange(count + 1)}
      >
        +
      </Button>
    </div>
  )
}
