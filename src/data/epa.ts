export type Role = 'admin' | 'technician'
export type Status = 'draft' | 'submitted' | 'approved' | 'returned'

export interface EpaProject {
  id: string
  name: string
  client: string
  code: string
  location: string
  status: 'active' | 'paused' | 'completed'
  progress: number
  contract: string
  company?: string
  area?: string
  team: string[]
}

export interface EpaRdo {
  id: string
  number: number
  projectId: string
  project: string
  date: string
  activity: string
  description: string
  weather: string
  status: Status
  operator: string
  technician: string
  wells: number
  photos: number
  updated: string
  reviewNotes?: string
}

export interface FieldSheet {
  id: string
  projectId: string
  project: string
  date: string
  area: string
  status: Status
  extraction: number
  map: number
  urea: number
  liquidWaste: number
  environment: boolean
  operator: string
}

// Dados estáticos removidos (v0.0.180): nenhum usuário/projeto fictício.
// Todas as telas passam a exibir apenas dados reais do banco (coleções PocketBase).
export const projects: EpaProject[] = []

export const rdos: EpaRdo[] = []

export const fieldSheets: FieldSheet[] = []

export const auditEvents: {
  id: string
  user: string
  initials: string
  action: string
  entity: string
  time: string
  color: string
}[] = []

export const users: {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  projects: number
}[] = []

export const statusLabel: Record<Status, string> = {
  draft: 'Em preenchimento',
  submitted: 'Enviado para aprovação',
  approved: 'Aprovado',
  returned: 'Devolvida para correção',
}
