import type { RecordModel } from 'pocketbase'

export type UserRole = 'admin' | 'operator' | 'technician'
export type EpaUser = RecordModel & {
  name: string
  email: string
  role: UserRole
  active: boolean
  avatar?: string
}
export type Client = RecordModel & { name: string; document?: string; contact?: string }
export type Company = RecordModel & { name: string; document?: string }
export type Area = RecordModel & { name: string; description?: string }
export type Contract = RecordModel & {
  code: string
  client: string
  company?: string
  start_date?: string
  end_date?: string
  status: 'active' | 'paused' | 'closed'
  expand?: { client?: Client; company?: Company }
}
export type Project = RecordModel & {
  name: string
  client: string
  contract: string
  company?: string
  area?: string
  location: string
  epa_code: string
  progress: number
  status: 'active' | 'paused' | 'completed'
  assigned_users?: string[]
  archived?: boolean
  expand?: {
    client?: Client
    contract?: Contract
    company?: Company
    area?: Area
    assigned_users?: EpaUser[]
  }
}
export type Well = RecordModel & {
  project?: string
  identification: string
  default_diameter?: string
  active: boolean
}
export type ReportWell = RecordModel & {
  report: string
  well_id: string
  depth?: number
  completion_date?: string
  diameter?: string
}
export type ReportPhoto = RecordModel & {
  report: string
  image: string
  caption: string
  order: number
  category?: 'general' | 'field_inspection'
}
export type RdoStatus = 'draft' | 'submitted' | 'approved' | 'returned'
export type ReportRdo = RecordModel & {
  number: number
  project: string
  report_date: string
  weather: string
  performed_by: string
  supervised_by?: string
  activity_title: string
  activity_description?: string
  location_map?: string
  time_displacement?: string
  time_waiting?: string
  interferences?: string
  plan_changes?: string
  accidents?: string
  status: RdoStatus
  review_notes?: string
  archived?: boolean
  deleted?: boolean
  deleted_reason?: string
  deleted_by?: string
  deleted_at?: string
  expand?: {
    project?: Project
    performed_by?: EpaUser
    supervised_by?: EpaUser
    deleted_by?: EpaUser
  }
}
export type ExtractionRow = {
  well: string
  morning: string
  morning_time?: string // retrocompatibilidade com registros legados
  afternoon: string
  afternoon_time?: string // retrocompatibilidade com registros legados
  pump: string
  autopump: string
}
export type FieldSheet = RecordModel & {
  project: string
  operator: string
  date: string
  area: string
  weather?: string
  pluviometer?: number
  morning_time?: string
  afternoon_time?: string
  infiltration_morning_time?: string
  infiltration_afternoon_time?: string
  extraction_data?: ExtractionRow[]
  infiltration_data?: Record<string, string>
  nutrient_done?: boolean
  nutrient_map_kg?: number
  nutrient_ureia_kg?: number
  compressor_data?: Record<string, string>
  oil_removal_data?: Record<string, string>
  waste_liquid_qty?: number
  waste_solid_qty?: number
  env_5s_check?: boolean
  env_checklist_monthly?: boolean
  observations?: string
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  archived?: boolean
  deleted?: boolean
  deleted_reason?: string
  deleted_by?: string
  deleted_at?: string
  expand?: {
    project?: Project
    operator?: EpaUser
    deleted_by?: EpaUser
  }
}
export type AuditLog = RecordModel & {
  actor?: string
  action: string
  entity: string
  entity_record?: string
  details?: Record<string, unknown>
  expand?: { actor?: EpaUser }
}

export type RdoDraft = {
  number: number
  project: string
  report_date: string
  weather: string
  performed_by: string
  supervised_by: string
  activity_title: string
  activity_description: string
  time_displacement: string
  time_waiting: string
  interferences: string
  plan_changes: string
  accidents: string
  status: RdoStatus
  location_map?: File
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  technician: 'Técnico',
}
export const statusLabels: Record<string, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  completed: 'Concluído',
  closed: 'Encerrado',
  draft: 'Rascunho',
  submitted: 'Em análise',
  approved: 'Aprovado',
  returned: 'Devolvido',
}
