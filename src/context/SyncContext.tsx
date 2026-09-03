import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import type { EpaUser } from '@/types/epa'
import { offlineStorage, OfflineRdoItem, OfflineFieldSheetItem } from '@/services/offlineStorage'
import { useToast } from '@/hooks/use-toast'

interface ConflictItem {
  id: string
  type: 'rdo' | 'field'
  localData: OfflineRdoItem | OfflineFieldSheetItem
  serverData: Record<string, unknown>
}

interface SyncContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  conflicts: ConflictItem[]
  syncNow: () => Promise<void>
  resolveConflict: (
    conflict: ConflictItem,
    resolution: 'keep_local' | 'keep_server',
  ) => Promise<void>
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  conflicts: [],
  syncNow: async () => {},
  resolveConflict: async () => {},
})

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const { toast } = useToast()

  const checkPending = useCallback(async () => {
    try {
      const rdos = await offlineStorage.getAllRdos()
      const fields = await offlineStorage.getAllFieldSheets()
      const pendingRdos = rdos.filter(
        (r) => r.syncStatus === 'pending_create' || r.syncStatus === 'pending_update',
      )
      const pendingFields = fields.filter(
        (f) => f.syncStatus === 'pending_create' || f.syncStatus === 'pending_update',
      )
      setPendingCount(pendingRdos.length + pendingFields.length)
    } catch {
      // ignore
    }
  }, [])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || !pb.authStore.isValid || isSyncing) return
    setIsSyncing(true)
    let syncedCount = 0

    try {
      // 1. Sync RDOs
      const rdos = await offlineStorage.getAllRdos()
      for (const rdo of rdos) {
        if (rdo.syncStatus === 'pending_create') {
          try {
            // Check if server already has this RDO or create
            const payload: Record<string, unknown> = {
              number: rdo.number,
              project: rdo.projectId,
              report_date: rdo.reportDate,
              weather: rdo.weather,
              performed_by: rdo.performedBy,
              supervised_by: rdo.supervisedBy || undefined,
              activity_title: rdo.activityTitle,
              activity_description: rdo.activityDescription,
              time_displacement: rdo.timeDisplacement || '',
              time_waiting: rdo.timeWaiting || '',
              interferences: rdo.interferences || '',
              plan_changes: rdo.planChanges || '',
              accidents: rdo.accidents || '',
              status: rdo.status,
              review_notes: rdo.reviewNotes || '',
            }
            const record = await pb.collection('reports_rdo').create(payload)

            // create wells
            for (const well of rdo.wells || []) {
              if (well.well_id) {
                await pb.collection('report_wells').create({
                  report: record.id,
                  well_id: well.well_id,
                  depth: well.depth ? Number(well.depth) : undefined,
                  completion_date: well.completion_date || undefined,
                  diameter: well.diameter || undefined,
                })
              }
            }

            // update local offline item to synced
            await offlineStorage.deleteRdo(rdo.id)
            rdo.id = record.id
            rdo.syncStatus = 'synced'
            rdo.serverUpdatedAt = record.updated
            await offlineStorage.saveRdo(rdo)
            syncedCount++
          } catch (err) {
            console.error('Error syncing offline RDO create:', err)
          }
        } else if (rdo.syncStatus === 'pending_update') {
          try {
            // Check conflict: fetch server record first
            const serverRecord = await pb.collection('reports_rdo').getOne(rdo.id)
            if (
              rdo.serverUpdatedAt &&
              serverRecord.updated !== rdo.serverUpdatedAt &&
              new Date(serverRecord.updated).getTime() > rdo.lastModified
            ) {
              // Conflict detected!
              rdo.syncStatus = 'conflict'
              await offlineStorage.saveRdo(rdo)
              setConflicts((prev) => [
                ...prev.filter((c) => c.id !== rdo.id),
                {
                  id: rdo.id,
                  type: 'rdo',
                  localData: rdo,
                  serverData: serverRecord as unknown as Record<string, unknown>,
                },
              ])
              toast({
                title: 'Conflito detectado',
                description: `O RDO #${rdo.number} foi alterado em outro dispositivo.`,
                variant: 'destructive',
              })
              continue
            }

            const payload: Record<string, unknown> = {
              number: rdo.number,
              project: rdo.projectId,
              report_date: rdo.reportDate,
              weather: rdo.weather,
              performed_by: rdo.performedBy,
              supervised_by: rdo.supervisedBy || undefined,
              activity_title: rdo.activityTitle,
              activity_description: rdo.activityDescription,
              time_displacement: rdo.timeDisplacement || '',
              time_waiting: rdo.timeWaiting || '',
              interferences: rdo.interferences || '',
              plan_changes: rdo.planChanges || '',
              accidents: rdo.accidents || '',
              status: rdo.status,
              review_notes: rdo.reviewNotes || '',
            }
            const updated = await pb.collection('reports_rdo').update(rdo.id, payload)
            rdo.syncStatus = 'synced'
            rdo.serverUpdatedAt = updated.updated
            await offlineStorage.saveRdo(rdo)
            syncedCount++
          } catch (err) {
            console.error('Error syncing offline RDO update:', err)
          }
        }
      }

      // 2. Sync Field Sheets
      const fields = await offlineStorage.getAllFieldSheets()
      for (const sheet of fields) {
        if (sheet.syncStatus === 'pending_create') {
          try {
            const payload: Record<string, unknown> = {
              project: sheet.projectId,
              operator: sheet.operator,
              date: sheet.date,
              area: sheet.area,
              weather: sheet.weather || 'Sol',
              pluviometer: sheet.pluviometer || 0,
              morning_time: sheet.morning_time || '',
              afternoon_time: sheet.afternoon_time || '',
              infiltration_morning_time: sheet.infiltration_morning_time || '',
              infiltration_afternoon_time: sheet.infiltration_afternoon_time || '',
              extraction_data: sheet.extraction_data || [],
              infiltration_data: sheet.infiltration_data || {},
              nutrient_done: sheet.nutrient_done || false,
              nutrient_map_kg: sheet.nutrient_map_kg || 0,
              nutrient_ureia_kg: sheet.nutrient_ureia_kg || 0,
              compressor_data: sheet.compressor_data || {},
              oil_removal_data: sheet.oil_removal_data || {},
              waste_liquid_qty: sheet.waste_liquid_qty || 0,
              waste_solid_qty: sheet.waste_solid_qty || 0,
              env_5s_check: sheet.env_5s_check || false,
              env_checklist_monthly: sheet.env_checklist_monthly || false,
              observations: sheet.observations || '',
              status: sheet.status,
              review_notes: sheet.reviewNotes || '',
            }
            const created = await pb.collection('field_spreadsheets').create(payload)
            await offlineStorage.deleteFieldSheet(sheet.id)
            sheet.id = created.id
            sheet.syncStatus = 'synced'
            sheet.serverUpdatedAt = created.updated
            await offlineStorage.saveFieldSheet(sheet)
            syncedCount++
          } catch (err) {
            console.error('Error syncing offline FieldSheet create:', err)
          }
        } else if (sheet.syncStatus === 'pending_update') {
          try {
            const serverRecord = await pb.collection('field_spreadsheets').getOne(sheet.id)
            if (
              sheet.serverUpdatedAt &&
              serverRecord.updated !== sheet.serverUpdatedAt &&
              new Date(serverRecord.updated).getTime() > sheet.lastModified
            ) {
              sheet.syncStatus = 'conflict'
              await offlineStorage.saveFieldSheet(sheet)
              setConflicts((prev) => [
                ...prev.filter((c) => c.id !== sheet.id),
                {
                  id: sheet.id,
                  type: 'field',
                  localData: sheet,
                  serverData: serverRecord as unknown as Record<string, unknown>,
                },
              ])
              toast({
                title: 'Conflito detectado',
                description: `A Planilha de Campo (${sheet.date}) foi alterada em outro dispositivo.`,
                variant: 'destructive',
              })
              continue
            }

            const payload: Record<string, unknown> = {
              project: sheet.projectId,
              operator: sheet.operator,
              date: sheet.date,
              area: sheet.area,
              weather: sheet.weather || 'Sol',
              pluviometer: sheet.pluviometer || 0,
              morning_time: sheet.morning_time || '',
              afternoon_time: sheet.afternoon_time || '',
              infiltration_morning_time: sheet.infiltration_morning_time || '',
              infiltration_afternoon_time: sheet.infiltration_afternoon_time || '',
              extraction_data: sheet.extraction_data || [],
              infiltration_data: sheet.infiltration_data || {},
              nutrient_done: sheet.nutrient_done || false,
              nutrient_map_kg: sheet.nutrient_map_kg || 0,
              nutrient_ureia_kg: sheet.nutrient_ureia_kg || 0,
              compressor_data: sheet.compressor_data || {},
              oil_removal_data: sheet.oil_removal_data || {},
              waste_liquid_qty: sheet.waste_liquid_qty || 0,
              waste_solid_qty: sheet.waste_solid_qty || 0,
              env_5s_check: sheet.env_5s_check || false,
              env_checklist_monthly: sheet.env_checklist_monthly || false,
              observations: sheet.observations || '',
              status: sheet.status,
              review_notes: sheet.reviewNotes || '',
            }
            const updated = await pb.collection('field_spreadsheets').update(sheet.id, payload)
            sheet.syncStatus = 'synced'
            sheet.serverUpdatedAt = updated.updated
            await offlineStorage.saveFieldSheet(sheet)
            syncedCount++
          } catch (err) {
            console.error('Error syncing offline FieldSheet update:', err)
          }
        }
      }

      await checkPending()
      if (syncedCount > 0) {
        toast({
          title: 'Dados sincronizados',
          description: `${syncedCount} registro(s) sincronizado(s) com o servidor com sucesso.`,
        })
      }
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, checkPending, toast])

  const resolveConflict = async (
    conflict: ConflictItem,
    resolution: 'keep_local' | 'keep_server',
  ) => {
    if (conflict.type === 'rdo') {
      const rdo = conflict.localData as OfflineRdoItem
      if (resolution === 'keep_local') {
        rdo.syncStatus = 'pending_update'
        rdo.lastModified = Date.now()
        await offlineStorage.saveRdo(rdo)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
        await syncNow()
      } else {
        // keep server
        const s = conflict.serverData
        rdo.status = (s.status as 'draft' | 'submitted' | 'approved' | 'returned') || 'draft'
        rdo.activityTitle = String(s.activity_title || '')
        rdo.activityDescription = String(s.activity_description || '')
        rdo.syncStatus = 'synced'
        rdo.serverUpdatedAt = String(s.updated || '')
        await offlineStorage.saveRdo(rdo)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
      }
    } else {
      const sheet = conflict.localData as OfflineFieldSheetItem
      if (resolution === 'keep_local') {
        sheet.syncStatus = 'pending_update'
        sheet.lastModified = Date.now()
        await offlineStorage.saveFieldSheet(sheet)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
        await syncNow()
      } else {
        const s = conflict.serverData
        sheet.status = (s.status as 'draft' | 'submitted' | 'approved' | 'returned') || 'draft'
        sheet.syncStatus = 'synced'
        sheet.serverUpdatedAt = String(s.updated || '')
        await offlineStorage.saveFieldSheet(sheet)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
      }
    }
    toast({
      title: 'Conflito resolvido',
      description: 'A versão selecionada foi preservada com sucesso.',
    })
  }

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: '🟢 Conexão restabelecida',
        description: 'Você está online. Sincronizando dados...',
      })
      syncNow()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: '🟠 Trabalhando offline',
        description: 'Sem conexão. Suas alterações serão salvas localmente no dispositivo.',
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    checkPending()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncNow, checkPending, toast])

  return (
    <SyncContext.Provider
      value={{ isOnline, isSyncing, pendingCount, conflicts, syncNow, resolveConflict }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  return useContext(SyncContext)
}
