// Metadados COMPARTILHADOS da estrutura da Planilha de Campo.
//
// Admin (Configuração de Áreas da Planilha de Campo) e Técnico (preenchimento,
// próxima rodada) usam o MESMO mapeamento de seções/campos. As chaves aqui
// espelham exatamente as colunas e sub-chaves usadas em FieldSpreadsheets.tsx
// (ex.: compressor_data.horimetro1, oil_removal_data.sao1Volume, waste_liquid_qty).
//
// Compatível com a regra de bloqueio do produto: valores preenchidos pelo Admin
// ficam travados para o Técnico; vazios, o Técnico preenche livremente — o
// bloqueio deriva do CONTEÚDO (isFieldLockedByAdmin), e não do perfil.

export type FieldSheetConfigFieldType =
  | 'text'
  | 'number'
  | 'time'
  | 'date'
  | 'toggle'
  | 'select'
  | 'textarea'

export interface FieldSheetConfigField {
  key: string
  label: string
  type: FieldSheetConfigFieldType
  placeholder?: string
  options?: string[]
  hint?: string
}

export interface FieldSheetConfigGroup {
  key: string
  label: string
  description: string
  fields: FieldSheetConfigField[]
  /** Campos-chave dentro do grupo que ficam travados (nome para exibição) */
}

export interface AreaConfigRecord {
  id: string
  area_name: string
  contract_number: string
  description: string
  preset_fields: PresetFields | null
  active: boolean
  config_version: number
  created: string
  updated: string
}

export type PresetFields = Record<string, unknown>

/** Grupos/sections reais da Planilha de Campo, na ordem do documento */
export const FIELD_SHEET_CONFIG_GROUPS: readonly FieldSheetConfigGroup[] = [
  {
    key: 'header',
    label: 'CABEÇALHO E CONDIÇÕES DO DIA',
    description: 'Clima e pluviometria padrão para esta área',
    fields: [
      {
        key: 'weather',
        label: 'Clima',
        type: 'select',
        options: ['Ensolarado', 'Chuvoso', 'Instável', 'Outros'],
        placeholder: 'Selecione o clima padrão',
      },
      {
        key: 'pluviometer',
        label: 'Pluviômetro (mm)',
        type: 'text',
        placeholder: 'Ex.: 0 ou 12.5',
      },
    ],
  },
  {
    key: 'extraction',
    label: '1. EXTRAÇÃO/VOLUME BOMBEADO',
    description:
      'Poços de remediação com altura da bomba e saída do autopump. Adicione um poço por linha.',
    fields: [
      {
        key: 'morning_time',
        label: 'Hora da leitura (manhã)',
        type: 'time',
      },
      {
        key: 'afternoon_time',
        label: 'Hora da leitura (tarde)',
        type: 'time',
      },
    ],
  },
  {
    key: 'infiltration',
    label: '2. INFILTRAÇÃO/VOLUME INFILTRADO',
    description: 'Horários de medição e leitura inicial dos hidrômetros (Geral e Saídas).',
    fields: [
      {
        key: 'infiltration_morning_time',
        label: 'Hora da medição (manhã)',
        type: 'time',
      },
      {
        key: 'infiltration_afternoon_time',
        label: 'Hora da medição (tarde)',
        type: 'time',
      },
      {
        key: 'geralMorning',
        label: 'Hidrômetro Geral — manhã',
        type: 'number',
        placeholder: '0,00',
      },
      {
        key: 'geralAfternoon',
        label: 'Hidrômetro Geral — tarde',
        type: 'number',
        placeholder: '0,00',
      },
    ],
  },
  {
    key: 'nutrients',
    label: '3. DOSAGEM DE NUTRIENTES',
    description: 'Controle de realização da dosagem e pesagem de MAP e Ureia',
    fields: [
      {
        key: 'nutrient_done',
        label: 'Realizada (S/N)',
        type: 'toggle',
      },
      {
        key: 'nutrient_map_kg',
        label: 'Quantidade MAP (Kg)',
        type: 'text',
        placeholder: 'Ex.: 10 ou 1.250,5',
      },
      {
        key: 'nutrient_ureia_kg',
        label: 'Quantidade Ureia (Kg)',
        type: 'text',
        placeholder: 'Ex.: 10 ou 1.250,5',
      },
    ],
  },
  {
    key: 'compressors',
    label: '4. COMPRESSORES',
    description:
      'Parâmetros operacionais padronizados por compressor (horímetro, pressão, drenagem, tempo desligado, filtros e óleo).',
    fields: [],
  },
  {
    key: 'oil_removal',
    label: '5. REMOÇÃO DE ÓLEO',
    description: 'Caixas separadoras de água e óleo SAO 01 e SAO 02',
    fields: [
      {
        key: 'sao1Volume',
        label: 'SAO 01 — Volume de óleo removido (mL)',
        type: 'text',
        placeholder: 'Ex.: 0',
      },
      {
        key: 'sao1DataLimpeza',
        label: 'SAO 01 — Data da última limpeza',
        type: 'date',
        placeholder: 'DD/MM/AAAA',
      },
      {
        key: 'sao2Volume',
        label: 'SAO 02 — Volume de óleo removido (mL)',
        type: 'text',
        placeholder: 'Ex.: 0',
      },
      {
        key: 'sao2DataLimpeza',
        label: 'SAO 02 — Data da última limpeza',
        type: 'date',
        placeholder: 'DD/MM/AAAA',
      },
    ],
  },
  {
    key: 'waste',
    label: '6. RESÍDUOS SÓLIDOS E LÍQUIDOS',
    description: 'Contagem de tambores para retirada',
    fields: [
      {
        key: 'waste_liquid_qty',
        label: 'Tambores para retirada — Líquido',
        type: 'text',
        placeholder: 'Ex.: 02 ou 2 tambores',
      },
      {
        key: 'waste_solid_qty',
        label: 'Tambores para retirada — Sólido',
        type: 'text',
        placeholder: 'Ex.: 01 ou 1 bombona',
      },
    ],
  },
  {
    key: 'env',
    label: '7. CONTROLES AMBIENTAIS E 5S',
    description: 'Verificação do programa 5S e checklist mensal',
    fields: [
      {
        key: 'env_5s_check',
        label: '5S (S/N)',
        type: 'toggle',
      },
      {
        key: 'env_checklist_monthly',
        label: 'Checklist mensal (S/N)',
        type: 'toggle',
      },
    ],
  },
  {
    key: 'observations',
    label: '8. OBSERVAÇÕES E MANUTENÇÕES',
    description: 'Registro livre de ocorrências e anotações operacionais',
    fields: [
      {
        key: 'observations',
        label: 'Observações',
        type: 'textarea',
        placeholder: 'Ex.: * Foi realizada a manutenção do PR-49.',
      },
    ],
  },
]

/** Linhas de parâmetros por compressor — mesmas da tabela da Planilha de Campo */
export const COMPRESSOR_PARAM_ROWS: ReadonlyArray<{
  label: string
  prefix: string
  type: FieldSheetConfigFieldType
  placeholder: string
}> = [
  { label: 'Horímetro (hr)', prefix: 'horimetro', type: 'text', placeholder: 'Ex.: 5448.81' },
  { label: 'Pressão (bar)', prefix: 'pressao', type: 'text', placeholder: 'Ex.: 6 bar' },
  { label: 'Drenagem de água (mL)', prefix: 'drenagem', type: 'text', placeholder: 'Ex.: 6 LTS' },
  { label: 'Tempo Desligado', prefix: 'tempoDesligado', type: 'text', placeholder: 'Ex.: 0 min' },
  {
    label: 'Troca do filtro de ar',
    prefix: 'filtroAr',
    type: 'text',
    placeholder: 'Ex.: OK / data',
  },
  { label: 'Nível de óleo', prefix: 'nivelOleo', type: 'text', placeholder: 'Ex.: OK' },
  {
    label: 'Troca de óleo e filtro (a cada 1000hrs)',
    prefix: 'trocaOleo',
    type: 'text',
    placeholder: 'Ex.: 6000HR',
  },
]

/** Chaves de data da Planilha de Campo (validação DD/MM/AAAA no salvamento) */
export const PRESET_DATE_KEYS = ['sao1DataLimpeza', 'sao2DataLimpeza'] as const

/** Quantidade de campos configurados (preenchidos) em um preset — para badges */
export function countConfiguredFields(preset: PresetFields | null | undefined): number {
  if (!preset || typeof preset !== 'object') return 0
  let count = 0
  for (const [key, value] of Object.entries(preset)) {
    if (key === 'wells' || key === 'infiltration_exits' || key === 'compressor_count') {
      if (Array.isArray(value) ? value.length > 0 : Number(value) > 0) count++
      continue
    }
    if (value === undefined || value === null) continue
    if (typeof value === 'boolean') {
      count++
      continue
    }
    if (String(value).trim() !== '') count++
  }
  return count
}
