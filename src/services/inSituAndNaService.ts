import pb from '@/lib/pocketbase/client'
import type { InSituSheet, NaAreaConfig, NaSheet } from '@/types/inSituAndNa'
import { offlineStorage } from '@/services/offlineStorage'

const IN_SITU_CACHE_KEY = 'in_situ_sheets_cache'
const NA_CONFIGS_CACHE_KEY = 'na_area_configs_cache'
const NA_SHEETS_CACHE_KEY = 'na_sheets_cache'

export const inSituService = {
  async listSheets(): Promise<InSituSheet[]> {
    try {
      const records = await pb.collection('in_situ_sheets').getFullList<InSituSheet>({
        sort: '-created',
      })
      // Salva no cache offline
      await offlineStorage.setCache(IN_SITU_CACHE_KEY, records)
      return records
    } catch (err) {
      console.warn('Erro ao listar in_situ_sheets online, buscando do cache:', err)
      const cached = await offlineStorage.getCache<InSituSheet[]>(IN_SITU_CACHE_KEY)
      return cached || []
    }
  },

  async getSheetById(id: string): Promise<InSituSheet | null> {
    try {
      const record = await pb.collection('in_situ_sheets').getOne<InSituSheet>(id)
      return record
    } catch {
      const cachedList = await offlineStorage.getCache<InSituSheet[]>(IN_SITU_CACHE_KEY)
      return cachedList?.find((item) => item.id === id) || null
    }
  },

  async saveSheet(sheet: Partial<InSituSheet>): Promise<InSituSheet> {
    const payload = {
      project_name: sheet.project_name || '',
      system_name: sheet.system_name || '',
      active_number: sheet.active_number || '',
      measurement_point: sheet.measurement_point || '',
      records: sheet.records || [],
      nutrient_rows: sheet.nutrient_rows || [],
      status: sheet.status || 'draft',
      responsible_name: sheet.responsible_name || '',
      notes: sheet.notes || '',
      client_token:
        sheet.client_token || `insitu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      archived: sheet.archived ?? false,
    }

    try {
      let saved: InSituSheet
      if (sheet.id && !sheet.id.startsWith('local_')) {
        saved = await pb.collection('in_situ_sheets').update<InSituSheet>(sheet.id, payload)
      } else {
        saved = await pb.collection('in_situ_sheets').create<InSituSheet>(payload)
      }

      // Atualiza cache local
      const cached = (await offlineStorage.getCache<InSituSheet[]>(IN_SITU_CACHE_KEY)) || []
      const index = cached.findIndex(
        (item) => item.id === saved.id || (sheet.id && item.id === sheet.id),
      )
      if (index >= 0) {
        cached[index] = saved
      } else {
        cached.unshift(saved)
      }
      await offlineStorage.setCache(IN_SITU_CACHE_KEY, cached)

      return saved
    } catch (err) {
      console.warn(
        'Falha ao salvar in_situ_sheets online, gravando no cache com status pendente:',
        err,
      )
      const localId = sheet.id || `local_insitu_${Date.now()}`
      const localRecord: InSituSheet = {
        ...payload,
        id: localId,
        syncStatus: 'pending_create',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }

      const cached = (await offlineStorage.getCache<InSituSheet[]>(IN_SITU_CACHE_KEY)) || []
      const index = cached.findIndex((item) => item.id === localId)
      if (index >= 0) {
        cached[index] = localRecord
      } else {
        cached.unshift(localRecord)
      }
      await offlineStorage.setCache(IN_SITU_CACHE_KEY, cached)

      return localRecord
    }
  },

  async deleteSheet(id: string): Promise<void> {
    try {
      if (!id.startsWith('local_')) {
        await pb.collection('in_situ_sheets').delete(id)
      }
    } catch (err) {
      console.warn('Erro ao deletar in_situ_sheets online:', err)
    }

    const cached = (await offlineStorage.getCache<InSituSheet[]>(IN_SITU_CACHE_KEY)) || []
    const updated = cached.filter((item) => item.id !== id)
    await offlineStorage.setCache(IN_SITU_CACHE_KEY, updated)
  },
}

export const naConfigService = {
  async listConfigs(): Promise<NaAreaConfig[]> {
    try {
      const records = await pb.collection('na_area_configs').getFullList<NaAreaConfig>({
        sort: 'area_name',
      })
      await offlineStorage.setCache(NA_CONFIGS_CACHE_KEY, records)
      return records
    } catch (err) {
      console.warn('Erro ao listar na_area_configs online, buscando do cache:', err)
      const cached = await offlineStorage.getCache<NaAreaConfig[]>(NA_CONFIGS_CACHE_KEY)
      return cached || []
    }
  },

  async saveConfig(config: Partial<NaAreaConfig>): Promise<NaAreaConfig> {
    const payload = {
      area_name: config.area_name || '',
      contract_number: config.contract_number || '',
      description: config.description || '',
      wells: config.wells || [],
      active: config.active ?? true,
    }

    try {
      let saved: NaAreaConfig
      if (config.id && !config.id.startsWith('local_')) {
        saved = await pb.collection('na_area_configs').update<NaAreaConfig>(config.id, payload)
      } else {
        saved = await pb.collection('na_area_configs').create<NaAreaConfig>(payload)
      }

      const cached = (await offlineStorage.getCache<NaAreaConfig[]>(NA_CONFIGS_CACHE_KEY)) || []
      const index = cached.findIndex(
        (item) => item.id === saved.id || (config.id && item.id === config.id),
      )
      if (index >= 0) {
        cached[index] = saved
      } else {
        cached.push(saved)
      }
      await offlineStorage.setCache(NA_CONFIGS_CACHE_KEY, cached)
      return saved
    } catch (err) {
      console.warn('Falha ao salvar na_area_configs online, guardando em cache:', err)
      const localId = config.id || `local_naconfig_${Date.now()}`
      const localRecord: NaAreaConfig = {
        ...payload,
        id: localId,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
      const cached = (await offlineStorage.getCache<NaAreaConfig[]>(NA_CONFIGS_CACHE_KEY)) || []
      const index = cached.findIndex((item) => item.id === localId)
      if (index >= 0) {
        cached[index] = localRecord
      } else {
        cached.push(localRecord)
      }
      await offlineStorage.setCache(NA_CONFIGS_CACHE_KEY, cached)
      return localRecord
    }
  },

  async deleteConfig(id: string): Promise<void> {
    try {
      if (!id.startsWith('local_')) {
        await pb.collection('na_area_configs').delete(id)
      }
    } catch (err) {
      console.warn('Erro ao deletar na_area_configs online:', err)
    }

    const cached = (await offlineStorage.getCache<NaAreaConfig[]>(NA_CONFIGS_CACHE_KEY)) || []
    const updated = cached.filter((item) => item.id !== id)
    await offlineStorage.setCache(NA_CONFIGS_CACHE_KEY, updated)
  },
}

export const naSheetService = {
  async listSheets(): Promise<NaSheet[]> {
    try {
      const records = await pb.collection('na_sheets').getFullList<NaSheet>({
        sort: '-created',
      })
      await offlineStorage.setCache(NA_SHEETS_CACHE_KEY, records)
      return records
    } catch (err) {
      console.warn('Erro ao listar na_sheets online, buscando do cache:', err)
      const cached = await offlineStorage.getCache<NaSheet[]>(NA_SHEETS_CACHE_KEY)
      return cached || []
    }
  },

  async getSheetById(id: string): Promise<NaSheet | null> {
    try {
      const record = await pb.collection('na_sheets').getOne<NaSheet>(id)
      return record
    } catch {
      const cachedList = await offlineStorage.getCache<NaSheet[]>(NA_SHEETS_CACHE_KEY)
      return cachedList?.find((item) => item.id === id) || null
    }
  },

  async saveSheet(sheet: Partial<NaSheet>): Promise<NaSheet> {
    const payload = {
      contract_number: sheet.contract_number || '',
      area_name: sheet.area_name || '',
      date: sheet.date || '',
      weather: sheet.weather || '',
      responsible_name: sheet.responsible_name || '',
      readings: sheet.readings || [],
      status: sheet.status || 'draft',
      notes: sheet.notes || '',
      client_token:
        sheet.client_token || `na_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      archived: sheet.archived ?? false,
    }

    try {
      let saved: NaSheet
      if (sheet.id && !sheet.id.startsWith('local_')) {
        saved = await pb.collection('na_sheets').update<NaSheet>(sheet.id, payload)
      } else {
        saved = await pb.collection('na_sheets').create<NaSheet>(payload)
      }

      const cached = (await offlineStorage.getCache<NaSheet[]>(NA_SHEETS_CACHE_KEY)) || []
      const index = cached.findIndex(
        (item) => item.id === saved.id || (sheet.id && item.id === sheet.id),
      )
      if (index >= 0) {
        cached[index] = saved
      } else {
        cached.unshift(saved)
      }
      await offlineStorage.setCache(NA_SHEETS_CACHE_KEY, cached)
      return saved
    } catch (err) {
      console.warn('Falha ao salvar na_sheets online, guardando em cache:', err)
      const localId = sheet.id || `local_nasheet_${Date.now()}`
      const localRecord: NaSheet = {
        ...payload,
        id: localId,
        syncStatus: 'pending_create',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }

      const cached = (await offlineStorage.getCache<NaSheet[]>(NA_SHEETS_CACHE_KEY)) || []
      const index = cached.findIndex((item) => item.id === localId)
      if (index >= 0) {
        cached[index] = localRecord
      } else {
        cached.unshift(localRecord)
      }
      await offlineStorage.setCache(NA_SHEETS_CACHE_KEY, cached)
      return localRecord
    }
  },

  async deleteSheet(id: string): Promise<void> {
    try {
      if (!id.startsWith('local_')) {
        await pb.collection('na_sheets').delete(id)
      }
    } catch (err) {
      console.warn('Erro ao deletar na_sheets online:', err)
    }

    const cached = (await offlineStorage.getCache<NaSheet[]>(NA_SHEETS_CACHE_KEY)) || []
    const updated = cached.filter((item) => item.id !== id)
    await offlineStorage.setCache(NA_SHEETS_CACHE_KEY, updated)
  },
}
