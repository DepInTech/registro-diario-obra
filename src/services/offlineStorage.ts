// IndexedDB Storage Service for offline-first EPA operations
const DB_NAME = 'epa_offline_db'
const DB_VERSION = 3

export interface OfflineRdoItem {
  id: string
  number?: number
  projectId: string
  projectName: string
  clientName?: string
  contractCode?: string
  location?: string
  companyName?: string
  reportDate: string
  weather: string
  performedBy: string
  performedByName?: string
  supervisedBy?: string
  supervisedByName?: string
  activityTitle: string
  activityDescription: string
  timeDisplacement?: string
  timeWaiting?: string
  interferences?: string
  planChanges?: string
  accidents?: string
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  reviewNotes?: string
  returned_fields?: string[]
  returnedByName?: string
  returnedAt?: string
  submittedAt?: string
  approvedAt?: string
  createdAt?: string
  serverCreatedAt?: string
  change_history?: any[] // Lista de ReturnCycle
  archived?: boolean
  deleted?: boolean
  deletedReason?: string
  deletedBy?: string
  deletedByName?: string
  deletedAt?: string
  wells: Array<{
    id?: string
    well_id: string
    depth?: number | string
    completion_date?: string
    diameter?: string
  }>
  photos: Array<{
    id?: string
    image?: string
    caption: string
    order: number
    dataUrl?: string // base64 or blob URL stored locally
    category?: 'general' | 'field_inspection'
  }>
  fieldPhoto?: {
    id?: string
    image?: string
    caption?: string
    dataUrl?: string
  }
  admin_snapshot?: {
    supervised_by_name?: string
    supervised_by?: string
    empresa_executora?: string
    wells?: Array<{
      id?: string
      well_id: string
      depth?: number | string
      completion_date?: string
      diameter?: string
    }>
    captured_at?: string
    [key: string]: any
  }
  client_token?: string
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'conflict' | 'failed'
  syncError?: string
  syncAttempts?: number
  nextAttemptAt?: number
  lastSyncAttemptAt?: number
  lastModified: number
  serverUpdatedAt?: string
}

export interface OfflineFieldSheetItem {
  id: string
  number?: number
  projectId: string
  projectName: string
  clientName?: string
  contractCode?: string
  date: string
  area: string
  operator: string
  operatorName?: string
  assigned_technicians?: string[]
  weather?: string
  pluviometer?: number | string
  morning_time?: string
  afternoon_time?: string
  infiltration_morning_time?: string
  infiltration_afternoon_time?: string
  extraction_data?: Array<{
    well: string
    morning: string
    morning_time?: string
    afternoon: string
    afternoon_time?: string
    pump: string
    autopump: string
    autopump_condition?: string
    autopump_condition_other?: string
  }>
  infiltration_data?: Record<string, string>
  nutrient_done?: boolean
  nutrient_map_kg?: number | string
  nutrient_ureia_kg?: number | string
  compressor_data?: Record<string, string>
  oil_removal_data?: Record<string, string>
  waste_liquid_qty?: string | number
  waste_solid_qty?: string | number
  env_5s_check?: boolean
  env_checklist_monthly?: boolean
  observations?: string
  status: 'draft' | 'submitted' | 'approved' | 'returned'
  reviewNotes?: string
  returned_fields?: string[]
  returnedByName?: string
  returnedAt?: string
  submittedAt?: string
  approvedAt?: string
  createdAt?: string
  serverCreatedAt?: string
  change_history?: any[] // Lista de ReturnCycle
  archived?: boolean
  deleted?: boolean
  deletedReason?: string
  deletedBy?: string
  deletedByName?: string
  deletedAt?: string
  admin_snapshot?: {
    technician_name?: string
    operator?: string
    pump_height?: string | number
    wells?: Array<{
      well: string
      pump?: string
      [key: string]: any
    }>
    captured_at?: string
    [key: string]: any
  }
  client_token?: string
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'conflict' | 'failed'
  syncError?: string
  syncAttempts?: number
  nextAttemptAt?: number
  lastSyncAttemptAt?: number
  lastModified: number
  serverUpdatedAt?: string
}

export interface OfflineProjectItem {
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
  rawClient?: string
  rawContract?: string
  rawCompany?: string
  rawArea?: string
  assignedUsersIds?: string[]
  archived?: boolean
  deleted?: boolean
  deletedReason?: string
  deletedBy?: string
  deletedByName?: string
  deletedAt?: string
  base_sheet_rdo?: any
  base_sheet_field?: any
  base_sheet_published?: boolean
  base_sheet_updated_at?: string
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'conflict' | 'failed'
  syncError?: string
  syncAttempts?: number
  nextAttemptAt?: number
  lastSyncAttemptAt?: number
  lastModified: number
  serverUpdatedAt?: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('rdos')) {
        const rdoStore = db.createObjectStore('rdos', { keyPath: 'id' })
        rdoStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        rdoStore.createIndex('projectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains('field_sheets')) {
        const fieldStore = db.createObjectStore('field_sheets', { keyPath: 'id' })
        fieldStore.createIndex('syncStatus', 'syncStatus', { unique: false })
        fieldStore.createIndex('projectId', 'projectId', { unique: false })
      }
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' })
        projectStore.createIndex('syncStatus', 'syncStatus', { unique: false })
      }
      if (!db.objectStoreNames.contains('wells')) {
        const wellsStore = db.createObjectStore('wells', { keyPath: 'projectId' })
        wellsStore.createIndex('projectId', 'projectId', { unique: true })
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const offlineStorage = {
  // RDOs
  async saveRdo(rdo: OfflineRdoItem): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readwrite')
      const store = tx.objectStore('rdos')
      const req = store.put(rdo)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getRdo(id: string): Promise<OfflineRdoItem | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readonly')
      const store = tx.objectStore('rdos')
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  },

  async getAllRdos(): Promise<OfflineRdoItem[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readonly')
      const store = tx.objectStore('rdos')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  },

  async deleteRdo(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readwrite')
      const store = tx.objectStore('rdos')
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async deleteRdosByProject(projectId: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readwrite')
      const store = tx.objectStore('rdos')
      const index = store.index('projectId')
      const req = index.openKeyCursor(IDBKeyRange.only(projectId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })
  },

  // Field Sheets
  async saveFieldSheet(sheet: OfflineFieldSheetItem): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readwrite')
      const store = tx.objectStore('field_sheets')
      const req = store.put(sheet)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getFieldSheet(id: string): Promise<OfflineFieldSheetItem | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readonly')
      const store = tx.objectStore('field_sheets')
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  },

  async getAllFieldSheets(): Promise<OfflineFieldSheetItem[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readonly')
      const store = tx.objectStore('field_sheets')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  },

  async deleteFieldSheet(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readwrite')
      const store = tx.objectStore('field_sheets')
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async deleteFieldSheetsByProject(projectId: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readwrite')
      const store = tx.objectStore('field_sheets')
      const index = store.index('projectId')
      const req = index.openKeyCursor(IDBKeyRange.only(projectId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          store.delete(cursor.primaryKey)
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })
  },

  async clearAllRdos(): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rdos', 'readwrite')
      const store = tx.objectStore('rdos')
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async clearAllFieldSheets(): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('field_sheets', 'readwrite')
      const store = tx.objectStore('field_sheets')
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  // Wells Cache by Project
  async saveProjectWells(projectId: string, wells: any[]): Promise<void> {
    if (!projectId) return
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('wells', 'readwrite')
      const store = tx.objectStore('wells')
      const req = store.put({ projectId, wells, updatedAt: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getProjectWells(projectId: string): Promise<any[]> {
    if (!projectId) return []
    try {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction('wells', 'readonly')
        const store = tx.objectStore('wells')
        const req = store.get(projectId)
        req.onsuccess = () => {
          const res = req.result
          resolve(res && Array.isArray(res.wells) ? res.wells : [])
        }
        req.onerror = () => reject(req.error)
      })
    } catch (err) {
      console.warn('Error reading project wells from IndexedDB:', err)
      return []
    }
  },

  // Projects
  async saveProject(project: OfflineProjectItem): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite')
      const store = tx.objectStore('projects')
      const req = store.put(project)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getProject(id: string): Promise<OfflineProjectItem | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly')
      const store = tx.objectStore('projects')
      const req = store.get(id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  },

  async getAllProjects(): Promise<OfflineProjectItem[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readonly')
      const store = tx.objectStore('projects')
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  },

  async deleteProject(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite')
      const store = tx.objectStore('projects')
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  // General Cache
  async setCache(key: string, data: unknown): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite')
      const store = tx.objectStore('cache')
      const req = store.put({ key, data, timestamp: Date.now() })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  },

  async getCache<T>(key: string): Promise<T | null> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readonly')
      const store = tx.objectStore('cache')
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result ? (req.result.data as T) : null)
      req.onerror = () => reject(req.error)
    })
  },

  /**
   * Executa a purga de zeragem operacional no IndexedDB local.
   * Regras:
   * 1. Remove qualquer RDO ou Planilha cujo updatedAt/lastModified seja anterior a wipeTimestamp.
   * 2. Remove QUALQUER registro sincronizado (syncStatus === 'synced' ou ID real de servidor)
   *    que não exista mais no servidor (se knownServerIds for fornecido ou se o servidor estiver vazio).
   * 3. PRESERVA rascunhos locais pendentes (pending_create / pending_update) criados/modificados
   *    DEPOIS da data de zeragem.
   * 4. Remove artefatos dependentes de registros descartados (report_wells, report_photos, etc.).
   */
  /**
   * Remove registros com IDs provisórios inválidos / órfãos e limpa rascunhos travados.
   */
  async purgeInvalidOrStuckDrafts(): Promise<{ purgedRdos: number; purgedSheets: number }> {
    const isPbId = (id: string) => /^[a-z0-9]{15}$/.test(id)
    const [rdos, sheets] = await Promise.all([this.getAllRdos(), this.getAllFieldSheets()])
    let purgedRdos = 0
    let purgedSheets = 0

    for (const r of rdos) {
      const isFailedOrExhausted = r.syncStatus === 'failed' || (r.syncAttempts || 0) >= 3
      const isExclusionMessage =
        r.syncError &&
        (r.syncError.includes('excluído') ||
          r.syncError.includes('excluido') ||
          r.syncError.includes('não existe mais') ||
          r.syncError.includes('Registro não encontrado no servidor') ||
          r.syncError.includes('404'))

      // Remove rascunhos provisórios falhados e registros excluídos no servidor ou marcados deleted=true
      if (
        (!isPbId(r.id) && isFailedOrExhausted) ||
        r.deleted ||
        (isFailedOrExhausted && isExclusionMessage)
      ) {
        await this.deleteRdo(r.id)
        purgedRdos++
      }
    }

    for (const s of sheets) {
      const isFailedOrExhausted = s.syncStatus === 'failed' || (s.syncAttempts || 0) >= 3
      const isExclusionMessage =
        s.syncError &&
        (s.syncError.includes('excluído') ||
          s.syncError.includes('excluido') ||
          s.syncError.includes('não existe mais') ||
          s.syncError.includes('Registro não encontrado no servidor') ||
          s.syncError.includes('404'))

      // Inclui expressamente o órfão travado field_1790364259892 e planilhas excluídas no servidor ou marcadas deleted=true
      if (
        s.id === 'field_1790364259892' ||
        (!isPbId(s.id) && isFailedOrExhausted) ||
        s.deleted ||
        (isFailedOrExhausted && isExclusionMessage)
      ) {
        await this.deleteFieldSheet(s.id)
        purgedSheets++
      }
    }

    return { purgedRdos, purgedSheets }
  },

  /**
   * Descarta todos os itens que estejam atualmente em estado 'failed' no IndexedDB.
   */
  async discardAllFailedItems(): Promise<{
    discardedRdos: number
    discardedSheets: number
    discardedProjects: number
  }> {
    const [rdos, sheets, projects] = await Promise.all([
      this.getAllRdos(),
      this.getAllFieldSheets(),
      this.getAllProjects(),
    ])

    let discardedRdos = 0
    for (const r of rdos) {
      if (r.syncStatus === 'failed') {
        await this.deleteRdo(r.id)
        discardedRdos++
      }
    }

    let discardedSheets = 0
    for (const s of sheets) {
      if (s.syncStatus === 'failed') {
        await this.deleteFieldSheet(s.id)
        discardedSheets++
      }
    }

    let discardedProjects = 0
    for (const p of projects) {
      if (p.syncStatus === 'failed') {
        await this.deleteProject(p.id)
        discardedProjects++
      }
    }

    return { discardedRdos, discardedSheets, discardedProjects }
  },

  async purgePreWipeOperationalData(
    wipeTimestamp: number,
    options?: {
      purgeAllSynced?: boolean
      knownServerRdoIds?: Set<string>
      knownServerSheetIds?: Set<string>
      forcePurgeAll?: boolean
    },
  ): Promise<{ purgedRdos: number; purgedSheets: number }> {
    // CORREÇÃO 2 (fail-safe): sem referência temporal de servidor válida, o purge
    // NÃO apaga nada — nunca confiar no relógio do dispositivo.
    const isFiniteWipe = Number.isFinite(wipeTimestamp) && wipeTimestamp > 0
    if (!isFiniteWipe && !options?.forcePurgeAll) {
      console.warn(
        '[purgePreWipeOperationalData] wipeTimestamp inválido/ausente — purge abortado (fail-safe).',
      )
      return { purgedRdos: 0, purgedSheets: 0 }
    }

    const [rdos, sheets] = await Promise.all([this.getAllRdos(), this.getAllFieldSheets()])

    const UNTOUCHABLE_STATUSES = ['pending_create', 'pending_update', 'conflict']

    let purgedRdos = 0
    for (const r of rdos) {
      if (options?.forcePurgeAll) {
        await this.deleteRdo(r.id)
        purgedRdos++
        continue
      }

      // Data de referência do item: timestamp numérico de lastModified ou serverUpdatedAt
      // CORREÇÃO 2: QUALQUER item pendente (pending_create/pending_update/conflict/failed sem
      // limite de tentativas) é INTOCÁVEL pelo purge, INDEPENDENTE de timestamp — o relógio do
      // dispositivo pode estar atrasado e faria isPendingPostWipe classificar pendências
      // novas como "pré-zeragem", apagando dados nunca enviados ao servidor.
      const UNTOUCHABLE_STATUSES = ['pending_create', 'pending_update', 'conflict']
      const isUntouchable =
        UNTOUCHABLE_STATUSES.includes(r.syncStatus) ||
        (r.syncStatus === 'failed' && (r.syncAttempts || 0) < 3) ||
        !r.syncStatus
      if (isUntouchable) continue

      // Apenas itens confirmadamente sincronizados podem ser alvo do purge.
      const isSynced = r.syncStatus === 'synced'
      if (!isSynced) continue

      const itemTimestamp = Math.max(
        r.lastModified || 0,
        r.serverUpdatedAt ? new Date(r.serverUpdatedAt).getTime() : 0,
      )

      const isOlderThanWipe = itemTimestamp <= wipeTimestamp
      const notOnServer = options?.knownServerRdoIds
        ? !options.knownServerRdoIds.has(r.id)
        : options?.purgeAllSynced

      if (isOlderThanWipe || notOnServer) {
        await this.deleteRdo(r.id)
        purgedRdos++
      }
    }

    let purgedSheets = 0
    for (const s of sheets) {
      if (options?.forcePurgeAll) {
        await this.deleteFieldSheet(s.id)
        purgedSheets++
        continue
      }

      const isUntouchable =
        UNTOUCHABLE_STATUSES.includes(s.syncStatus) ||
        (s.syncStatus === 'failed' && (s.syncAttempts || 0) < 3) ||
        !s.syncStatus
      if (isUntouchable) continue

      // Apenas itens confirmadamente sincronizados podem ser alvo do purge.
      const isSynced = s.syncStatus === 'synced'
      if (!isSynced) continue

      const itemTimestamp = Math.max(
        s.lastModified || 0,
        s.serverUpdatedAt ? new Date(s.serverUpdatedAt).getTime() : 0,
      )

      const isOlderThanWipe = itemTimestamp <= wipeTimestamp
      const notOnServer = options?.knownServerSheetIds
        ? !options.knownServerSheetIds.has(s.id)
        : options?.purgeAllSynced

      if (isOlderThanWipe || notOnServer) {
        await this.deleteFieldSheet(s.id)
        purgedSheets++
      }
    }

    return { purgedRdos, purgedSheets }
  },
}
