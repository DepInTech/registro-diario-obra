// Chaves PLANAS do preset (mesmo formato de area_configs.preset_fields) e o
// write-through de digitação da Configuração de Áreas.
//
// Fonte de verdade INDEPENDENTE do estado React: cada input simples do
// FieldSheetEditorForm (mode="admin-config"), além do onChange, grava
// SINCRONAMENTE sua chave plana no rascunho de sessão da área
// (src/pages/AreaConfigs.tsx — mesmo mecanismo de rascunho da v0.0.235,
// estendido com o campo flatPreset). O Salvar lê deste rascunho, então o que
// o Admin digitou chega ao banco MESMO que o sheetForm tenha sido resetado.
//
// Formato das chaves = EXATAMENTE o formato persistido em preset_fields:
//   "header.weather", "infiltration.geralMorning", "infiltration.out1Morning",
//   "oil_removal.sao1Volume", "compressors.compressor_data.horimetro1", ...
// (saídas dinâmicas ficam planas no rascunho e viram infiltration_exits[]
// na serialização, via formStateToPresetFields.)

import type { FieldSheetFormState } from '@/components/FieldSheetEditorForm'

/** Chave plana do preset -> campo de topo do estado do formulário (texto) */
export const SIMPLE_PRESET_MAP: Record<string, keyof FieldSheetFormState> = {
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

/** Chave plana do preset -> campo de topo do estado (booleano) */
export const BOOLEAN_PRESET_MAP: Record<string, keyof FieldSheetFormState> = {
  'nutrients.nutrient_done': 'nutrient_done',
  'env.env_5s_check': 'env_5s_check',
  'env.env_checklist_monthly': 'env_checklist_monthly',
}

/** Chave plana do preset -> [objeto do estado, sub-chave] */
export const JSON_SUB_PRESET_MAP: Record<string, [keyof FieldSheetFormState, string]> = {
  'infiltration.geralMorning': ['infiltration_data', 'geralMorning'],
  'infiltration.geralAfternoon': ['infiltration_data', 'geralAfternoon'],
  'infiltration.bombaInfiltracao': ['infiltration_data', 'bombaInfiltracao'],
  'infiltration.bombaGeral': ['infiltration_data', 'bombaGeral'],
  'oil_removal.sao1Volume': ['oil_removal_data', 'sao1Volume'],
  'oil_removal.sao1DataLimpeza': ['oil_removal_data', 'sao1DataLimpeza'],
  'oil_removal.sao2Volume': ['oil_removal_data', 'sao2Volume'],
  'oil_removal.sao2DataLimpeza': ['oil_removal_data', 'sao2DataLimpeza'],
}

export type FlatPresetPatch = Record<string, string | boolean>

// Mapas inversos (campo do estado -> chave plana), calculados uma vez.
const TARGET_TO_FLAT: Record<string, [string, 'string' | 'boolean']> = {}
for (const [pk, target] of Object.entries(SIMPLE_PRESET_MAP)) {
  TARGET_TO_FLAT[target as string] = [pk, 'string']
}
for (const [pk, target] of Object.entries(BOOLEAN_PRESET_MAP)) {
  TARGET_TO_FLAT[target as string] = [pk, 'boolean']
}
const OBJ_SUB_TO_FLAT: Record<string, string> = {}
for (const [pk, [objName, subKey]] of Object.entries(JSON_SUB_PRESET_MAP)) {
  OBJ_SUB_TO_FLAT[`${String(objName)}.${subKey}`] = pk
}

const COMPRESSOR_FLAT_PREFIX = 'compressors.compressor_data.'

/**
 * Converte um patch de estado do formulário (o que um onChange acabou de
 * mudar) nas chaves planas equivalentes do preset. Estruturas (wells —
 * extraction_data — e o próprio compressor_count) não entram: elas já
 * chegam ao estado e são serializadas pelo caminho normal.
 */
export function formPatchToFlatPreset(
  patch: Partial<
    Omit<FieldSheetFormState, 'oil_removal_data' | 'compressor_data' | 'infiltration_data'>
  > & {
    infiltration_data?: Record<string, string>
    compressor_data?: Record<string, string>
    oil_removal_data?: Record<string, string>
  },
): FlatPresetPatch {
  const out: FlatPresetPatch = {}
  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v))
  for (const [name, val] of Object.entries(patch)) {
    const direct = TARGET_TO_FLAT[name]
    if (direct) {
      out[direct[0]] = direct[1] === 'boolean' ? val === true : str(val)
      continue
    }
    if (name === 'infiltration_data' && val && typeof val === 'object') {
      for (const [sub, sv] of Object.entries(val as Record<string, unknown>)) {
        const fixed = OBJ_SUB_TO_FLAT[`infiltration_data.${sub}`]
        if (fixed) {
          out[fixed] = str(sv)
          continue
        }
        const m = /^out(\d+)(Morning|Afternoon)$/.exec(sub)
        if (m) out[`infiltration.out${m[1]}${m[2]}`] = str(sv)
      }
      continue
    }
    if (name === 'oil_removal_data' && val && typeof val === 'object') {
      for (const [sub, sv] of Object.entries(val as Record<string, unknown>)) {
        const fixed = OBJ_SUB_TO_FLAT[`oil_removal_data.${sub}`]
        if (fixed) out[fixed] = str(sv)
      }
      continue
    }
    if (name === 'compressor_data' && val && typeof val === 'object') {
      for (const [sub, sv] of Object.entries(val as Record<string, unknown>)) {
        out[`${COMPRESSOR_FLAT_PREFIX}${sub}`] = str(sv)
      }
      continue
    }
    // Demais nomes (extraction_data, compressor_count) não são campos simples.
  }
  return out
}

function isFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'boolean') return v
  return String(v).trim() !== ''
}

function toStr(v: unknown): string {
  return v === undefined || v === null ? '' : String(v)
}

/**
 * MESCLAGEM ESTADO x RASCUNHO (regra do Salvar e da reabertura):
 * "estado se não-vazio, senão rascunho" — um valor digitado no estado após a
 * carga do rascunho prevalece; uma chave vazia/ausente no estado é resgatada
 * do rascunho de sessão. Nunca apaga valores existentes do estado.
 */
export function mergeFlatDraftIntoFormState(
  state: FieldSheetFormState,
  flat: FlatPresetPatch | null | undefined,
): FieldSheetFormState {
  if (!flat || typeof flat !== 'object') return state
  const out: FieldSheetFormState = {
    ...state,
    infiltration_data: { ...(state.infiltration_data || {}) },
    compressor_data: { ...(state.compressor_data || {}) },
    oil_removal_data: { ...state.oil_removal_data },
  }
  // Campos simples de texto
  for (const [pk, target] of Object.entries(SIMPLE_PRESET_MAP)) {
    if (!isFilled((out as any)[target]) && isFilled(flat[pk])) {
      ;(out as any)[target] = toStr(flat[pk])
    }
  }
  // Booleanos: rascunho só liga (true); desligar continua sendo ação do estado
  for (const [pk, target] of Object.entries(BOOLEAN_PRESET_MAP)) {
    if ((out as any)[target] !== true && flat[pk] === true) (out as any)[target] = true
  }
  // Sub-chaves de objetos (infiltração fixa, remoção de óleo)
  for (const [pk, [objName, subKey]] of Object.entries(JSON_SUB_PRESET_MAP)) {
    const obj = ((out as any)[objName] || {}) as Record<string, string>
    if (!isFilled(obj[subKey]) && isFilled(flat[pk])) {
      ;(out as any)[objName] = { ...obj, [subKey]: toStr(flat[pk]) }
    }
  }
  // Saídas dinâmicas de infiltração (chaves planas out<N>)
  for (const [pk, v] of Object.entries(flat)) {
    const m = /^infiltration\.out(\d+)(Morning|Afternoon)$/.exec(pk)
    if (!m) continue
    const key = `out${m[1]}${m[2]}`
    if (!isFilled((out.infiltration_data || {})[key]) && isFilled(v)) {
      out.infiltration_data = { ...(out.infiltration_data || {}), [key]: toStr(v) }
    }
  }
  // Compressores (parâmetros + linha de ar)
  for (const [pk, v] of Object.entries(flat)) {
    if (!pk.startsWith(COMPRESSOR_FLAT_PREFIX)) continue
    const key = pk.slice(COMPRESSOR_FLAT_PREFIX.length)
    if (!key) continue
    if (!isFilled((out.compressor_data || {})[key]) && isFilled(v)) {
      out.compressor_data = { ...(out.compressor_data || {}), [key]: toStr(v) }
    }
  }
  return out
}
