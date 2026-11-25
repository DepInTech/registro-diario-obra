// PARTE 1 — Configuração de Áreas da Planilha de Campo (cenário de 1 área).
//
// Quando o Técnico seleciona UMA área, este módulo busca a configuração
// correspondente em `area_configs` (por area_name, active = true) e aplica os
// valores pré-preenchidos pelo Admin nos campos reais do formulário, usando o
// mesmo mapeamento de chaves de src/lib/fieldSheetConfigMetadata.ts (as chaves
// lá espelham exatamente as colunas/sub-chaves usadas em FieldSpreadsheets.tsx).
//
// Regras do produto respeitadas:
// - Bloqueio condicional ao CONTEÚDO: campo preenchido pelo Admin fica
//   travado para o Técnico; vazio permanece editável (isAreaPresetLocked).
// - Snapshot: ao aplicar/carregar, grava { configId, configVersion, presetFields, ... }
//   no próprio registro da planilha (campo JSON area_config_snapshot), para que
//   edições futuras do Admin não alterem planilhas já criadas.
// - Remover a área volta ao estado sem configuração, sem apagar dados já digitados
//   (o snapshot é limpo; os valores permanecem no formulário).
// - Nada aqui toca sincronização, fila, client_token ou realtime: o snapshot viaja
//   como um campo a mais no payload existente da planilha.

import { useEffect, useMemo, useState } from 'react'
import type { PresetFields } from '@/lib/fieldSheetConfigMetadata'

export const AREA_CONFIG_SNAPSHOT_FIELD = 'area_config_snapshot'

export interface AreaConfigSnapshot {
  configId: string
  configVersion: number
  areaName: string
  contractNumber: string
  description: string
  presetFields: PresetFields
  loadedAt: string
}

/** Converte valor desconhecido (string JSON ou objeto) em PresetFields plano */
function parsePresetFields(raw: unknown): PresetFields {
  if (!raw) return {}
  let cur: unknown = raw
  let attempts = 0
  while (typeof cur === 'string' && attempts < 3) {
    const trimmed = cur.trim()
    if (!trimmed || trimmed === '{}' || trimmed === '""' || trimmed === 'null') return {}
    try {
      cur = JSON.parse(trimmed)
    } catch {
      return {}
    }
    attempts++
  }
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return {}
  return cur as PresetFields
}

/** Lê o snapshot gravado no registro da planilha (string JSON), se houver */
export function parseAreaConfigSnapshot(raw: unknown): AreaConfigSnapshot | null {
  if (!raw) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed || trimmed === '{}' || trimmed === '""' || trimmed === 'null') return null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const o = obj as Record<string, unknown>
  if (!o.configId || !o.areaName) return null
  return {
    configId: String(o.configId),
    configVersion:
      typeof o.configVersion === 'number' ? o.configVersion : Number(o.configVersion) || 0,
    areaName: String(o.areaName),
    contractNumber: String(o.contractNumber || ''),
    description: String(o.description || ''),
    presetFields: parsePresetFields(o.presetFields),
    loadedAt: String(o.loadedAt || ''),
  }
}

/**
 * Lê uma lista dinâmica serializada em preset_fields (wells / infiltration_exits).
 * Aceita array já parseado ou JSON em string (mesma convenção de
 * FieldSheetEditorForm.tsx / parseJsonList).
 */
function parsePresetJsonList(raw: unknown): Array<Record<string, unknown>> {
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

/** Busca a configuração ativa da área em area_configs (leitura — qualquer autenticado) */
export async function fetchAreaConfigByArea(
  pb: { collection: (n: string) => any },
  areaName: string,
): Promise<AreaConfigSnapshot | null> {
  const name = (areaName || '').trim()
  if (!name) return null
  try {
    const safe = name.replace(/"/g, '\\"')
    const rec: any = await pb
      .collection('area_configs')
      .getFirstListItem(`area_name = "${safe}" && active = true`)
    return {
      configId: rec.id,
      configVersion: rec.config_version || 0,
      areaName: rec.area_name || name,
      contractNumber: rec.contract_number || '',
      description: rec.description || '',
      presetFields: parsePresetFields(rec.preset_fields),
      loadedAt: new Date().toISOString(),
    }
  } catch {
    // Sem configuração para a área (ou offline): planilha segue editável como hoje
    return null
  }
}

// ---------------------------------------------------------------------------
// Mapeamento preset -> campos reais do formulário
// ---------------------------------------------------------------------------

/** Chaves preset simples -> coluna de topo do registro field_spreadsheets */
const SIMPLE_FIELD_MAP: Record<string, string> = {
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

/** Chaves preset booleanas -> coluna de topo */
const BOOLEAN_FIELD_MAP: Record<string, string> = {
  'nutrients.nutrient_done': 'nutrient_done',
  'env.env_5s_check': 'env_5s_check',
  'env.env_checklist_monthly': 'env_checklist_monthly',
}

/** Chaves preset -> sub-chave de objeto JSON do registro */
const JSON_OBJ_FIELD_MAP: Record<string, [string, string]> = {
  'infiltration.geralMorning': ['infiltration_data', 'geralMorning'],
  'infiltration.geralAfternoon': ['infiltration_data', 'geralAfternoon'],
  'infiltration.bombaInfiltracao': ['infiltration_data', 'bombaInfiltracao'],
  'infiltration.bombaGeral': ['infiltration_data', 'bombaGeral'],
  'oil_removal.sao1Volume': ['oil_removal_data', 'sao1Volume'],
  'oil_removal.sao1DataLimpeza': ['oil_removal_data', 'sao1DataLimpeza'],
  'oil_removal.sao2Volume': ['oil_removal_data', 'sao2Volume'],
  'oil_removal.sao2DataLimpeza': ['oil_removal_data', 'sao2DataLimpeza'],
}

/** Compressores: compressor_data.<prefixo><1..4> */
const COMPRESSOR_PREFIXES = [
  'horimetro',
  'pressao',
  'drenagem',
  'tempoDesligado',
  'filtroAr',
  'nivelOleo',
  'trocaOleo',
  'linhaAr',
]

const COMPRESSOR_KEYS: Record<string, string> = {}
for (const p of COMPRESSOR_PREFIXES) {
  for (let i = 1; i <= 4; i++) {
    COMPRESSOR_KEYS[`compressors.compressor_data.${p}${i}`] = `compressor_data.${p}${i}`
  }
}

/** Valor preenchido pelo Admin? (bloqueio condicional ao conteúdo) */
export function isPresetValueFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'boolean') return value
  return String(value).trim() !== ''
}

/** Mapa inverso: caminho do campo na planilha -> chave no preset */
const TARGET_TO_PRESET_KEY: Record<string, string> = {}
for (const [pk, col] of Object.entries(SIMPLE_FIELD_MAP)) TARGET_TO_PRESET_KEY[col] = pk
for (const [pk, col] of Object.entries(BOOLEAN_FIELD_MAP)) TARGET_TO_PRESET_KEY[col] = pk
for (const [pk, [obj, sub]] of Object.entries(JSON_OBJ_FIELD_MAP)) {
  TARGET_TO_PRESET_KEY[`${obj}.${sub}`] = pk
}
for (const [pk, target] of Object.entries(COMPRESSOR_KEYS)) TARGET_TO_PRESET_KEY[target] = pk

/**
 * O campo (ex.: 'weather', 'infiltration_data.geralMorning', 'compressor_data.horimetro1')
 * foi preenchido pelo Admin nesta configuração? Se sim, fica travado para o Técnico.
 */
export function isSheetFieldLockedByAreaPreset(
  snapshot: AreaConfigSnapshot | null | undefined,
  sheetFieldPath: string,
): boolean {
  if (!snapshot) return false
  const preset = snapshot.presetFields
  const presetKey = TARGET_TO_PRESET_KEY[sheetFieldPath]
  if (presetKey) return isPresetValueFilled(preset?.[presetKey])
  // Poços dinâmicos (tabela 1. Extração): extraction_data.<índice>.<coluna>
  const wellMatch = /^extraction_data\.(\d+)\.(well|morning|afternoon|pump|autopump)$/.exec(
    sheetFieldPath,
  )
  if (wellMatch) {
    const row = parsePresetJsonList(preset?.wells)[Number(wellMatch[1])]
    if (!row) return false
    return isPresetValueFilled(row[wellMatch[2]])
  }
  // Saídas dinâmicas de infiltração (tabela 2): infiltration_data.out<N>Morning/Afternoon
  const exitMatch = /^infiltration_data\.out(\d+)(Morning|Afternoon)$/.exec(sheetFieldPath)
  if (exitMatch) {
    const num = Number(exitMatch[1])
    const row = parsePresetJsonList(preset?.infiltration_exits).find((e) => Number(e.exit) === num)
    if (!row) return false
    return isPresetValueFilled(row[exitMatch[2] === 'Morning' ? 'morning' : 'afternoon'])
  }
  return false
}

/** Valor atual do campo no formulário está vazio? (preset só preenche campo vazio) */
function isFormValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'boolean') return false // booleano já definido não é sobrescrito
  return String(value).trim() === ''
}

/**
 * Constrói o patch de pré-preenchimento: aplica o preset SOMENTE sobre campos
 * vazios do formulário — nunca sobrescreve dado já digitado pelo Técnico/Admin.
 */
export function buildPresetPatch(
  current: Record<string, any>,
  presetFields: PresetFields,
): Record<string, any> {
  const patch: Record<string, any> = {}
  const jsonTargets: Record<string, Record<string, unknown>> = {}

  for (const [presetKey, col] of Object.entries(SIMPLE_FIELD_MAP)) {
    const val = presetFields[presetKey]
    if (isPresetValueFilled(val) && isFormValueEmpty(current[col])) patch[col] = String(val)
  }
  for (const [presetKey, col] of Object.entries(BOOLEAN_FIELD_MAP)) {
    const val = presetFields[presetKey]
    if (val === true && current[col] !== true) patch[col] = true
    if (val === false && current[col] === undefined) patch[col] = false
  }
  const jsonMaps: Array<[Record<string, string[]>, Record<string, unknown>]> = [
    [JSON_OBJ_FIELD_MAP, presetFields],
  ]
  for (const [map, source] of jsonMaps) {
    for (const presetKey of Object.keys(map)) {
      const objName = map[presetKey][0]
      const subKey = map[presetKey][1]
      const val = source[presetKey]
      if (!isPresetValueFilled(val)) continue
      const curObj = current[objName]
      const curSub =
        curObj && typeof curObj === 'object' && !Array.isArray(curObj)
          ? (curObj as any)[subKey]
          : undefined
      if (isFormValueEmpty(curSub)) {
        if (!jsonTargets[objName]) jsonTargets[objName] = {}
        jsonTargets[objName][subKey] = String(val)
      }
    }
  }
  for (const [presetKey, target] of Object.entries(COMPRESSOR_KEYS)) {
    const val = presetFields[presetKey]
    if (!isPresetValueFilled(val)) continue
    const [objName, subKey] = [target.split('.')[0], target.split('.')[1]]
    const curObj = current[objName]
    const curSub =
      curObj && typeof curObj === 'object' && !Array.isArray(curObj)
        ? (curObj as any)[subKey]
        : undefined
    if (isFormValueEmpty(curSub)) {
      if (!jsonTargets[objName]) jsonTargets[objName] = {}
      jsonTargets[objName][subKey] = String(val)
    }
  }
  // Poços dinâmicos: quando o preset define poços e o formulário ainda não tem
  // leitura digitada em nenhuma linha, as linhas do preset substituem as linhas
  // default (PR-01/PR-02) — dados já digitados pelo Técnico nunca são sobrescritos.
  const presetWells = parsePresetJsonList(presetFields.wells)
  if (presetWells.length > 0) {
    const curRows = Array.isArray(current.extraction_data) ? current.extraction_data : []
    const rowsMatchPreset =
      curRows.length === presetWells.length &&
      curRows.every(
        (row, i) => String(row?.well ?? '').trim() === String(presetWells[i].well ?? '').trim(),
      )
    // Lista de poços diferente da atual (default PR-01/PR-02 ou poços de OUTRA área):
    // substitui pelas linhas do preset. Leituras digitadas são mantidas somente quando
    // o nome do poço é o mesmo — poços de outra área nunca permanecem na tabela.
    if (!rowsMatchPreset) {
      const pick = (
        row: Record<string, unknown> | undefined,
        w: Record<string, unknown>,
        col: string,
      ) => (row && !isFormValueEmpty(row[col]) ? String(row[col]) : String(w[col] ?? ''))
      patch.extraction_data = presetWells.map((w) => {
        const wellName = String(w.well ?? '').trim()
        const prevRow = curRows.find((row) => String(row?.well ?? '').trim() === wellName) as
          | Record<string, unknown>
          | undefined
        return {
          well: String(w.well ?? ''),
          morning: pick(prevRow, w, 'morning'),
          afternoon: pick(prevRow, w, 'afternoon'),
          pump: pick(prevRow, w, 'pump'),
          autopump: pick(prevRow, w, 'autopump'),
        }
      })
    }
  }
  // Saídas dinâmicas de infiltração: out<N>Morning / out<N>Afternoon (só sub-chaves vazias)
  for (const exit of parsePresetJsonList(presetFields.infiltration_exits)) {
    const num = Number(exit.exit)
    if (!Number.isInteger(num) || num < 1) continue
    for (const [suffix, pk] of [
      ['Morning', 'morning'],
      ['Afternoon', 'afternoon'],
    ] as const) {
      const val = exit[pk]
      if (!isPresetValueFilled(val)) continue
      const subKey = `out${num}${suffix}`
      const curSub = (current.infiltration_data as Record<string, unknown> | undefined)?.[subKey]
      if (isFormValueEmpty(curSub)) {
        if (!jsonTargets.infiltration_data) jsonTargets.infiltration_data = {}
        jsonTargets.infiltration_data[subKey] = String(val)
      }
    }
  }
  for (const [objName, subObj] of Object.entries(jsonTargets)) {
    const base =
      current[objName] && typeof current[objName] === 'object' && !Array.isArray(current[objName])
        ? (current[objName] as Record<string, unknown>)
        : {}
    patch[objName] = { ...base, ...subObj }
  }
  return patch
}

/**
 * Troca de área: remove valores aplicados pelo preset ANTERIOR que o usuário
 * ainda não editou (valor atual === valor do preset antigo) e que a nova
 * configuração não volta a preencher. Dados digitados pelo usuário nunca são
 * apagados; seleção/remoção de uma área não toca dados das demais.
 */
function clearStalePresetValues(
  current: Record<string, any>,
  prevPreset: PresetFields,
  nextPreset: PresetFields,
): Record<string, any> {
  const next: Record<string, any> = { ...current }
  const stale = (cur: unknown, prevVal: unknown) =>
    isPresetValueFilled(prevVal) &&
    cur !== undefined &&
    cur !== null &&
    String(cur) === String(prevVal)

  // Valor que veio do preset anterior e não foi editado é ZERADO aqui; o preset novo
  // é reaplicado logo depois por buildPresetPatch (que só preenche campos vazios).
  // Assim a área selecionada substitui os valores da área anterior.
  for (const [presetKey, col] of Object.entries(SIMPLE_FIELD_MAP)) {
    if (stale(next[col], prevPreset[presetKey])) {
      next[col] = ''
    }
  }
  for (const [presetKey, [objName, subKey]] of Object.entries(JSON_OBJ_FIELD_MAP)) {
    const obj = next[objName]
    const curSub = obj && typeof obj === 'object' ? (obj as any)[subKey] : undefined
    if (stale(curSub, prevPreset[presetKey])) {
      next[objName] = { ...(obj && typeof obj === 'object' ? obj : {}), [subKey]: '' }
    }
  }
  for (const [presetKey, target] of Object.entries(COMPRESSOR_KEYS)) {
    const [objName, subKey] = target.split('.')
    const obj = next[objName]
    const curSub = obj && typeof obj === 'object' ? (obj as any)[subKey] : undefined
    if (stale(curSub, prevPreset[presetKey])) {
      next[objName] = { ...(obj && typeof obj === 'object' ? obj : {}), [subKey]: '' }
    }
  }
  for (const [presetKey, col] of Object.entries(BOOLEAN_FIELD_MAP)) {
    if (prevPreset[presetKey] === true && next[col] === true && nextPreset[presetKey] !== true) {
      next[col] = false
    }
  }
  // Poços: as linhas são do preset anterior quando nome do poço e cada leitura são
  // iguais aos do preset OU estão vazias. Se for esse o caso, a lista inteira é
  // trocada pelos poços da nova área (ou volta ao padrão PR-01/PR-02 se ela não tiver).
  // Se o Técnico digitou leitura diferente do preset, as linhas são preservadas.
  const POSITIONAL_COLS = ['morning', 'afternoon', 'pump', 'autopump'] as const
  const prevWells = parsePresetJsonList(prevPreset.wells)
  if (prevWells.length > 0) {
    const curRows = Array.isArray(next.extraction_data) ? next.extraction_data : []
    const rowIsFromPreset = (row: any, prevRow: Record<string, unknown>) =>
      String(row?.well ?? '').trim() === String(prevRow.well ?? '').trim() &&
      POSITIONAL_COLS.every((col) => {
        const cur = String(row?.[col] ?? '').trim()
        return cur === '' || cur === String(prevRow[col] ?? '').trim()
      })
    const allFromPreset =
      curRows.length === prevWells.length &&
      curRows.every((row, i) => rowIsFromPreset(row, prevWells[i]))
    if (allFromPreset) {
      const nextWells = parsePresetJsonList(nextPreset.wells)
      next.extraction_data =
        nextWells.length > 0
          ? nextWells.map((w) => ({
              well: String(w.well ?? ''),
              morning: String(w.morning ?? ''),
              afternoon: String(w.afternoon ?? ''),
              pump: String(w.pump ?? ''),
              autopump: String(w.autopump ?? ''),
            }))
          : [
              { well: 'PR-01', morning: '', afternoon: '', pump: '', autopump: '' },
              { well: 'PR-02', morning: '', afternoon: '', pump: '', autopump: '' },
            ]
    }
  }
  // Saídas de infiltração dinâmicas: mesmo critério (valor intacto do preset antigo)
  const prevExits = parsePresetJsonList(prevPreset.infiltration_exits)
  for (const exit of prevExits) {
    const num = Number(exit.exit)
    if (!Number.isInteger(num) || num < 1) continue
    for (const [suffix, pk] of [
      ['Morning', 'morning'],
      ['Afternoon', 'afternoon'],
    ] as const) {
      const subKey = `out${num}${suffix}`
      const curSub = (next.infiltration_data as Record<string, unknown> | undefined)?.[subKey]
      if (stale(curSub, exit[pk])) {
        next.infiltration_data = {
          ...(next.infiltration_data && typeof next.infiltration_data === 'object'
            ? next.infiltration_data
            : {}),
          [subKey]: '',
        }
      }
    }
  }
  return next
}

export interface UseAreaConfigPresetResult {
  /** Configuração ativa usada por esta planilha (do snapshot gravado ou recém-buscada) */
  areaConfigSnapshot: AreaConfigSnapshot | null
  /** true = campo preenchido pelo Admin e, portanto, travado para o Técnico */
  isAreaPresetLocked: (sheetFieldPath: string) => boolean
}

/**
 * Hook do editor: gerencia carga e ciclo de vida da configuração de área.
 * - UMA área selecionada + sem snapshot correspondente -> busca em area_configs e aplica.
 * - Snapshot gravado no documento -> fallback apenas quando a busca não responde;
 *   a config ATIVA no servidor é sempre a fonte da verdade (recarregar a página
 *   mostra os poços atuais da área, não os de um snapshot antigo).
 * - Múltiplas áreas selecionadas: busca TODAS as configs ativas e mescla os presets
 *   (primeira área que preenche cada campo vence; campos já digitados não mudam).
 * - Área removida/trocada -> valores intactos do preset antigo que a nova config
 *   não preenche são limpos (clearStalePresetValues); valores digitados permanecem.
 * - Admin: também busca e aplica (precisa visualizar a config da área); o BLOQUEIO
 *   continua exclusivo do Técnico (isAreaPresetLocked retorna false para Admin).
 */
export function useAreaConfigPreset(params: {
  formData: Record<string, any>
  isAdmin: boolean
  setFormData: (updater: (prev: any) => any) => void
  pbClient: { collection: (n: string) => any }
}): UseAreaConfigPresetResult {
  const { formData, isAdmin, setFormData, pbClient } = params

  const selectedAreas = useMemo(() => {
    const raw = String(formData?.area || '')
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }, [formData?.area])

  const [activeConfig, setActiveConfig] = useState<AreaConfigSnapshot | null>(() =>
    parseAreaConfigSnapshot(formData?.[AREA_CONFIG_SNAPSHOT_FIELD]),
  )

  useEffect(() => {
    const stored = parseAreaConfigSnapshot(formData?.[AREA_CONFIG_SNAPSHOT_FIELD])
    const currentSet = [...selectedAreas].sort()
    const storedSet = stored
      ? stored.areaName
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
      : []
    const sameSet =
      storedSet.length === currentSet.length && storedSet.every((v, i) => v === currentSet[i])

    // FONTE DA VERDADE = SERVIDOR (area_configs da área selecionada).
    // O snapshot gravado no documento NUNCA é usado como valor final quando a
    // busca online responde: um snapshot antigo podia carregar poços de uma
    // versão anterior da configuração (ou de outra área), fazendo o Técnico ver
    // poços errados ao selecionar/trocar/recarregar a área. Ele entra apenas
    // como fallback quando a busca não responde (offline/sem acesso).
    let cancelled = false
    ;(async () => {
      // Busca a config ativa de CADA área selecionada e mescla os presets
      const snaps = (
        await Promise.all(selectedAreas.map((name) => fetchAreaConfigByArea(pbClient, name)))
      ).filter((s): s is AreaConfigSnapshot => !!s)

      if (cancelled) return

      if (snaps.length === 0) {
        // Busca sem resposta (offline ou sem acesso de leitura): mantém o
        // snapshot gravado quando a seleção corresponde — não limpa valores
        // nem troca os poços exibidos.
        if (stored && sameSet && storedSet.length > 0) {
          setActiveConfig(stored)
          return
        }
        // Nenhuma config (área sem configuração, offline ou seleção vazia):
        // sem vínculo; limpa snapshot remanescente e valores intactos do preset antigo
        setActiveConfig(null)
        setFormData((prev: any) => {
          if (!prev) return prev
          const prevSnap = parseAreaConfigSnapshot(prev[AREA_CONFIG_SNAPSHOT_FIELD])
          const cleaned = prevSnap ? clearStalePresetValues(prev, prevSnap.presetFields, {}) : prev
          if (cleaned === prev && prev[AREA_CONFIG_SNAPSHOT_FIELD] === undefined) {
            return prev
          }
          const next = { ...cleaned }
          delete next[AREA_CONFIG_SNAPSHOT_FIELD]
          return next
        })
        return
      }

      // Mescla: a primeira área que preenche cada chave do preset vence
      const merged: PresetFields = {}
      for (const s of snaps) {
        for (const [k, v] of Object.entries(s.presetFields)) {
          if (merged[k] === undefined || merged[k] === null || merged[k] === '') merged[k] = v
        }
      }
      const combined: AreaConfigSnapshot = {
        configId: snaps.map((s) => s.configId).join(','),
        configVersion: snaps.reduce((max, s) => Math.max(max, s.configVersion), 0),
        areaName: selectedAreas.join(', '),
        contractNumber: snaps
          .map((s) => s.contractNumber)
          .filter((c) => c.trim() !== '')
          .join(', '),
        description: snaps
          .map((s) => s.description)
          .filter((d) => d.trim() !== '')
          .join(' | '),
        presetFields: merged,
        loadedAt: new Date().toISOString(),
      }
      setActiveConfig(combined)
      setFormData((prev: any) => {
        const prevSnap = parseAreaConfigSnapshot(prev?.[AREA_CONFIG_SNAPSHOT_FIELD])
        // 1) limpa valores intactos do preset ANTERIOR que a nova config não preenche
        const base = prevSnap
          ? clearStalePresetValues(prev || {}, prevSnap.presetFields, merged)
          : prev || {}
        // 2) aplica o preset novo sobre o estado MAIS RECENTE (só campos vazios)
        const patch = buildPresetPatch(base, merged)
        return { ...base, ...patch, [AREA_CONFIG_SNAPSHOT_FIELD]: JSON.stringify(combined) }
      })
    })()

    return () => {
      cancelled = true
    }
    // Recarrega quando a SELEÇÃO de áreas muda (não a cada tecla em outros campos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAreas.join('|'), isAdmin])

  const isAreaPresetLocked = (sheetFieldPath: string) => {
    if (isAdmin) return false
    return isSheetFieldLockedByAreaPreset(activeConfig, sheetFieldPath)
  }

  return { areaConfigSnapshot: activeConfig, isAreaPresetLocked }
}
