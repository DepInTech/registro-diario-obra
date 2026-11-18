// FONTE ÚNICA DE VERDADE do mapeamento seção → campos do registro para o ciclo de
// devolução por campo (correção). Usado pela UI (bloqueio visual) e espelhado
// BYTE A BYTE no servidor (pocketbase/hooks/returned_fields_guard.js) — se mudar
// aqui, mude lá. Nomes de campo = chaves gravadas no registro PocketBase
// (field_spreadsheets / reports_rdo), NÃO IDs de grupo de UI.

export type ReturnFieldsMap = Record<string, string[]>

/** Planilha de Campo: grupo (seção) → campos reais do registro. */
export const FIELD_SHEET_RETURN_GROUPS: ReturnFieldsMap = {
  hidrometro: ['morning_time', 'afternoon_time', 'extraction_data'],
  autopump: ['extraction_data'],
  infiltracao: ['infiltration_morning_time', 'infiltration_afternoon_time', 'infiltration_data'],
  nutrientes: ['nutrient_done', 'nutrient_map_kg', 'nutrient_ureia_kg'],
  compressores: ['compressor_data'],
  oleo: ['oil_removal_data'],
  residuos: ['waste_liquid_qty', 'waste_solid_qty'],
  controles_ambientais: ['env_5s_check', 'env_checklist_monthly'],
  observacoes: ['observations'],
  dados_gerais: ['area', 'weather', 'pluviometer'],
}

/** RDO: grupo (seção) → campos reais do registro. */
export const RDO_RETURN_GROUPS: ReturnFieldsMap = {
  atividade: ['activity_title', 'activity_description'],
  horarios: ['time_displacement', 'time_waiting'],
  interferencias: ['interferences', 'accidents'],
  mudancas_plano: ['plan_changes'],
  pocos: ['wells'],
  fotos: ['photos'],
  clima_local: ['weather', 'location', 'report_date'],
}

/** Campos de controle/sistema que o técnico nunca altera no ciclo de correção. */
export const RETURN_CYCLE_SYSTEM_FIELDS = [
  'id',
  'created',
  'updated',
  'status',
  'returned_fields',
  'review_notes',
  'change_history',
  'admin_snapshot',
  'archived',
  'deleted',
  'deleted_reason',
  'deleted_by',
  'deleted_at',
  'client_token',
  'number',
  'project',
  'operator',
  'assigned_technicians',
  'submitted_at',
  'approved_at',
  'returned_at',
  'returned_by',
  'returned_by_name',
]

const invertGroups = (groups: ReturnFieldsMap): Record<string, string[]> => {
  const out: Record<string, string[]> = {}
  Object.keys(groups).forEach((group) => {
    groups[group].forEach((field) => {
      if (!out[field]) out[field] = []
      out[field].push(group)
    })
  })
  return out
}

const FS_FIELD_OF_GROUP = invertGroups(FIELD_SHEET_RETURN_GROUPS)
const RDO_FIELD_OF_GROUP = invertGroups(RDO_RETURN_GROUPS)

export type ReturnFieldsKind = 'field_sheet' | 'rdo'

const kindMap = (kind: ReturnFieldsKind): ReturnFieldsMap =>
  kind === 'rdo' ? RDO_RETURN_GROUPS : FIELD_SHEET_RETURN_GROUPS

const kindInverted = (kind: ReturnFieldsKind): Record<string, string[]> =>
  kind === 'rdo' ? RDO_FIELD_OF_GROUP : FS_FIELD_OF_GROUP

/** Normaliza a lista devolvida pelo admin: grupos e/ou nomes de campo diretos. */
export const parseReturnedList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // campo texto simples: um valor só
      return [raw]
    }
  }
  return []
}

/**
 * Um campo do registro está liberado para o técnico?
 * Autorizado se o campo pertence a um grupo presente na lista, OU se o próprio
 * nome do campo aparece diretamente na lista (granularidade fina do admin).
 */
export const isRecordFieldAuthorized = (
  kind: ReturnFieldsKind,
  fieldName: string,
  returnedList: string[],
): boolean => {
  const groups = kindInverted(kind)[fieldName] || []
  if (groups.some((g) => returnedList.includes(g))) return true
  return returnedList.includes(fieldName)
}

/**
 * Um CAMPO/SEÇÃO escolhido pelo admin na UI de devolução (value de FIELD_SHEET_RETURN_OPTIONS)
 * está coberto pela lista devolvida? Usado pelo destaque visual e pelo bloqueio por seção.
 */
export const isReturnOptionAuthorized = (
  kind: ReturnFieldsKind,
  optionValue: string,
  returnedList: string[],
): boolean => {
  if (returnedList.includes(optionValue)) return true
  const fields = kindMap(kind)[optionValue] || []
  return fields.some((f) => returnedList.includes(f))
}

/** Rótulo amigável de um campo do registro (para erros e histórico). */
export const returnFieldLabel = (kind: ReturnFieldsKind, fieldName: string): string => {
  const base = fieldName.split('[')[0].split('.')[0]
  const common: Record<string, string> = {
    area: 'Área',
    weather: 'Clima',
    pluviometer: 'Pluviômetro (mm)',
    observations: 'Observações e Manutenções',
  }
  if (kind === 'rdo') {
    return (
      {
        activity_title: 'Título da Atividade',
        activity_description: 'Descrição dos Serviços',
        time_displacement: 'Horário de Deslocamento',
        time_waiting: 'Tempo de Espera',
        interferences: 'Interferências Encontradas',
        accidents: 'Acidentes / Incidentes',
        plan_changes: 'Mudanças de Plano',
        wells: 'Tabela de Poços',
        photos: 'Fotografias do Relatório',
        location: 'Local da Obra',
        report_date: 'Data do Relatório',
        empresa_executora: 'Empresa Executora',
      }[base] ||
      common[base] ||
      base
    )
  }
  return (
    {
      morning_time: 'Horário Hidrômetro Manhã',
      afternoon_time: 'Horário Hidrômetro Tarde',
      infiltration_morning_time: 'Horário Infiltração Manhã',
      infiltration_afternoon_time: 'Horário Infiltração Tarde',
      nutrient_done: 'Dosagem de Nutrientes Realizada',
      nutrient_map_kg: 'Nutriente MAP (Kg)',
      nutrient_ureia_kg: 'Nutriente Ureia (Kg)',
      waste_liquid_qty: 'Tambores Líquido (Qtd)',
      waste_solid_qty: 'Tambores Sólido (Qtd)',
      env_5s_check: 'Controle 5S',
      env_checklist_monthly: 'Checklist Mensal',
      extraction_data: 'Tabela de Extração (Poços)',
      infiltration_data: 'Infiltração',
      compressor_data: 'Compressores',
      oil_removal_data: 'Remoção de Óleo (SAO)',
    }[base] ||
    common[base] ||
    base
  )
}
