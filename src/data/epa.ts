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

export const projects: EpaProject[] = [
  {
    id: 'u6c77idn7hfi13c',
    name: 'Acompanhamento Ambiental Açailândia',
    client: 'Saneamento Industrial do Maranhão',
    code: 'EPA-ACL-03',
    location: 'Açailândia — MA',
    status: 'active',
    progress: 68,
    contract: 'CT-2025-003',
    team: ['Carlos Oliveira', 'Marina Santos', 'Annik Almeida'],
  },
  {
    id: 'epa-rsl-a01',
    name: 'Recuperação Ambiental Lote A',
    client: 'Petrobras — Refinaria Sul',
    code: 'EPA-RSL-A01',
    location: 'Refinaria Sul — Área Industrial',
    status: 'active',
    progress: 42,
    contract: 'CT-EPA-2025-017',
    team: ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
  },
  {
    id: 'epa-ita-08',
    name: 'Monitoramento Hidrogeológico',
    client: 'Porto de Itaqui',
    code: 'EPA-ITA-08',
    location: 'São Luís — MA',
    status: 'active',
    progress: 81,
    contract: 'CT-2024-028',
    team: ['Marina Santos', 'João Viana'],
  },
  {
    id: 'epa-sao-12',
    name: 'Operação do Sistema de Remediação',
    client: 'Terminal Norte',
    code: 'EPA-SAO-12',
    location: 'São José de Ribamar — MA',
    status: 'paused',
    progress: 29,
    contract: 'CT-2025-012',
    team: ['Carlos Oliveira', 'Rafael Luz'],
  },
]

export const rdos: EpaRdo[] = [
  {
    id: 'icmv2jdx339uh6k',
    number: 3,
    projectId: 'u6c77idn7hfi13c',
    project: 'Acompanhamento Ambiental Açailândia',
    date: '27 mai 2025',
    activity: 'Tamponamento de poços de monitoramento',
    description:
      'Execução dos serviços de tamponamento dos poços PB-37, PB-38, PB-39 e PB-40, conforme plano de trabalho aprovado.',
    weather: 'Sol',
    status: 'submitted',
    operator: 'Carlos Oliveira',
    technician: 'Marina Santos',
    wells: 4,
    photos: 8,
    updated: 'há 18 min',
  },
  {
    id: 'rdo-128',
    number: 128,
    projectId: 'epa-rsl-a01',
    project: 'Recuperação Ambiental Lote A',
    date: '28 mai 2025',
    activity: 'Operação do sistema de extração',
    description:
      'Monitoramento de vazão, leitura de hidrômetros e ajuste das bombas pneumáticas nos poços PZ-01 e PZ-02.',
    weather: 'Nublado',
    status: 'returned',
    operator: 'Carlos Oliveira',
    technician: 'Marina Santos',
    wells: 2,
    photos: 4,
    updated: 'há 1h',
    reviewNotes: 'Conferir profundidade do PZ-02 e incluir foto do hidrômetro final.',
  },
  {
    id: 'rdo-127',
    number: 127,
    projectId: 'epa-rsl-a01',
    project: 'Recuperação Ambiental Lote A',
    date: '27 mai 2025',
    activity: 'Injeção de nutrientes',
    description:
      'Dosagem controlada de MAP e ureia na área de tratamento biológico, sem intercorrências.',
    weather: 'Sol',
    status: 'approved',
    operator: 'Carlos Oliveira',
    technician: 'Marina Santos',
    wells: 3,
    photos: 6,
    updated: 'ontem',
  },
  {
    id: 'rdo-126',
    number: 126,
    projectId: 'epa-ita-08',
    project: 'Monitoramento Hidrogeológico',
    date: '26 mai 2025',
    activity: 'Coleta de amostras de água',
    description: 'Coleta e acondicionamento de amostras em cinco poços para análise laboratorial.',
    weather: 'Instável',
    status: 'draft',
    operator: 'João Viana',
    technician: 'Marina Santos',
    wells: 5,
    photos: 3,
    updated: 'há 2h',
  },
]

export const fieldSheets: FieldSheet[] = [
  {
    id: 'i68h8tha4o91vhg',
    projectId: 'u6c77idn7hfi13c',
    project: 'Acompanhamento Ambiental Açailândia',
    date: '27 mai 2025',
    area: 'Área de Remediação',
    status: 'submitted',
    extraction: 130,
    map: 15,
    urea: 8,
    liquidWaste: 2,
    environment: true,
    operator: 'Carlos Oliveira',
  },
  {
    id: 'field-0528',
    projectId: 'epa-rsl-a01',
    project: 'Recuperação Ambiental Lote A',
    date: '28 mai 2025',
    area: 'Lote A — Setor Leste',
    status: 'returned',
    extraction: 184,
    map: 18,
    urea: 9,
    liquidWaste: 4.2,
    environment: false,
    operator: 'Carlos Oliveira',
  },
  {
    id: 'field-0527',
    projectId: 'epa-rsl-a01',
    project: 'Recuperação Ambiental Lote A',
    date: '27 mai 2025',
    area: 'Lote A — Setor Leste',
    status: 'approved',
    extraction: 172,
    map: 16,
    urea: 8,
    liquidWaste: 2.8,
    environment: true,
    operator: 'Carlos Oliveira',
  },
  {
    id: 'field-0526',
    projectId: 'epa-ita-08',
    project: 'Monitoramento Hidrogeológico',
    date: '26 mai 2025',
    area: 'Pátio Norte',
    status: 'draft',
    extraction: 96,
    map: 12,
    urea: 6,
    liquidWaste: 1.4,
    environment: true,
    operator: 'João Viana',
  },
]

export const auditEvents = [
  {
    id: 'a1',
    user: 'Marina Santos',
    initials: 'MS',
    action: 'enviou o RDO Nº 3 para aprovação',
    entity: 'Acompanhamento Ambiental Açailândia',
    time: 'há 18 min',
    color: 'emerald',
  },
  {
    id: 'a2',
    user: 'Annik Almeida',
    initials: 'AA',
    action: 'devolveu o RDO Nº 128 para correção',
    entity: 'Recuperação Ambiental Lote A',
    time: 'há 1h',
    color: 'amber',
  },
  {
    id: 'a3',
    user: 'Carlos Oliveira',
    initials: 'CO',
    action: 'atualizou a Planilha de Campo',
    entity: 'Lote A — Setor Leste',
    time: 'há 2h',
    color: 'blue',
  },
  {
    id: 'a4',
    user: 'Annik Almeida',
    initials: 'AA',
    action: 'aprovou o RDO Nº 127',
    entity: 'Recuperação Ambiental Lote A',
    time: 'ontem, 17:42',
    color: 'emerald',
  },
  {
    id: 'a5',
    user: 'Marina Santos',
    initials: 'MS',
    action: 'adicionou 5 registros de poços',
    entity: 'Monitoramento Hidrogeológico',
    time: 'ontem, 15:08',
    color: 'slate',
  },
]

export const users = [
  {
    id: 'mb059ge3zci2tzr',
    name: 'Annik Almeida',
    email: 'annik_almeida@grupoepa.com.br',
    role: 'admin' as Role,
    active: true,
    projects: 4,
  },
  {
    id: '2n6he1v3guzt3yt',
    name: 'Marina Santos',
    email: 'tecnico@grupoepa.com.br',
    role: 'technician' as Role,
    active: true,
    projects: 4,
  },
  {
    id: 'cfpekk93zx4j1pr',
    name: 'Carlos Oliveira',
    email: 'carlos.oliveira@grupoepa.com.br',
    role: 'technician' as Role,
    active: true,
    projects: 3,
  },
  {
    id: 'user-04',
    name: 'João Viana',
    email: 'joao.viana@grupoepa.com.br',
    role: 'technician' as Role,
    active: true,
    projects: 1,
  },
]

export const statusLabel: Record<Status, string> = {
  draft: 'Em preenchimento',
  submitted: 'Enviado para aprovação',
  approved: 'Aprovado',
  returned: 'Devolvida para correção',
}
