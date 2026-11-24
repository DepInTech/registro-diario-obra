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
  const presetKey = TARGET_TO_PRESET_KEY[sheetFieldPath]
  if (!presetKey) return false
  return isPresetValueFilled(snapshot.presetFields?.[presetKey])
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
  for (const [objName, subObj] of Object.entries(jsonTargets)) {
    const base =
      current[objName] && typeof current[objName] === 'object' && !Array.isArray(current[objName])
        ? (current[objName] as Record<string, unknown>)
        : {}
    patch[objName] = { ...base, ...subObj }
  }
  return patch
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
 * - Snapshot já gravado no documento -> usado como fonte da verdade (sem retroatividade).
 * - Área removida/trocada -> snapshot é limpo do formulário; valores digitados permanecem.
 * - Admin: não busca nem aplica (configuração é coisa do Técnico consumir).
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
    if (isAdmin) return
    const stored = parseAreaConfigSnapshot(formData?.[AREA_CONFIG_SNAPSHOT_FIELD])
    const single = selectedAreas.length === 1 ? selectedAreas[0] : null

    // Documento existente com snapshot da MESMA área: usa o snapshot (sem refetch)
    if (stored && stored.areaName === single) {
      setActiveConfig(stored)
      return
    }
    // Snapshot de outra área ou seleção não-unitária: descarta o vínculo no FORMULÁRIO
    // (dados já digitados permanecem; novo salvamento sai sem configuração)
    if (stored) {
      setActiveConfig(null)
      setFormData((prev: any) => {
        if (prev?.[AREA_CONFIG_SNAPSHOT_FIELD] === undefined) return prev
        const next = { ...prev }
        delete next[AREA_CONFIG_SNAPSHOT_FIELD]
        return next
      })
      return
    }
    if (!single) {
      setActiveConfig(null)
      return
    }

    let cancelled = false
    ;(async () => {
      const snap = await fetchAreaConfigByArea(pbClient, single)
      if (cancelled) return
      if (!snap) {
        setActiveConfig(null)
        return
      }
      setActiveConfig(snap)
      setFormData((prev: any) => {
        // Aplica o preset sobre o estado MAIS RECENTE do formulário
        const patch = buildPresetPatch(prev || {}, snap.presetFields)
        return { ...(prev || {}), ...patch, [AREA_CONFIG_SNAPSHOT_FIELD]: JSON.stringify(snap) }
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
