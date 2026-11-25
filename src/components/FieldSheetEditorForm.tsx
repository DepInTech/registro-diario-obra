// Estrutura ÚNICA da Planilha de Campo, compartilhada entre os dois ambientes.
//
// - mode="technician-fill": o Técnico preenche a planilha (comportamento padrão).
// - mode="admin-config": o Admin vê EXATAMENTE as mesmas seções/tabelas na
//   Configuração de Áreas; o que ele preencher vira preset da área
//   (persistido em area_configs.preset_fields pelo chamador).
//
// Seções idênticas a src/pages/FieldSpreadsheets.tsx (seções 0–8):
// Cabeçalho/Condições do dia · 1. Extração/Volume Bombeado (poços dinâmicos,
// hidrômetros manhã/tarde, altura da bomba, Saída Autopump) · 2. Infiltração/
// Volume Infiltrado (hidrômetro geral, saídas dinâmicas, horários, pressões) ·
// 3. Dosagem de Nutrientes (MAP/Ureia) · 4. Compressores (parâmetros + Linha de
// Ar) · 5. Remoção de Óleo (SAO 01/02) · 6. Resíduos Sólidos e Líquidos ·
// 7. Controles Ambientais e 5S · 8. Observações e Manutenções.
//
// Componente 100% controlado: nenhuma lógica de sincronização, fila, IndexedDB,
// client_token ou retorno de ciclo vive aqui.

import { Plus, Trash2 } from 'lucide-react'
import type { PresetFields } from '@/lib/fieldSheetConfigMetadata'
import { isPresetValueFilled } from '@/lib/areaConfigPreset'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { logoEpa } from '@/components/EpaLogo'
import { applyDateMask } from '@/lib/dateMask'
import { cn } from '@/lib/utils'

export interface FieldSheetExtractionRow {
  well: string
  morning: string
  afternoon: string
  pump: string
  autopump: string
}

export interface FieldSheetFormState {
  weather: string
  pluviometer: string
  morning_time: string
  afternoon_time: string
  extraction_data: FieldSheetExtractionRow[]
  infiltration_morning_time: string
  infiltration_afternoon_time: string
  infiltration_data: Record<string, string>
  nutrient_done: boolean
  nutrient_map_kg: string
  nutrient_ureia_kg: string
  compressor_count: number
  compressor_data: Record<string, string>
  oil_removal_data: {
    sao1Volume: string
    sao1DataLimpeza: string
    sao2Volume: string
    sao2DataLimpeza: string
  }
  waste_liquid_qty: string
  waste_solid_qty: string
  env_5s_check: boolean
  env_checklist_monthly: boolean
  observations: string
}

export type FieldSheetFormMode = 'technician-fill' | 'admin-config'

interface FieldSheetEditorFormProps {
  mode: FieldSheetFormMode
  value: FieldSheetFormState
  onChange: (next: FieldSheetFormState) => void
  disabled?: boolean
}

export function emptyFieldSheetFormState(): FieldSheetFormState {
  return {
    weather: '',
    pluviometer: '',
    morning_time: '',
    afternoon_time: '',
    extraction_data: [],
    infiltration_morning_time: '',
    infiltration_afternoon_time: '',
    infiltration_data: {},
    nutrient_done: false,
    nutrient_map_kg: '',
    nutrient_ureia_kg: '',
    compressor_count: 0,
    compressor_data: {},
    oil_removal_data: {
      sao1Volume: '',
      sao1DataLimpeza: '',
      sao2Volume: '',
      sao2DataLimpeza: '',
    },
    waste_liquid_qty: '',
    waste_solid_qty: '',
    env_5s_check: false,
    env_checklist_monthly: false,
    observations: '',
  }
}

const WEATHER_CHOICES = ['Ensolarado', 'Chuvoso', 'Instável']
const AUTOPEMP_CHOICES = ['Limpa', 'Turva', 'Oleosa']

// ---------------------------------------------------------------------------
// Mapeamento preset_fields <-> estado do formulário
// (mesma convenção de chaves de src/lib/areaConfigPreset.ts)
// ---------------------------------------------------------------------------

const SIMPLE_PRESET_MAP: Record<string, keyof FieldSheetFormState> = {
  'header.weather': 'weather',
  'header.pluviometer': 'pluviometer',
  'extraction.morning_time': 'morning_time',
  'extraction.afternoon_time': 'afternoon_time',
  'infiltration.infiltration_morning_time': 'infiltration_morning_time',
  'infiltration.infiltration_afternoon_time': 'infiltration_afternoon_time',
  'nutrients.nutrient_map_kg': 'nutrient_map_kg',
  'nutrients.nutrient_ureia_kg': 'nutrient_ureia_kg',
  'waste.waste_liquid_qty': 'waste_liquid_qty',
  'waste.waste_solid_qty': 'waste_solid_qty',
  'observations.observations': 'observations',
}

const BOOLEAN_PRESET_MAP: Record<string, keyof FieldSheetFormState> = {
  'nutrients.nutrient_done': 'nutrient_done',
  'env.env_5s_check': 'env_5s_check',
  'env.env_checklist_monthly': 'env_checklist_monthly',
}

const JSON_SUB_PRESET_MAP: Record<string, [keyof FieldSheetFormState, string]> = {
  'infiltration.geralMorning': ['infiltration_data', 'geralMorning'],
  'infiltration.geralAfternoon': ['infiltration_data', 'geralAfternoon'],
  'infiltration.bombaInfiltracao': ['infiltration_data', 'bombaInfiltracao'],
  'infiltration.bombaGeral': ['infiltration_data', 'bombaGeral'],
  'oil_removal.sao1Volume': ['oil_removal_data', 'sao1Volume'],
  'oil_removal.sao1DataLimpeza': ['oil_removal_data', 'sao1DataLimpeza'],
  'oil_removal.sao2Volume': ['oil_removal_data', 'sao2Volume'],
  'oil_removal.sao2DataLimpeza': ['oil_removal_data', 'sao2DataLimpeza'],
}

// ---------------------------------------------------------------------------
// Listas dinâmicas — formato de serialização estável em preset_fields:
//
// - wells: array de objetos [{ well, morning, afternoon, pump, autopump }, ...]
//   (uma entrada por linha da tabela 1. Extração; linhas parciais/vazias são
//   mantidas para preservar a contagem configurada pelo Admin).
// - infiltration_exits: array de objetos [{ exit: N, morning, afternoon }, ...]
//   (uma entrada por saída dinâmica outN* da tabela 2. Infiltração; o par
//   fixo geralMorning/geralAfternoon continua nos campos simples infiltration.*).
//
// Na LEITURA também aceita JSON em string (legado/robustez: PocketBase pode
// devolver o campo JSON como string dependendo do cliente).
// ---------------------------------------------------------------------------

function parseJsonList(raw: unknown): Array<Record<string, unknown>> {
  let cur: unknown = raw
  if (typeof cur === 'string') {
    const trimmed = cur.trim()
    if (!trimmed) return []
    try {
      cur = JSON.parse(trimmed)
    } catch {
      return []
    }
  }
  if (!Array.isArray(cur)) return []
  return cur.filter(
    (item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item),
  )
}

/** Extrai o estado do formulário a partir de um preset_fields salvo */
export function presetFieldsToFormState(
  preset: PresetFields | null | undefined,
): FieldSheetFormState {
  const state = emptyFieldSheetFormState()
  if (!preset || typeof preset !== 'object') return state
  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
  for (const [pk, target] of Object.entries(SIMPLE_PRESET_MAP)) {
    const val = preset[pk]
    if (isPresetValueFilled(val)) (state as any)[target] = str(val)
  }
  for (const [pk, target] of Object.entries(BOOLEAN_PRESET_MAP)) {
    const val = preset[pk]
    if (val === true) (state as any)[target] = true
  }
  for (const [pk, [objName, subKey]] of Object.entries(JSON_SUB_PRESET_MAP)) {
    const val = preset[pk]
    if (isPresetValueFilled(val)) {
      const obj = (state as any)[objName] || {}
      ;(state as any)[objName] = { ...obj, [subKey]: str(val) }
    }
  }
  // Compressores: compressor_data.<prefixo><1..4>
  const count = inferCompressorCount(
    preset.compressor_data as Record<string, unknown> | undefined,
    Number(preset.compressor_count) || 0,
  )
  if (count > 0) {
    state.compressor_count = count
    const obj = (state as any).compressor_data || {}
    for (const prefix of [
      'horimetro',
      'pressao',
      'drenagem',
      'tempoDesligado',
      'filtroAr',
      'nivelOleo',
      'trocaOleo',
      'linhaAr',
    ]) {
      for (let i = 1; i <= state.compressor_count; i++) {
        const val = preset[`compressors.compressor_data.${prefix}${i}`]
        if (isPresetValueFilled(val)) obj[`${prefix}${i}`] = str(val)
      }
    }
    ;(state as any).compressor_data = obj
  }
  // Poços de remediação (tabela 1. Extração): wells = [{ well, morning,
  // afternoon, pump, autopump }, ...] — TODAS as colunas configuradas pelo Admin.
  const wells = parseJsonList(preset.wells)
  if (wells.length > 0) {
    state.extraction_data = wells.map((w) => ({
      well: str(w.well),
      morning: str(w.morning),
      afternoon: str(w.afternoon),
      pump: str(w.pump),
      autopump: str(w.autopump),
    }))
  }
  // Saídas dinâmicas de infiltração (tabela 2): infiltration_exits =
  // [{ exit, morning, afternoon }, ...] -> out<N>Morning / out<N>Afternoon.
  for (const exit of parseJsonList(preset.infiltration_exits)) {
    const num = Number(exit.exit)
    if (!Number.isInteger(num) || num < 1) continue
    if (isPresetValueFilled(exit.morning))
      state.infiltration_data[`out${num}Morning`] = str(exit.morning)
    if (isPresetValueFilled(exit.afternoon))
      state.infiltration_data[`out${num}Afternoon`] = str(exit.afternoon)
  }
  return state
}

/** Inferência do número de compressores a partir dos índices efetivamente
 * preenchidos em compressor_data (a UI mostra a coluna do compressor 01 mesmo
 * com compressor_count = 0 — sem inferência, o Admin que preenche só o
 * compressor 01 perderia os valores na serialização). */
function inferCompressorCount(data: Record<string, unknown> | undefined, current: number): number {
  let maxIndex = 0
  let hasAny = false
  const prefixes = [
    'horimetro',
    'pressao',
    'drenagem',
    'tempoDesligado',
    'filtroAr',
    'nivelOleo',
    'trocaOleo',
    'linhaAr',
  ]
  for (const key of Object.keys(data || {})) {
    if (String(data?.[key] ?? '').trim() === '') continue
    for (const prefix of prefixes) {
      if (!key.startsWith(prefix)) continue
      const idx = Number(key.slice(prefix.length))
      if (Number.isInteger(idx) && idx >= 1) {
        hasAny = true
        maxIndex = Math.max(maxIndex, idx)
      }
    }
  }
  return Math.min(4, Math.max(current, hasAny ? maxIndex : 0, hasAny ? 1 : 0))
}

/** Converte o estado atual do formulário de volta para preset_fields (chaves vazias são descartadas) */
export function formStateToPresetFields(state: FieldSheetFormState): PresetFields {
  const preset: PresetFields = {}
  for (const [pk, target] of Object.entries(SIMPLE_PRESET_MAP)) {
    const v = String((state as any)[target] ?? '').trim()
    if (v !== '') preset[pk] = v
  }
  for (const [pk, target] of Object.entries(BOOLEAN_PRESET_MAP)) {
    if ((state as any)[target] === true) preset[pk] = true
  }
  for (const [pk, [objName, subKey]] of Object.entries(JSON_SUB_PRESET_MAP)) {
    const obj = (state as any)[objName]
    const v = obj && typeof obj === 'object' ? String((obj as any)[subKey] ?? '').trim() : ''
    if (v !== '') preset[pk] = v
  }
  const obj = state.compressor_data || {}
  const count = inferCompressorCount(obj, state.compressor_count)
  if (count > 0) {
    preset.compressor_count = count
    for (const prefix of [
      'horimetro',
      'pressao',
      'drenagem',
      'tempoDesligado',
      'filtroAr',
      'nivelOleo',
      'trocaOleo',
      'linhaAr',
    ]) {
      for (let i = 1; i <= count; i++) {
        const v = String(obj[`${prefix}${i}`] ?? '').trim()
        if (v !== '') preset[`compressors.compressor_data.${prefix}${i}`] = v
      }
    }
  }
  // Poços de remediação: uma entrada por linha (linhas totalmente vazias são
  // descartadas — não representam configuração).
  const wells = (state.extraction_data || []).filter((row) =>
    Object.values(row).some((v) => String(v ?? '').trim() !== ''),
  )
  if (wells.length > 0) {
    preset.wells = wells.map((row) => ({
      well: String(row.well ?? '').trim(),
      morning: String(row.morning ?? '').trim(),
      afternoon: String(row.afternoon ?? '').trim(),
      pump: String(row.pump ?? '').trim(),
      autopump: String(row.autopump ?? '').trim(),
    }))
  }
  // Saídas dinâmicas de infiltração: out<N>Morning/out<N>Afternoon agrupados
  // por saída [{ exit, morning, afternoon }, ...] (par fixo Geral fica fora).
  const exitNums = new Set<number>()
  for (const key of Object.keys(state.infiltration_data || {})) {
    const m = /^out(\d+)(Morning|Afternoon)$/.exec(key)
    if (m) exitNums.add(Number(m[1]))
  }
  const exits = Array.from(exitNums)
    .sort((a, b) => a - b)
    .map((num) => {
      const m = String(state.infiltration_data[`out${num}Morning`] ?? '').trim()
      const a = String(state.infiltration_data[`out${num}Afternoon`] ?? '').trim()
      return { exit: num, morning: m, afternoon: a }
    })
    .filter((e) => e.morning !== '' || e.afternoon !== '')
  if (exits.length > 0) preset.infiltration_exits = exits
  return preset
}

// Mesmas linhas de parâmetros da tabela de Compressores da Planilha de Campo
const COMPRESSOR_ROWS: ReadonlyArray<{
  label: string
  prefix: string
  ph: string
  fallback?: string
}> = [
  { label: 'Horímetro (hr)', prefix: 'horimetro', ph: 'Ex.: 5448.81' },
  { label: 'Pressão (bar)', prefix: 'pressao', ph: 'Ex.: 6 bar', fallback: 'pressure' },
  { label: 'Drenagem de água (mL)', prefix: 'drenagem', ph: 'Ex.: 6 LTS' },
  { label: 'Tempo Desligado', prefix: 'tempoDesligado', ph: 'Ex.: 0 min' },
  { label: 'Troca do filtro de ar', prefix: 'filtroAr', ph: 'Ex.: OK / data' },
  { label: 'Nível de óleo', prefix: 'nivelOleo', ph: 'Ex.: OK' },
  { label: 'Troca de óleo e filtro (a cada 1000hrs)', prefix: 'trocaOleo', ph: 'Ex.: 6000HR' },
]

export default function FieldSheetEditorForm({
  mode,
  value,
  onChange,
  disabled,
}: FieldSheetEditorFormProps) {
  const isAdminConfig = mode === 'admin-config'
  const set = (partial: Partial<FieldSheetFormState>) => onChange({ ...value, ...partial })

  const setExtractionRow = (index: number, partial: Partial<FieldSheetExtractionRow>) => {
    const rows = [...(value.extraction_data || [])]
    rows[index] = { ...rows[index], ...partial }
    set({ extraction_data: rows })
  }
  const addExtractionWell = () =>
    set({
      extraction_data: [
        ...(value.extraction_data || []),
        { well: '', morning: '', afternoon: '', pump: '', autopump: '' },
      ],
    })
  const removeExtractionWell = (index: number) =>
    set({ extraction_data: (value.extraction_data || []).filter((_, i) => i !== index) })

  const setInfiltration = (key: string, val: string) =>
    set({ infiltration_data: { ...(value.infiltration_data || {}), [key]: val } })
  const exitNumbers = Object.keys(value.infiltration_data || {})
    .map((k) => /^out(\d+)(Morning|Afternoon)$/.exec(k)?.[1])
    .filter((n): n is string => Boolean(n))
    .map((n) => Number(n))
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .sort((a, b) => a - b)
  const addInfiltrationExit = () => {
    const next = (exitNumbers[exitNumbers.length - 1] || 0) + 1
    setInfiltration(`out${next}Morning`, '')
    setInfiltration(`out${next}Afternoon`, '')
  }

  const compressorCount = Math.max(1, Math.min(4, value.compressor_count || 1))
  const compressorIndices = Array.from({ length: compressorCount }, (_, i) => i + 1)
  const addCompressor = () => set({ compressor_count: Math.min(4, compressorCount + 1) })
  const setCompressor = (key: string, val: string) =>
    set({ compressor_data: { ...(value.compressor_data || {}), [key]: val } })

  const setOil = (key: keyof FieldSheetFormState['oil_removal_data'], val: string) =>
    set({ oil_removal_data: { ...value.oil_removal_data, [key]: val } })

  const infiltrationRows: Array<{ label: string; mKey: string; aKey: string }> = [
    { label: 'Geral', mKey: 'geralMorning', aKey: 'geralAfternoon' },
    ...exitNumbers.map((num) => ({
      label: `Saída ${String(num).padStart(2, '0')}`,
      mKey: `out${num}Morning`,
      aKey: `out${num}Afternoon`,
    })),
  ]

  return (
    <div className="space-y-5">
      {isAdminConfig && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <b>Mesma estrutura da Planilha de Campo.</b> O que você preencher aqui vira o
          pré-preenchimento desta área — campos vazios continuam livres para o Técnico em campo.
        </div>
      )}

      {/* 0. CABEÇALHO E CONDIÇÕES DO DIA */}
      <section className="epa-card p-6 border-t-4 border-t-emerald-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logoEpa} alt="EPA" className="h-12 w-auto object-contain" />
          </div>
          <div className="text-left md:text-right">
            <h1 className="text-base md:text-lg font-extrabold tracking-wide text-slate-900 dark:text-white">
              Controle Operacional Diário de Remediação
            </h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="epa-label">CLIMA</label>
            {(() => {
              const rawWeather = value.weather ?? ''
              const isOtherText = rawWeather !== '' && !WEATHER_CHOICES.includes(rawWeather)
              if (isOtherText) {
                return (
                  <div className="mt-1 flex items-center gap-1.5">
                    <Input
                      type="text"
                      value={rawWeather}
                      onChange={(e) => set({ weather: e.target.value })}
                      disabled={disabled}
                      placeholder="Descreva a condição do clima..."
                      className="min-h-[42px] text-xs sm:text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => set({ weather: 'Ensolarado' })}
                      className="min-h-[42px] px-2.5 text-[11px] shrink-0"
                    >
                      Opções
                    </Button>
                  </div>
                )
              }
              return (
                <select
                  value={rawWeather}
                  onChange={(e) => set({ weather: e.target.value })}
                  disabled={disabled}
                  className="epa-input mt-1 min-h-[42px]"
                >
                  <option value="">Selecione...</option>
                  {WEATHER_CHOICES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
              )
            })()}
          </div>
          <div>
            <label className="epa-label">PLUVIÔMETRO (mm)</label>
            <Input
              type="text"
              value={value.pluviometer ?? ''}
              onChange={(e) => set({ pluviometer: e.target.value })}
              disabled={disabled}
              placeholder="Ex.: 0 ou 12.5"
              className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
            />
          </div>
        </div>
      </section>

      {/* 1. EXTRAÇÃO/VOLUME BOMBEADO */}
      <section className="epa-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              1. EXTRAÇÃO/VOLUME BOMBEADO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leituras dos poços de remediação, hidrômetros (manhã/tarde), altura da bomba e saídas
            </p>
          </div>
          {!disabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={addExtractionWell}
              className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[38px]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Poço (PR)
            </Button>
          )}
        </div>

        {(value.extraction_data || []).length === 0 && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <span>⚠</span>
            <div>
              <p className="font-bold">Nenhum poço inserido nesta planilha</p>
              <p className="mt-0.5">
                Utilize o botão "Adicionar Poço (PR)" acima para cadastrar os poços de remediação
                desta ficha.
              </p>
            </div>
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-400 sm:hidden">
          👉 Deslize horizontalmente para visualizar e preencher todas as colunas da tabela
        </p>

        <div className="mt-3 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-40">
                  Poço de Remediação
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[180px]">
                  <span>Hidrômetro (Manhã)</span>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={value.morning_time || ''}
                      onChange={(e) => set({ morning_time: e.target.value })}
                      disabled={disabled}
                      className="h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1"
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[180px]">
                  <span>Hidrômetro (Tarde)</span>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={value.afternoon_time || ''}
                      onChange={(e) => set({ afternoon_time: e.target.value })}
                      disabled={disabled}
                      className="h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1"
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-36">
                  Altura da bomba (m)
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[210px]">
                  <span>Saída Autopump (500mL)*</span>
                </th>
                {!disabled && (
                  <th className="p-2.5 border border-emerald-800 w-12 text-center"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {(value.extraction_data || []).map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      value={row.well}
                      onChange={(e) => setExtractionRow(index, { well: e.target.value })}
                      disabled={disabled}
                      placeholder="Ex.: PR-01"
                      className="h-10 font-semibold text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      inputMode="decimal"
                      value={row.morning}
                      onChange={(e) => setExtractionRow(index, { morning: e.target.value })}
                      disabled={disabled}
                      placeholder="0,00"
                      className="h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      inputMode="decimal"
                      value={row.afternoon}
                      onChange={(e) => setExtractionRow(index, { afternoon: e.target.value })}
                      disabled={disabled}
                      placeholder="0,00"
                      className="h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      inputMode="decimal"
                      value={row.pump}
                      onChange={(e) => setExtractionRow(index, { pump: e.target.value })}
                      disabled={disabled}
                      placeholder="0,00"
                      className="h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    {(() => {
                      const rawVal = row.autopump || ''
                      const isOtherText =
                        rawVal === 'Outros' || (rawVal !== '' && !AUTOPEMP_CHOICES.includes(rawVal))
                      if (isOtherText) {
                        const displayVal = rawVal === 'Outros' ? '' : rawVal
                        return (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="text"
                              value={displayVal}
                              onChange={(e) =>
                                setExtractionRow(index, { autopump: e.target.value })
                              }
                              disabled={disabled}
                              placeholder="Descreva a saída..."
                              className="h-10 text-xs sm:text-sm flex-1"
                            />
                            {!disabled && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setExtractionRow(index, { autopump: '' })}
                                className="h-10 px-2 text-[11px] shrink-0"
                                title="Voltar às opções de saída do autopump"
                              >
                                Opções
                              </Button>
                            )}
                          </div>
                        )
                      }
                      return (
                        <select
                          value={rawVal}
                          onChange={(e) => setExtractionRow(index, { autopump: e.target.value })}
                          disabled={disabled}
                          className="epa-input h-10 w-full text-xs sm:text-sm"
                        >
                          <option value="">Selecione...</option>
                          {AUTOPEMP_CHOICES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="Outros">Outros</option>
                        </select>
                      )
                    })()}
                  </td>
                  {!disabled && (
                    <td className="p-2 border border-slate-300 dark:border-slate-800 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeExtractionWell(index)}
                        className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                        aria-label={`Remover poço da linha ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. INFILTRAÇÃO/VOLUME INFILTRADO */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              2. INFILTRAÇÃO/VOLUME INFILTRADO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leitura de hidrômetros geral e saídas com horário de medição e pressões da bomba
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInfiltrationExit}
              className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[36px]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Saída
            </Button>
          )}
        </div>

        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  Hidrômetro
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  <div>Manhã</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={value.infiltration_morning_time || ''}
                      onChange={(e) => set({ infiltration_morning_time: e.target.value })}
                      disabled={disabled}
                      className="h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1"
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  <div>Tarde</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={value.infiltration_afternoon_time || ''}
                      onChange={(e) => set({ infiltration_afternoon_time: e.target.value })}
                      disabled={disabled}
                      className="h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {infiltrationRows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-300">
                    {row.label}
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      inputMode="decimal"
                      value={value.infiltration_data?.[row.mKey] || ''}
                      onChange={(e) => setInfiltration(row.mKey, e.target.value)}
                      disabled={disabled}
                      placeholder="0,00"
                      className="h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700"
                    />
                  </td>
                  <td className="p-2 border border-slate-300 dark:border-slate-800">
                    <Input
                      inputMode="decimal"
                      value={value.infiltration_data?.[row.aKey] || ''}
                      onChange={(e) => setInfiltration(row.aKey, e.target.value)}
                      disabled={disabled}
                      placeholder="0,00"
                      className="h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
          <div>
            <label className="epa-label">Pressão da Bomba (Infiltração)</label>
            <Input
              value={value.infiltration_data?.bombaInfiltracao || ''}
              onChange={(e) => setInfiltration('bombaInfiltracao', e.target.value)}
              disabled={disabled}
              placeholder="Ex.: 3 bar / PSI"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="epa-label">Pressão da Bomba - Geral</label>
            <Input
              value={value.infiltration_data?.bombaGeral || ''}
              onChange={(e) => setInfiltration('bombaGeral', e.target.value)}
              disabled={disabled}
              placeholder="Ex.: 4 bar / PSI"
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
      </section>

      {/* 3. DOSAGEM DE NUTRIENTES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            3. DOSAGEM DE NUTRIENTES
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Controle de realização da dosagem e pesagem de MAP e Ureia
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3.5">
            <div>
              <p className="text-xs font-semibold">Realizada (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {value.nutrient_done ? 'Sim (Realizada)' : 'Não'}
              </p>
            </div>
            <Switch
              checked={value.nutrient_done || false}
              onCheckedChange={(c) => set({ nutrient_done: c })}
              disabled={disabled}
            />
          </div>
          <div>
            <label className="epa-label">Quantidade MAP (Kg)</label>
            <Input
              type="text"
              value={value.nutrient_map_kg ?? ''}
              onChange={(e) => set({ nutrient_map_kg: e.target.value })}
              disabled={disabled}
              placeholder="Ex.: 10 ou 1.250,5"
              className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
            />
          </div>
          <div>
            <label className="epa-label">Quantidade Ureia (Kg)</label>
            <Input
              type="text"
              value={value.nutrient_ureia_kg ?? ''}
              onChange={(e) => set({ nutrient_ureia_kg: e.target.value })}
              disabled={disabled}
              placeholder="Ex.: 10 ou 1.250,5"
              className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
            />
          </div>
        </div>
      </section>

      {/* 4. COMPRESSORES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              4. COMPRESSORES
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Parâmetros operacionais dos compressores e pressão da linha de ar
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCompressor}
              disabled={compressorCount >= 4}
              className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[36px]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Compressor
            </Button>
          )}
        </div>

        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            style={{ minWidth: `${Math.max(500, 240 + compressorCount * 150)}px` }}
          >
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-60 min-w-[220px]">
                  PARÂMETROS
                </th>
                {compressorIndices.map((c) => (
                  <th
                    key={c}
                    className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[140px]"
                  >
                    COMPRESSOR {String(c).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {COMPRESSOR_ROWS.map((row) => (
                <tr key={row.prefix} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-300">
                    {row.label}
                  </td>
                  {compressorIndices.map((c) => {
                    const key = `${row.prefix}${c}`
                    const fallbackKey = row.fallback ? `${row.fallback}${c}` : null
                    const currentVal =
                      value.compressor_data?.[key] ||
                      (fallbackKey ? value.compressor_data?.[fallbackKey] : '') ||
                      ''
                    return (
                      <td
                        key={c}
                        className="p-2 border border-slate-300 dark:border-slate-800 min-w-[140px]"
                      >
                        <Input
                          inputMode="decimal"
                          value={currentVal}
                          onChange={(e) => setCompressor(key, e.target.value)}
                          disabled={disabled}
                          placeholder={row.ph}
                          className="h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Segunda tabela: LINHA DE AR (sincronizada automaticamente com compressores) */}
        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            style={{ minWidth: `${Math.max(500, 240 + compressorCount * 150)}px` }}
          >
            <thead>
              <tr className="bg-emerald-800 text-white dark:bg-emerald-900 text-[11px]">
                <th className="p-2.5 border border-emerald-700 font-semibold text-center w-60 min-w-[220px]">
                  LINHA DE AR
                </th>
                {compressorIndices.map((c) => (
                  <th
                    key={c}
                    className="p-2.5 border border-emerald-700 font-semibold text-center min-w-[140px]"
                  >
                    COMPRESSOR {String(c).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-300">
                  Pressão da Linha de Ar (ex.: PSI)
                </td>
                {compressorIndices.map((c) => {
                  const arKey = `linhaAr${c}`
                  return (
                    <td
                      key={c}
                      className="p-2 border border-slate-300 dark:border-slate-800 min-w-[140px]"
                    >
                      <Input
                        inputMode="decimal"
                        value={value.compressor_data?.[arKey] || ''}
                        onChange={(e) => setCompressor(arKey, e.target.value)}
                        disabled={disabled}
                        placeholder="Ex.: 85 PSI"
                        className="h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700"
                      />
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. REMOÇÃO DE ÓLEO */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            5. REMOÇÃO DE ÓLEO
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Caixas separadoras de água e óleo SAO 01 e SAO 02
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['sao1', 'sao2'] as const).map((sao) => (
            <div
              key={sao}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400 border-b pb-2 dark:border-slate-800">
                Caixa Separadora (SAO {sao === 'sao1' ? '01' : '02'})
              </h3>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="epa-label">Volume de óleo removido (mL)</label>
                  <Input
                    value={value.oil_removal_data?.[`${sao}Volume`] || ''}
                    onChange={(e) => setOil(`${sao}Volume`, e.target.value)}
                    disabled={disabled}
                    placeholder="Ex.: 0"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="epa-label">Data da última limpeza</label>
                  <Input
                    value={value.oil_removal_data?.[`${sao}DataLimpeza`] || ''}
                    onChange={(e) => setOil(`${sao}DataLimpeza`, applyDateMask(e.target.value))}
                    disabled={disabled}
                    placeholder="DD/MM/AAAA"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. RESÍDUOS SÓLIDOS E LÍQUIDOS */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            6. RESÍDUOS SÓLIDOS E LÍQUIDOS
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Contagem de tambores para retirada
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="epa-label">TAMBORES PARA RETIRADA (QNTD) - Líquido</label>
            <Input
              type="text"
              value={value.waste_liquid_qty ?? ''}
              onChange={(e) => set({ waste_liquid_qty: e.target.value })}
              disabled={disabled}
              placeholder="Ex.: 02 ou 2 tambores"
              className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
            />
          </div>
          <div>
            <label className="epa-label">TAMBORES PARA RETIRADA (QNTD) - Sólido</label>
            <Input
              type="text"
              value={value.waste_solid_qty ?? ''}
              onChange={(e) => set({ waste_solid_qty: e.target.value })}
              disabled={disabled}
              placeholder="Ex.: 01 ou 1 bombona"
              className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
            />
          </div>
        </div>
      </section>

      {/* 7. CONTROLES AMBIENTAIS E 5S */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            7. CONTROLES AMBIENTAIS E 5S
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Verificação do programa 5S e checklist mensal
          </p>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold">5S (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {value.env_5s_check ? 'Sim (Conforme)' : 'Não'}
              </p>
            </div>
            <Switch
              checked={value.env_5s_check || false}
              onCheckedChange={(c) => set({ env_5s_check: c })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold">CHECKLIST MENSAL (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {value.env_checklist_monthly ? 'Sim (Conforme)' : 'Não'}
              </p>
            </div>
            <Switch
              checked={value.env_checklist_monthly || false}
              onCheckedChange={(c) => set({ env_checklist_monthly: c })}
              disabled={disabled}
            />
          </div>
        </div>
      </section>

      {/* 8. OBSERVAÇÕES E MANUTENÇÕES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            8. OBSERVAÇÕES E MANUTENÇÕES
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Registro livre de ocorrências, serviços de manutenção e anotações operacionais
          </p>
        </div>
        <Textarea
          value={value.observations || ''}
          onChange={(e) => set({ observations: e.target.value })}
          disabled={disabled}
          placeholder="Ex.: * Foi realizado a manutenção do PR-49."
          className={cn('mt-4 min-h-[120px]')}
        />
      </section>
    </div>
  )
}
