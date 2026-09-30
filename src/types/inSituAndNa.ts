export interface InSituNutrientPair {
  entry: string // T. NUTRIENTES - ENTRADA
  exit: string // T. NUTRIENTES - SAÍDA
  total?: string // T. NUTRIENTES (opcional para compatibilidade)
}

/**
 * Linha da seção inferior de Nutrientes, alinhada com as colunas da tabela principal.
 * Conforme o layout do papel oficial:
 * Coluna da esquerda: rótulo da sequência repetida 4x (ENTRADA, SAÍDA, T. NUTRIENTES)
 * Demais colunas: células de input com as mesmas medições da tabela principal.
 */
export interface InSituNutrientRowData {
  id: string
  type: 'ENTRADA' | 'SAÍDA' | 'T. NUTRIENTES'
  system_index: number // 0, 1, 2, 3 (Sistemas 1 a 4)
  date?: string
  time?: string
  ph?: string
  conductivity?: string
  conductivity_unit?: string
  od_mg_l?: string
  temperature_c?: string
  orp?: string
  turbidity?: 'Sim' | 'Não' | ''
  weather?: string
  responsible?: string
  notes?: string
}

export interface InSituMeasurementRow {
  id: string
  point?: string // Ponto de medição específico da linha (opcional/legado)
  date: string // DD/MM/AAAA ou ISO
  time: string // HORA (HH:mm)
  ph: string // pH
  conductivity: string // Cond. (valor numérico no visor)
  conductivity_unit: string // Ex: µS/cm, mS/cm, etc. Anote sempre a unidade do visor!
  od_mg_l: string // OD (mg/L) obrigatoriamente rotulado e preenchido em mg/L (NUNCA em %)
  temperature_c: string // Temp. (ºC)
  orp: string // ORP (mV)
  turbidity: 'Sim' | 'Não' | '' // TURVA (sim/não) conforme modelo físico
  weather: string // CLIMA (Ensolarado, Chuvoso, Instável, ou texto livre)
  responsible: string // RESPONSÁVEL PELAS MEDIÇÕES
  // 4 blocos legados de T. NUTRIENTES (ENTRADA / SAÍDA) correspondentes aos 4 sistemas
  nutrients?: InSituNutrientPair[] // [Sistema 1, Sistema 2, Sistema 3, Sistema 4]
  // Compatibilidade retroativa
  nutrients_in?: string
  nutrients_out?: string
  notes?: string
}

export interface InSituSheet {
  id: string
  project_name: string // PROJETO:
  system_name: string // SISTEMA:
  active_number: string // NÚMERO ATIVO:
  measurement_point: string // PONTO DE MEDIÇÃO
  records: InSituMeasurementRow[]
  // Seção inferior de Nutrientes em Linhas (12 linhas: ENTRADA/SAÍDA/T. NUTRIENTES x 4 sistemas)
  nutrient_rows?: InSituNutrientRowData[]
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  responsible_name?: string
  notes?: string
  client_token?: string
  archived?: boolean
  created?: string
  updated?: string
  syncStatus?: 'synced' | 'pending_create' | 'pending_update' | 'failed'
}

export interface NaAreaWellConfig {
  code: string // Ex: PM-03, PR-01
  notes?: string
}

export interface NaAreaConfig {
  id: string
  area_name: string // Local / Área
  contract_number?: string // Nº do Contrato (opcional)
  description?: string
  wells: NaAreaWellConfig[]
  active?: boolean
  created?: string
  updated?: string
}

export interface NaWellReadingRow {
  well_code: string // Poço (bloqueado durante o preenchimento pelo operador)
  na_m: string // NA (m)
  no_m: string // NO (m)
  observation: string // Obs.
}

export interface NaSheet {
  id: string
  contract_number?: string // Linha própria de CONTRATO
  area_name: string // Local / Área
  date: string // DATA:
  weather: string // Clima:
  responsible_name: string
  readings: NaWellReadingRow[] // Linhas de poços correspondentes à área
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  notes?: string // Observações (campo amplo de rodapé)
  client_token?: string
  archived?: boolean
  created?: string
  updated?: string
  syncStatus?: 'synced' | 'pending_create' | 'pending_update' | 'failed'
}
