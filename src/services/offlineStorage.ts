// IndexedDB Storage Service for offline-first EPA operations
const DB_NAME = 'epa_offline_db'
const DB_VERSION = 1

export interface OfflineRdoItem {
  id: string
  number: number
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
  }>
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'conflict'
  lastModified: number
  serverUpdatedAt?: string
}

export interface OfflineFieldSheetItem {
  id: string
  projectId: string
  projectName: string
  date: string
  area: string
  operator: string
  operatorName?: string
  weather?: string
  pluviometer?: number
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
  }>
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
  reviewNotes?: string
  syncStatus: 'synced' | 'pending_create' | 'pending_update' | 'conflict'
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
}
