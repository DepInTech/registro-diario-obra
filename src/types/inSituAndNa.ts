export interface InSituMeasurementRow {
  id: string
  date: string // DD/MM/AAAA ou ISO
  time: string // HH:mm
  ph: string
  conductivity: string
  conductivity_unit: string // Ex: µS/cm, mS/cm, etc. Visor do equipamento
  od_mg_l: string // OD obrigatoriamente rotulado e preenchido em mg/L
  temperature_c: string // ºC
  orp: string // mV
  turbidity: 'Sim' | 'Não' | '' // Sim/Não conforme planilha física
  weather: string // Ensolarado, Chuvoso, Instável, ou texto livre se Outros
  responsible: string // Responsável pelas medições
  nutrients_in: string // T. Nutrientes - Entrada
  nutrients_out: string // T. Nutrientes - Saída
  notes?: string
}

export interface InSituSheet {
  id: string
  project_name: string
  system_name: string // Ex: Sistema 1, Sistema 2, etc. (modelo padronizado para os quatro sistemas)
  active_number: string // Número ativo
  measurement_point: string // Ponto de medição
  records: InSituMeasurementRow[]
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
  area_name: string
  description?: string
  wells: NaAreaWellConfig[]
  active?: boolean
  created?: string
  updated?: string
}

export interface NaWellReadingRow {
  well_code: string // Ex: PM-03 (bloqueado durante o preenchimento pelo operador)
  na_m: string // NA (m)
  no_m: string // NO (m)
  observation: string // Observação
}

export interface NaSheet {
  id: string
  area_name: string // Área selecionada pelo usuário que carrega os poços da config
  date: string // DD/MM/AAAA ou ISO
  weather: string // Ensolarado, Chuvoso, Instável, ou texto livre se Outros
  responsible_name: string
  readings: NaWellReadingRow[] // Linhas de poços correspondentes à área
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  notes?: string
  client_token?: string
  archived?: boolean
  created?: string
  updated?: string
  syncStatus?: 'synced' | 'pending_create' | 'pending_update' | 'failed'
}
