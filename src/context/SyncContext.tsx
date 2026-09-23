import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  offlineStorage,
  OfflineRdoItem,
  OfflineFieldSheetItem,
  OfflineProjectItem,
} from '@/services/offlineStorage'
import { useToast } from '@/hooks/use-toast'

export const SYNC_BROADCAST_EVENT = 'epa_sync_complete'
export const REALTIME_RECORD_UPDATE = 'epa_realtime_record_update'

export interface RealtimeRecordUpdateDetail {
  collection: string
  id: string
  action: 'create' | 'update' | 'delete'
  record?: Record<string, unknown>
}

export interface ConflictItem {
  id: string
  type: 'rdo' | 'field' | 'project'
  localData: OfflineRdoItem | OfflineFieldSheetItem | OfflineProjectItem
  serverData: Record<string, unknown>
}

export interface FailedSyncItem {
  id: string
  type: 'rdo' | 'field' | 'project'
  title: string
  error: string
  attempts: number
  lastAttempt: number
}

interface SyncContextType {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  failedCount: number
  failedItems: FailedSyncItem[]
  lastSyncTime: Date | null
  syncError: string | null
  conflicts: ConflictItem[]
  syncNow: () => Promise<void>
  retryFailed: () => Promise<void>
  resolveConflict: (
    conflict: ConflictItem,
    resolution: 'keep_local' | 'keep_server',
  ) => Promise<void>
}

const SyncContext = createContext<SyncContextType>({
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  failedCount: 0,
  failedItems: [],
  lastSyncTime: null,
  syncError: null,
  conflicts: [],
  syncNow: async () => {},
  retryFailed: async () => {},
  resolveConflict: async () => {},
})

// Helper to check whether an ID is provisional/offline-generated
function isProvisionalId(id?: string | null): boolean {
  if (!id) return false
  return (
    id.startsWith('rdo_') ||
    id.startsWith('field_') ||
    id.startsWith('proj_') ||
    id.startsWith('user_') ||
    id.startsWith('photo_') ||
    id.startsWith('temp_') ||
    id.startsWith('p_')
  )
}

// Friendly translation for PocketBase server errors to Portuguese
function translateServerErrorMessage(err: unknown, entity: 'rdo' | 'field' | 'project'): string {
  if (!err) return 'Erro desconhecido durante a sincronização.'
  const rawMsg = err instanceof Error ? err.message : String(err)
  const errObj = (err as any)?.data?.data || {}

  if (rawMsg.includes('Failed to create record') || rawMsg.includes('Failed to update record')) {
    if (errObj.project) {
      return 'Projeto obrigatório não selecionado ou inválido.'
    }
    if (errObj.performed_by) {
      return 'Responsável pela execução (performer) obrigatório não encontrado.'
    }
    if (errObj.operator) {
      return 'Técnico responsável pela planilha não encontrado.'
    }
    if (errObj.weather) {
      return 'Condição climática informada é inválida.'
    }
    if (errObj.number) {
      return 'Número de relatório inválido ou duplicado.'
    }
    if (errObj.date || errObj.report_date) {
      return 'Data do relatório/planilha inválida ou obrigatória.'
    }
    if (entity === 'rdo') {
      return 'Falha ao registrar RDO. Verifique se o projeto e os responsáveis estão preenchidos.'
    }
    if (entity === 'field') {
      return 'Falha ao registrar Planilha de Campo. Verifique os dados operacionais e o projeto.'
    }
    return 'Falha na validação dos campos obrigatórios no servidor.'
  }

  if (rawMsg.includes("The requested resource wasn't found") || rawMsg.includes('404')) {
    return 'Registro não encontrado no servidor.'
  }
  if (
    rawMsg.includes('bloqueado para edição') ||
    rawMsg.includes('bloqueada para edição') ||
    rawMsg.includes('Aguarde a liberação do Administrador')
  ) {
    return 'Documento enviado para aprovação ou já aprovado: edição bloqueada para técnico. Aguarde a liberação do Administrador.'
  }

  if (
    rawMsg.includes('Only admins can') ||
    rawMsg.includes('403') ||
    rawMsg.includes('Failed to authenticate') ||
    rawMsg.includes('Forbidden') ||
    rawMsg.includes('forbidden')
  ) {
    return 'Permissão insuficiente para alterar este registro: documento já enviado ou aprovado, bloqueado para edição.'
  }

  return rawMsg
}

// Helper to convert base64 dataUrl to File/Blob safely with timeout
async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const mime = blob.type || 'image/jpeg'
  return new File([blob], filename, { type: mime })
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [failedCount, setFailedCount] = useState<number>(0)
  const [failedItems, setFailedItems] = useState<FailedSyncItem[]>([])
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('epa_last_sync_time')
    return saved ? new Date(saved) : null
  })
  const [syncError, setSyncError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const { toast } = useToast()

  const syncInProgressRef = useRef(false)
  const pullInProgressRef = useRef(false)
  const backoffDelayRef = useRef(0)
  const lastPullTimestampRef = useRef<string>(localStorage.getItem('epa_last_pull_timestamp') || '')

  const checkPending = useCallback(async () => {
    try {
      const [rdos, fields, projects] = await Promise.all([
        offlineStorage.getAllRdos(),
        offlineStorage.getAllFieldSheets(),
        offlineStorage.getAllProjects(),
      ])

      const pendingRdos = rdos.filter(
        (r) => r.syncStatus === 'pending_create' || r.syncStatus === 'pending_update',
      )
      const pendingFields = fields.filter(
        (f) => f.syncStatus === 'pending_create' || f.syncStatus === 'pending_update',
      )
      const pendingProjects = projects.filter(
        (p) => p.syncStatus === 'pending_create' || p.syncStatus === 'pending_update',
      )

      const failedRdos = rdos.filter((r) => r.syncStatus === 'failed')
      const failedFields = fields.filter((f) => f.syncStatus === 'failed')
      const failedProjects = projects.filter((p) => p.syncStatus === 'failed')

      setPendingCount(pendingRdos.length + pendingFields.length + pendingProjects.length)
      setFailedCount(failedRdos.length + failedFields.length + failedProjects.length)

      const fails: FailedSyncItem[] = [
        ...failedRdos.map((r) => ({
          id: r.id,
          type: 'rdo' as const,
          title: `${typeof r.number === 'number' && r.number > 0 ? `RDO Nº ${r.number}` : 'RDO Offline'} (${r.activityTitle || 'Sem título'})`,
          error: r.syncError || 'Erro desconhecido',
          attempts: r.syncAttempts || 1,
          lastAttempt: r.lastModified,
        })),
        ...failedFields.map((f) => ({
          id: f.id,
          type: 'field' as const,
          title: `Planilha ${f.date} (${f.area || 'Geral'})`,
          error: f.syncError || 'Erro desconhecido',
          attempts: f.syncAttempts || 1,
          lastAttempt: f.lastModified,
        })),
        ...failedProjects.map((p) => ({
          id: p.id,
          type: 'project' as const,
          title: `Projeto ${p.name || p.code}`,
          error: p.syncError || 'Erro desconhecido',
          attempts: p.syncAttempts || 1,
          lastAttempt: p.lastModified,
        })),
      ]
      setFailedItems(fails)
    } catch {
      // ignore
    }
  }, [])

  const syncNow = useCallback(async () => {
    // Prevent overlapping syncs across multiple triggers
    if (syncInProgressRef.current) return
    if (!navigator.onLine || !pb.authStore.isValid) return

    syncInProgressRef.current = true
    setIsSyncing(true)
    setSyncError(null)

    let totalSynced = 0
    let totalErrors = 0
    const errorsList: string[] = []

    try {
      // 0. VERIFICAÇÃO DE ZERAGEM OPERACIONAL NO SERVIDOR (Anti-ressincronização)
      // Se o servidor passou por um reset operacional (last_operation_wipe_at),
      // qualquer registro local anterior à data da zeragem ou sincronizado não mais existente
      // deve ser descartado do IndexedDB.
      try {
        let wipeTimestamp = new Date('2025-05-28T00:00:00Z').getTime()
        const wipeSetting = await pb
          .collection('system_settings')
          .getFirstListItem('key = "last_operation_wipe_at"')
          .catch(() => null)

        if (wipeSetting && wipeSetting.value) {
          wipeTimestamp = new Date(wipeSetting.value).getTime()
        }

        // Consultar contagem no servidor para detectar backend zerado
        let serverRdoCount = 0
        let serverSheetCount = 0
        try {
          const rdoRes = await pb.collection('reports_rdo').getList(1, 1, { fields: 'id' })
          serverRdoCount = rdoRes.totalItems
          const sheetRes = await pb.collection('field_spreadsheets').getList(1, 1, { fields: 'id' })
          serverSheetCount = sheetRes.totalItems
        } catch (cntErr) {
          console.warn('Erro ao verificar contagem de registros no servidor:', cntErr)
        }

        const purgeResult = await offlineStorage.purgePreWipeOperationalData(wipeTimestamp, {
          purgeAllSynced: serverRdoCount === 0 && serverSheetCount === 0,
        })

        localStorage.setItem('epa_last_processed_wipe', String(wipeTimestamp))

        if (purgeResult.purgedRdos > 0 || purgeResult.purgedSheets > 0) {
          console.log(
            `Anti-ressincronização: descartados ${purgeResult.purgedRdos} RDOs e ${purgeResult.purgedSheets} Planilhas pré-zeragem.`,
          )
          toast({
            title: 'Operação zerada pelo sistema',
            description: `Cache local sincronizado com a zeragem operacional do servidor (${purgeResult.purgedRdos} RDOs e ${purgeResult.purgedSheets} Planilhas antigas descartados).`,
          })
          await checkPending()
        }
      } catch (wipeCheckErr) {
        console.warn('Erro ao verificar last_operation_wipe_at:', wipeCheckErr)
      }

      // Helper to find an active server project ID fallback
      let fallbackProjectId: string | null = null
      const resolveFallbackProjectId = async (): Promise<string | null> => {
        if (fallbackProjectId) return fallbackProjectId
        try {
          // 1. Try to get first active project from PocketBase
          const serverProjects = await pb.collection('projects').getList(1, 1, {
            filter: 'deleted = false && archived = false && status = "active"',
            sort: '-created',
          })
          if (serverProjects.items.length > 0) {
            fallbackProjectId = serverProjects.items[0].id
            return fallbackProjectId
          }
          // 2. Any non-deleted project
          const anyProj = await pb.collection('projects').getList(1, 1, {
            filter: 'deleted = false',
            sort: '-created',
          })
          if (anyProj.items.length > 0) {
            fallbackProjectId = anyProj.items[0].id
            return fallbackProjectId
          }
        } catch (e) {
          console.warn('Could not query active project for sync fallback:', e)
        }
        return null
      }

      // -------------------------------------------------------------
      // 1. Sync Offline Projects first (so RDOs/Fields can link to real ID)
      // -------------------------------------------------------------
      const projects = await offlineStorage.getAllProjects()
      for (const proj of projects) {
        if (proj.syncStatus === 'pending_create') {
          try {
            const payload: Record<string, unknown> = {
              name: proj.name,
              epa_code: proj.code,
              location: proj.location || 'Área Operacional',
              progress: proj.progress || 0,
              status: proj.status || 'active',
              assigned_users: proj.assignedUsersIds || [],
              archived: Boolean(proj.archived),
              deleted: Boolean(proj.deleted),
              deleted_reason: proj.deletedReason || '',
              deleted_by: proj.deletedBy || undefined,
              deleted_at: proj.deletedAt || undefined,
            }
            if (proj.rawClient) payload.client = proj.rawClient
            if (proj.rawContract) payload.contract = proj.rawContract
            if (proj.rawCompany) payload.company = proj.rawCompany
            if (proj.rawArea) payload.area = proj.rawArea

            const created = await pb.collection('projects').create(payload)

            const oldId = proj.id
            await offlineStorage.deleteProject(oldId)
            proj.id = created.id
            proj.syncStatus = 'synced'
            proj.serverUpdatedAt = created.updated
            delete proj.syncError
            proj.syncAttempts = 0
            await offlineStorage.saveProject(proj)
            totalSynced++
          } catch (err: any) {
            console.error('Project create sync failed for', proj.id, err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'project')
            const errMsg = friendly || err?.message || 'Falha ao sincronizar criação de projeto'
            errorsList.push(errMsg)
            proj.syncStatus = 'failed'
            proj.syncError = errMsg
            proj.syncAttempts = (proj.syncAttempts || 0) + 1
            await offlineStorage.saveProject(proj)
          }
        } else if (proj.syncStatus === 'pending_update') {
          try {
            const payload: Record<string, unknown> = {
              name: proj.name,
              epa_code: proj.code,
              location: proj.location || 'Área Operacional',
              progress: proj.progress || 0,
              status: proj.status || 'active',
              assigned_users: proj.assignedUsersIds || [],
              archived: Boolean(proj.archived),
              deleted: Boolean(proj.deleted),
              deleted_reason: proj.deletedReason || '',
              deleted_by: proj.deletedBy || undefined,
              deleted_at: proj.deletedAt || undefined,
            }
            if (proj.rawClient) payload.client = proj.rawClient
            if (proj.rawContract) payload.contract = proj.rawContract
            if (proj.rawCompany) payload.company = proj.rawCompany
            if (proj.rawArea) payload.area = proj.rawArea

            const updated = await pb.collection('projects').update(proj.id, payload)
            proj.syncStatus = 'synced'
            proj.serverUpdatedAt = updated.updated
            delete proj.syncError
            proj.syncAttempts = 0
            await offlineStorage.saveProject(proj)
            totalSynced++
          } catch (err: any) {
            console.error('Project update sync failed for', proj.id, err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'project')
            const errMsg = friendly || err?.message || 'Falha ao sincronizar alteração de projeto'
            errorsList.push(errMsg)
            proj.syncStatus = 'failed'
            proj.syncError = errMsg
            proj.syncAttempts = (proj.syncAttempts || 0) + 1
            await offlineStorage.saveProject(proj)
          }
        }
      }

      // -------------------------------------------------------------
      // 1.1 Cache Active Wells for all available Projects
      // -------------------------------------------------------------
      try {
        const activeProjects = await pb.collection('projects').getFullList({
          filter: 'deleted = false',
          fields: 'id',
        })
        for (const pr of activeProjects) {
          try {
            const serverWells = await pb.collection('wells').getFullList({
              filter: `project = "${pr.id}" && active = true`,
              sort: 'identification',
            })
            if (serverWells && serverWells.length > 0) {
              await offlineStorage.saveProjectWells(pr.id, serverWells)
            }
          } catch (wellErr) {
            console.warn(`Could not cache wells for project ${pr.id}:`, wellErr)
          }
        }
      } catch (wellsSyncErr) {
        console.warn('Could not sync active wells during syncNow:', wellsSyncErr)
      }
      // -------------------------------------------------------------
      // 2. Sync RDOs
      // -------------------------------------------------------------
      const rdos = await offlineStorage.getAllRdos()
      for (const rdo of rdos) {
        // Defensive check: if item has a provisional ID but syncStatus is pending_update, treat as pending_create
        if (rdo.syncStatus === 'pending_update' && isProvisionalId(rdo.id)) {
          rdo.syncStatus = 'pending_create'
          await offlineStorage.saveRdo(rdo)
        }

        if (rdo.syncStatus === 'pending_create') {
          try {
            // Resolve project ID
            let targetProjectId = rdo.projectId?.trim() || ''
            if (!targetProjectId || isProvisionalId(targetProjectId)) {
              // Try to find an active server project
              const resolved = await resolveFallbackProjectId()
              if (resolved) {
                targetProjectId = resolved
                rdo.projectId = resolved
              } else {
                // Se não há projeto vinculado, NÃO enviar payload inválido para o servidor.
                // Mantém localmente com pending_create e emite aviso explicativo no painel.
                rdo.syncStatus = 'pending_create'
                const warnMsg =
                  'Registro salvo localmente. Aguardando vinculação de projeto pelo Administrador para envio ao servidor.'
                rdo.syncError = warnMsg
                errorsList.push(warnMsg)
                await offlineStorage.saveRdo(rdo)
                continue
              }
            }

            // Resolve performed_by and supervised_by with logged-in user fallback
            const currentUserId = pb.authStore.record?.id || ''
            const targetPerformedBy =
              rdo.performedBy && !isProvisionalId(rdo.performedBy) ? rdo.performedBy : currentUserId
            const targetSupervisedBy =
              rdo.supervisedBy && !isProvisionalId(rdo.supervisedBy)
                ? rdo.supervisedBy
                : currentUserId

            if (!targetPerformedBy) {
              throw new Error('Responsável pela execução (performed_by) é obrigatório.')
            }

            const payload: Record<string, unknown> = {
              project: targetProjectId,
              empresa_executora: rdo.companyName || 'EPA Gestão Ambiental',
              report_date: rdo.reportDate,
              weather: rdo.weather || 'Sol',
              performed_by: targetPerformedBy,
              supervised_by: targetSupervisedBy || undefined,
              activity_title: rdo.activityTitle || 'Sem título',
              activity_description: rdo.activityDescription || '',
              time_displacement: rdo.timeDisplacement || '',
              time_waiting: rdo.timeWaiting || '',
              interferences: rdo.interferences || '',
              plan_changes: rdo.planChanges || '',
              accidents: rdo.accidents || '',
              status: rdo.status || 'draft',
              review_notes: rdo.reviewNotes || '',
              returned_fields: rdo.returned_fields || [],
              change_history: rdo.change_history || [],
              archived: Boolean(rdo.archived),
              deleted: Boolean(rdo.deleted),
              deleted_reason: rdo.deletedReason || '',
              deleted_by: rdo.deletedBy || undefined,
              deleted_at: rdo.deletedAt || undefined,
            }
            // Deixar o backend calcular o número sequencial atômico (1, 2, 3...)
            if (rdo.number && rdo.number > 0 && !isProvisionalId(rdo.id)) {
              payload.number = rdo.number
            }
            const record = await pb.collection('reports_rdo').create(payload)
            rdo.number = record.number
            rdo.submittedAt =
              record.submitted_at || (record.status === 'submitted' ? record.updated : undefined)
            rdo.approvedAt =
              record.approved_at || (record.status === 'approved' ? record.updated : undefined)
            rdo.returnedAt =
              record.returned_at || (record.status === 'returned' ? record.updated : undefined)
            rdo.serverCreatedAt = record.created
            // create wells
            for (const well of rdo.wells || []) {
              if (well.well_id) {
                try {
                  await pb.collection('report_wells').create({
                    report: record.id,
                    well_id: well.well_id,
                    depth: well.depth ? Number(well.depth) : undefined,
                    completion_date: well.completion_date || undefined,
                    diameter: well.diameter || undefined,
                  })
                } catch (wellErr) {
                  console.warn('Failed to sync well for RDO:', wellErr)
                }
              }
            }

            // Sync photos (field photo + general photos)
            const allPhotosToSync: Array<{
              id?: string
              image?: string
              caption?: string
              order: number
              dataUrl?: string
              category?: 'general' | 'field_inspection'
            }> = []

            if (rdo.fieldPhoto?.dataUrl || rdo.fieldPhoto?.image) {
              allPhotosToSync.push({
                ...rdo.fieldPhoto,
                order: 0,
                category: 'field_inspection',
              })
            }

            if (rdo.photos && rdo.photos.length > 0) {
              rdo.photos.forEach((p, idx) => {
                allPhotosToSync.push({
                  ...p,
                  order: idx + 1,
                  category: p.category || 'general',
                })
              })
            }

            let photoErrorsCount = 0
            for (const p of allPhotosToSync) {
              try {
                if (p.dataUrl && p.dataUrl.startsWith('data:image/')) {
                  const ext =
                    p.dataUrl.substring('data:image/'.length, p.dataUrl.indexOf(';')) || 'jpeg'
                  const file = await dataUrlToFile(p.dataUrl, `photo_${Date.now()}.${ext}`)
                  const photoFd = new FormData()
                  photoFd.append('report', record.id)
                  photoFd.append('image', file)
                  photoFd.append(
                    'caption',
                    p.caption ||
                      (p.category === 'field_inspection'
                        ? 'Fotografia do campo/inspeção'
                        : 'Foto do RDO'),
                  )
                  photoFd.append('order', String(p.order))
                  photoFd.append('category', p.category || 'general')
                  const createdPhoto = await pb.collection('report_photos').create(photoFd)

                  // Atualiza localmente a referência da foto com o arquivo persistido no servidor
                  // mantendo fallback sem perder imagem se o offline for reaberto
                  if (p.category === 'field_inspection' && rdo.fieldPhoto) {
                    rdo.fieldPhoto.image = createdPhoto.image
                    delete rdo.fieldPhoto.dataUrl
                  } else if (rdo.photos) {
                    const matched = rdo.photos.find((ph) => ph.order === p.order)
                    if (matched) {
                      matched.image = createdPhoto.image
                      delete matched.dataUrl
                    }
                  }
                }
              } catch (photoErr: any) {
                photoErrorsCount++
                console.warn('Could not sync photo for RDO:', photoErr)
              }
            }

            // Update local offline item to synced
            await offlineStorage.deleteRdo(rdo.id)
            rdo.id = record.id
            if (photoErrorsCount > 0) {
              // Se o upload de fotos falhar, o RDO permanece pendente com aviso claro
              rdo.syncStatus = 'failed'
              rdo.serverUpdatedAt = record.updated
              const rdoDisplay =
                record.number || rdo.number
                  ? `RDO Nº ${record.number || rdo.number}`
                  : 'RDO Offline'
              const warnMsg = `${rdoDisplay} criado no servidor, porém ${photoErrorsCount} foto(s) falharam no upload. As fotos foram preservadas localmente e serão reenviadas na próxima sincronização.`
              rdo.syncError = warnMsg
              errorsList.push(warnMsg)
              totalErrors++
              await offlineStorage.saveRdo(rdo)
            } else {
              rdo.syncStatus = 'synced'
              rdo.serverUpdatedAt = record.updated
              delete rdo.syncError
              rdo.syncAttempts = 0
              await offlineStorage.saveRdo(rdo)
              totalSynced++
            }
          } catch (err: any) {
            console.error('Error syncing offline RDO create:', err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'rdo')
            const errMsg = friendly || err?.message || 'Falha ao sincronizar criação de RDO'
            errorsList.push(errMsg)
            rdo.syncStatus = 'failed'
            rdo.syncError = errMsg
            rdo.syncAttempts = (rdo.syncAttempts || 0) + 1
            await offlineStorage.saveRdo(rdo)
          }
        } else if (rdo.syncStatus === 'pending_update') {
          // If the ID is provisional, it never existed on the server: route directly to pending_create
          if (isProvisionalId(rdo.id)) {
            rdo.syncStatus = 'pending_create'
            await offlineStorage.saveRdo(rdo)
            continue
          }

          try {
            // Check conflict
            let serverRecord: any = null
            try {
              serverRecord = await pb.collection('reports_rdo').getOne(rdo.id)
            } catch (fetchErr: any) {
              if (fetchErr?.status === 404) {
                // Server record was deleted; recreate with new ID
                console.warn('Server record not found, converting to pending_create:', rdo.id)
                rdo.syncStatus = 'pending_create'
                await offlineStorage.saveRdo(rdo)
                continue
              }
              throw fetchErr
            }

            // Trava de integridade offline para Técnico: se no servidor o RDO já está 'submitted' ou 'approved',
            // ou se o Técnico está tentando alterar um RDO que localmente já estava enviado/aprovado
            const userRole = pb.authStore.record?.role
            if (userRole === 'technician') {
              const serverStatus = serverRecord?.status
              // Se o documento no servidor já está submitted ou approved, e localmente é apenas uma edição de dados
              // (não a transição inicial para submitted a partir de draft/returned)
              if (
                serverStatus === 'submitted' ||
                serverStatus === 'approved' ||
                rdo.status === 'approved'
              ) {
                // Aborta envio indevido e marca falha explicativa sem corromper o documento
                const lockMsg =
                  'RDO enviado para aprovação ou aprovado: edição bloqueada para técnico. Aguarde a liberação do Administrador.'
                rdo.syncStatus = 'failed'
                rdo.syncError = lockMsg
                await offlineStorage.saveRdo(rdo)
                totalErrors++
                errorsList.push(lockMsg)
                continue
              }
            }

            if (
              rdo.serverUpdatedAt &&
              serverRecord.updated !== rdo.serverUpdatedAt &&
              new Date(serverRecord.updated).getTime() > rdo.lastModified
            ) {
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
              const conflictRdoLabel =
                typeof rdo.number === 'number' && rdo.number > 0
                  ? `RDO Nº ${rdo.number}`
                  : 'RDO Offline'
              toast({
                title: 'Conflito detectado',
                description: `O ${conflictRdoLabel} foi alterado em outro dispositivo.`,
                variant: 'destructive',
              })
              continue
            }

            const payload: Record<string, unknown> = {
              number: rdo.number,
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
              returned_fields: rdo.returned_fields || [],
              change_history: rdo.change_history || [],
              archived: Boolean(rdo.archived),
              deleted: Boolean(rdo.deleted),
              deleted_reason: rdo.deletedReason || '',
              deleted_by: rdo.deletedBy || undefined,
              deleted_at: rdo.deletedAt || undefined,
            }
            if (rdo.companyName !== undefined && pb.authStore.record?.role !== 'technician') {
              payload.empresa_executora = rdo.companyName
            }
            if (rdo.projectId && rdo.projectId.trim()) {
              payload.project = rdo.projectId
            }

            const updated = await pb.collection('reports_rdo').update(rdo.id, payload)
            if (updated.number) rdo.number = updated.number
            if (updated.submitted_at) rdo.submittedAt = updated.submitted_at
            if (updated.approved_at) rdo.approvedAt = updated.approved_at
            if (updated.returned_at) rdo.returnedAt = updated.returned_at
            if (updated.created) rdo.serverCreatedAt = updated.created

            // Sync photos with dataUrl
            const photosToSync: Array<{
              id?: string
              image?: string
              caption?: string
              order: number
              dataUrl?: string
              category?: 'general' | 'field_inspection'
            }> = []

            if (rdo.fieldPhoto?.dataUrl && rdo.fieldPhoto.dataUrl.startsWith('data:image/')) {
              photosToSync.push({
                ...rdo.fieldPhoto,
                order: 0,
                category: 'field_inspection',
              })
            }

            for (const p of rdo.photos || []) {
              if (p.dataUrl && p.dataUrl.startsWith('data:image/')) {
                photosToSync.push({
                  ...p,
                  order: p.order,
                  category: p.category || 'general',
                })
              }
            }

            let updatePhotoErrorsCount = 0
            for (const p of photosToSync) {
              try {
                if (p.dataUrl && p.dataUrl.startsWith('data:image/')) {
                  const ext =
                    p.dataUrl.substring('data:image/'.length, p.dataUrl.indexOf(';')) || 'jpeg'
                  const file = await dataUrlToFile(p.dataUrl, `photo_${Date.now()}.${ext}`)
                  const photoFd = new FormData()
                  photoFd.append('report', rdo.id)
                  photoFd.append('image', file)
                  photoFd.append(
                    'caption',
                    p.caption ||
                      (p.category === 'field_inspection'
                        ? 'Fotografia do campo/inspeção'
                        : 'Foto do RDO'),
                  )
                  photoFd.append('order', String(p.order))
                  photoFd.append('category', p.category || 'general')
                  const createdPhoto = await pb.collection('report_photos').create(photoFd)

                  // Atualiza localmente a referência da foto com o arquivo persistido no servidor
                  if (p.category === 'field_inspection' && rdo.fieldPhoto) {
                    rdo.fieldPhoto.image = createdPhoto.image
                    delete rdo.fieldPhoto.dataUrl
                  } else if (rdo.photos) {
                    const matched = rdo.photos.find((ph) => ph.order === p.order)
                    if (matched) {
                      matched.image = createdPhoto.image
                      delete matched.dataUrl
                    }
                  }
                }
              } catch (photoErr: any) {
                updatePhotoErrorsCount++
                console.warn('Could not sync photo for RDO update:', photoErr)
              }
            }

            if (updatePhotoErrorsCount > 0) {
              // Se o upload de fotos falhar na atualização, o item permanece pendente com aviso claro
              rdo.syncStatus = 'failed'
              rdo.serverUpdatedAt = updated.updated
              const rdoUpdateDisplay =
                updated.number || rdo.number
                  ? `RDO Nº ${updated.number || rdo.number}`
                  : 'RDO Offline'
              const warnMsg = `${rdoUpdateDisplay} atualizado, porém ${updatePhotoErrorsCount} foto(s) falharam no upload. As fotos continuam salvas no dispositivo para nova tentativa.`
              rdo.syncError = warnMsg
              errorsList.push(warnMsg)
              totalErrors++
              await offlineStorage.saveRdo(rdo)
            } else {
              rdo.syncStatus = 'synced'
              rdo.serverUpdatedAt = updated.updated
              delete rdo.syncError
              rdo.syncAttempts = 0
              await offlineStorage.saveRdo(rdo)
              totalSynced++
            }
          } catch (err: any) {
            console.error('Error syncing offline RDO update:', err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'rdo')
            const errMsg = friendly || err?.message || 'Falha ao sincronizar atualização de RDO'
            errorsList.push(errMsg)
            rdo.syncStatus = 'failed'
            rdo.syncError = errMsg
            rdo.syncAttempts = (rdo.syncAttempts || 0) + 1
            await offlineStorage.saveRdo(rdo)
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Sync Field Sheets
      // -------------------------------------------------------------
      const fields = await offlineStorage.getAllFieldSheets()
      for (const sheet of fields) {
        // Defensive check: if item has a provisional ID but syncStatus is pending_update, treat as pending_create
        if (sheet.syncStatus === 'pending_update' && isProvisionalId(sheet.id)) {
          sheet.syncStatus = 'pending_create'
          await offlineStorage.saveFieldSheet(sheet)
        }

        if (sheet.syncStatus === 'pending_create') {
          try {
            // Resolve project ID
            let targetProjectId = sheet.projectId?.trim() || ''
            if (!targetProjectId || isProvisionalId(targetProjectId)) {
              const resolved = await resolveFallbackProjectId()
              if (resolved) {
                targetProjectId = resolved
                sheet.projectId = resolved
              } else {
                // Se não há projeto vinculado, NÃO enviar payload inválido para o servidor.
                // Mantém localmente com pending_create e emite aviso explicativo no painel.
                sheet.syncStatus = 'pending_create'
                const warnMsg =
                  'Registro salvo localmente. Aguardando vinculação de projeto pelo Administrador para envio ao servidor.'
                sheet.syncError = warnMsg
                errorsList.push(warnMsg)
                await offlineStorage.saveFieldSheet(sheet)
                continue
              }
            }

            const currentUserId = pb.authStore.record?.id || ''
            const targetOperator =
              sheet.operator && !isProvisionalId(sheet.operator) ? sheet.operator : currentUserId

            const payload: Record<string, unknown> = {
              project: targetProjectId,
              operator: targetOperator,
              date: sheet.date || new Date().toISOString().slice(0, 10),
              area: sheet.area || 'Geral',
              weather: sheet.weather || 'Sol',
              pluviometer: sheet.pluviometer || 0,
              morning_time: sheet.morning_time || '',
              afternoon_time: sheet.afternoon_time || '',
              infiltration_morning_time: sheet.infiltration_morning_time || '',
              infiltration_afternoon_time: sheet.infiltration_afternoon_time || '',
              extraction_data: sheet.extraction_data || [],
              infiltration_data: sheet.infiltration_data || {},
              nutrient_done: Boolean(sheet.nutrient_done),
              nutrient_map_kg: sheet.nutrient_map_kg || 0,
              nutrient_ureia_kg: sheet.nutrient_ureia_kg || 0,
              compressor_data: sheet.compressor_data || {},
              oil_removal_data: sheet.oil_removal_data || {},
              waste_liquid_qty: sheet.waste_liquid_qty || 0,
              waste_solid_qty: sheet.waste_solid_qty || 0,
              env_5s_check: Boolean(sheet.env_5s_check),
              env_checklist_monthly: Boolean(sheet.env_checklist_monthly),
              observations: sheet.observations || '',
              status: sheet.status || 'draft',
              review_notes: sheet.reviewNotes || '',
              returned_fields: sheet.returned_fields || [],
              change_history: sheet.change_history || [],
              archived: Boolean(sheet.archived),
              deleted: Boolean(sheet.deleted),
              deleted_reason: sheet.deletedReason || '',
              deleted_by: sheet.deletedBy || undefined,
              deleted_at: sheet.deletedAt || undefined,
            }

            const created = await pb.collection('field_spreadsheets').create(payload)
            await offlineStorage.deleteFieldSheet(sheet.id)
            sheet.id = created.id
            sheet.number = created.number
            sheet.submittedAt =
              created.submitted_at || (created.status === 'submitted' ? created.updated : undefined)
            sheet.approvedAt =
              created.approved_at || (created.status === 'approved' ? created.updated : undefined)
            sheet.returnedAt =
              created.returned_at || (created.status === 'returned' ? created.updated : undefined)
            sheet.serverCreatedAt = created.created
            sheet.syncStatus = 'synced'
            sheet.serverUpdatedAt = created.updated
            delete sheet.syncError
            sheet.syncAttempts = 0
            await offlineStorage.saveFieldSheet(sheet)
            totalSynced++
          } catch (err: any) {
            console.error('Error syncing offline FieldSheet create:', err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'field')
            const errMsg = friendly || err?.message || 'Falha ao sincronizar planilha de campo'
            errorsList.push(errMsg)
            sheet.syncStatus = 'failed'
            sheet.syncError = errMsg
            sheet.syncAttempts = (sheet.syncAttempts || 0) + 1
            await offlineStorage.saveFieldSheet(sheet)
          }
        } else if (sheet.syncStatus === 'pending_update') {
          // If the ID is provisional, it never existed on the server: route directly to pending_create
          if (isProvisionalId(sheet.id)) {
            sheet.syncStatus = 'pending_create'
            await offlineStorage.saveFieldSheet(sheet)
            continue
          }

          try {
            let serverRecord: any = null
            try {
              serverRecord = await pb.collection('field_spreadsheets').getOne(sheet.id)
            } catch (fetchErr: any) {
              if (fetchErr?.status === 404) {
                console.warn('Server sheet not found, converting to pending_create:', sheet.id)
                sheet.syncStatus = 'pending_create'
                await offlineStorage.saveFieldSheet(sheet)
                continue
              }
              throw fetchErr
            }

            // Trava de integridade offline para Técnico: se no servidor a Planilha já está 'submitted' ou 'approved',
            // ou se o Técnico está tentando alterar uma Planilha que localmente já estava enviada/aprovada
            const userRoleSheet = pb.authStore.record?.role
            if (userRoleSheet === 'technician') {
              const serverStatus = serverRecord?.status
              if (
                serverStatus === 'submitted' ||
                serverStatus === 'approved' ||
                sheet.status === 'approved'
              ) {
                // Aborta envio indevido e marca falha explicativa sem corromper a planilha
                const lockMsg =
                  'Planilha enviada para aprovação ou aprovada: edição bloqueada para técnico. Aguarde a liberação do Administrador.'
                sheet.syncStatus = 'failed'
                sheet.syncError = lockMsg
                await offlineStorage.saveFieldSheet(sheet)
                totalErrors++
                errorsList.push(lockMsg)
                continue
              }
            }

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
              operator: sheet.operator,
              date: sheet.date,
              area: sheet.area || 'Geral',
              weather: sheet.weather || 'Sol',
              pluviometer: sheet.pluviometer || 0,
              morning_time: sheet.morning_time || '',
              afternoon_time: sheet.afternoon_time || '',
              infiltration_morning_time: sheet.infiltration_morning_time || '',
              infiltration_afternoon_time: sheet.infiltration_afternoon_time || '',
              extraction_data: sheet.extraction_data || [],
              infiltration_data: sheet.infiltration_data || {},
              nutrient_done: Boolean(sheet.nutrient_done),
              nutrient_map_kg: sheet.nutrient_map_kg || 0,
              nutrient_ureia_kg: sheet.nutrient_ureia_kg || 0,
              compressor_data: sheet.compressor_data || {},
              oil_removal_data: sheet.oil_removal_data || {},
              waste_liquid_qty: sheet.waste_liquid_qty || 0,
              waste_solid_qty: sheet.waste_solid_qty || 0,
              env_5s_check: Boolean(sheet.env_5s_check),
              env_checklist_monthly: Boolean(sheet.env_checklist_monthly),
              observations: sheet.observations || '',
              status: sheet.status,
              review_notes: sheet.reviewNotes || '',
              returned_fields: sheet.returned_fields || [],
              change_history: sheet.change_history || [],
              archived: Boolean(sheet.archived),
              deleted: Boolean(sheet.deleted),
              deleted_reason: sheet.deletedReason || '',
              deleted_by: sheet.deletedBy || undefined,
              deleted_at: sheet.deletedAt || undefined,
            }
            if (sheet.projectId && sheet.projectId.trim()) {
              payload.project = sheet.projectId
            }

            const updated = await pb.collection('field_spreadsheets').update(sheet.id, payload)
            if (updated.number) sheet.number = updated.number
            if (updated.submitted_at) sheet.submittedAt = updated.submitted_at
            if (updated.approved_at) sheet.approvedAt = updated.approved_at
            if (updated.returned_at) sheet.returnedAt = updated.returned_at
            if (updated.created) sheet.serverCreatedAt = updated.created
            sheet.syncStatus = 'synced'
            sheet.serverUpdatedAt = updated.updated
            delete sheet.syncError
            sheet.syncAttempts = 0
            await offlineStorage.saveFieldSheet(sheet)
            totalSynced++
          } catch (err: any) {
            console.error('Error syncing offline FieldSheet update:', err)
            totalErrors++
            const friendly = translateServerErrorMessage(err, 'field')
            const errMsg =
              friendly || err?.message || 'Falha ao sincronizar atualização de planilha'
            errorsList.push(errMsg)
            sheet.syncStatus = 'failed'
            sheet.syncError = errMsg
            sheet.syncAttempts = (sheet.syncAttempts || 0) + 1
            await offlineStorage.saveFieldSheet(sheet)
          }
        }
      }

      await checkPending()

      if (totalSynced > 0) {
        const now = new Date()
        setLastSyncTime(now)
        localStorage.setItem('epa_last_sync_time', now.toISOString())
        backoffDelayRef.current = 0

        // Broadcast to all active pages (Dashboard, Rdos, FieldSpreadsheets, Projects) to revalidate server data
        window.dispatchEvent(
          new CustomEvent(SYNC_BROADCAST_EVENT, {
            detail: { syncedCount: totalSynced, timestamp: now.getTime() },
          }),
        )

        toast({
          title: 'Sincronização concluída',
          description: `${totalSynced} registro(s) sincronizado(s) com o servidor com sucesso.`,
        })
      }

      if (totalErrors > 0) {
        setSyncError(`${totalErrors} item(ns) falharam ao sincronizar.`)
        // Exponential backoff capped at 60s
        backoffDelayRef.current = Math.min(
          backoffDelayRef.current ? backoffDelayRef.current * 2 : 5000,
          60000,
        )
      }
    } catch (err: any) {
      console.error('Sync error:', err)
      setSyncError(err?.message || 'Erro durante a sincronização.')
    } finally {
      syncInProgressRef.current = false
      setIsSyncing(false)
    }
  }, [checkPending, toast])

  // Explicit retry for failed items
  const retryFailed = useCallback(async () => {
    try {
      const [rdos, fields, projects] = await Promise.all([
        offlineStorage.getAllRdos(),
        offlineStorage.getAllFieldSheets(),
        offlineStorage.getAllProjects(),
      ])

      for (const r of rdos.filter((i) => i.syncStatus === 'failed')) {
        // If the ID has a provisional prefix, requeue as 'pending_create'; only real PocketBase 15-char IDs may be 'pending_update'.
        r.syncStatus = isProvisionalId(r.id) ? 'pending_create' : 'pending_update'
        delete r.syncError
        await offlineStorage.saveRdo(r)
      }
      for (const f of fields.filter((i) => i.syncStatus === 'failed')) {
        f.syncStatus = isProvisionalId(f.id) ? 'pending_create' : 'pending_update'
        delete f.syncError
        await offlineStorage.saveFieldSheet(f)
      }
      for (const p of projects.filter((i) => i.syncStatus === 'failed')) {
        p.syncStatus = isProvisionalId(p.id) ? 'pending_create' : 'pending_update'
        delete p.syncError
        await offlineStorage.saveProject(p)
      }

      await checkPending()
      await syncNow()
    } catch (err) {
      console.error('Error retrying failed items:', err)
    }
  }, [checkPending, syncNow])

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
        const s = conflict.serverData
        rdo.status = (s.status as 'draft' | 'submitted' | 'approved' | 'returned') || 'draft'
        rdo.activityTitle = String(s.activity_title || '')
        rdo.activityDescription = String(s.activity_description || '')
        rdo.returned_fields = (s.returned_fields as string[]) || rdo.returned_fields
        rdo.change_history = (s.change_history as any[]) || rdo.change_history
        rdo.syncStatus = 'synced'
        rdo.serverUpdatedAt = String(s.updated || '')
        await offlineStorage.saveRdo(rdo)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
      }
    } else if (conflict.type === 'field') {
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
        sheet.returned_fields = (s.returned_fields as string[]) || sheet.returned_fields
        sheet.change_history = (s.change_history as any[]) || sheet.change_history
        sheet.syncStatus = 'synced'
        sheet.serverUpdatedAt = String(s.updated || '')
        await offlineStorage.saveFieldSheet(sheet)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
      }
    } else {
      const proj = conflict.localData as OfflineProjectItem
      if (resolution === 'keep_local') {
        proj.syncStatus = 'pending_update'
        proj.lastModified = Date.now()
        await offlineStorage.saveProject(proj)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
        await syncNow()
      } else {
        const s = conflict.serverData
        proj.name = String(s.name || proj.name)
        proj.syncStatus = 'synced'
        proj.serverUpdatedAt = String(s.updated || '')
        await offlineStorage.saveProject(proj)
        setConflicts((prev) => prev.filter((c) => c.id !== conflict.id))
      }
    }
    toast({
      title: 'Conflito resolvido',
      description: 'A versão selecionada foi preservada com sucesso.',
    })
  }

  // Polling de segurança incremental a cada ~30s ou chamada direta
  const pullIncrementalServerData = useCallback(async () => {
    if (pullInProgressRef.current) return
    if (!navigator.onLine || !pb.authStore.isValid) return

    pullInProgressRef.current = true
    try {
      const authUser = pb.authStore.record
      const isAdmin = authUser?.role === 'admin'
      const userId = authUser?.id || ''

      const lastTimestamp = lastPullTimestampRef.current
      const dateFilter = lastTimestamp ? `updated >= "${lastTimestamp}"` : ''

      let projectFilter = isAdmin
        ? dateFilter || ''
        : dateFilter
          ? `assigned_users ~ "${userId}" && ${dateFilter}`
          : `assigned_users ~ "${userId}"`

      let anyChangeDetected = false

      // 1. Pull Projects
      try {
        const serverProjects = await pb.collection('projects').getFullList({
          filter: projectFilter || undefined,
          sort: '-updated',
        })

        let hasProjectChanges = false
        for (const record of serverProjects) {
          const local = await offlineStorage.getProject(record.id)
          // Preservação de rascunhos offline
          if (
            local &&
            (local.syncStatus === 'pending_create' ||
              local.syncStatus === 'pending_update' ||
              local.syncStatus === 'conflict')
          ) {
            continue
          }

          const assignedIds: string[] = Array.isArray(record.assigned_users)
            ? record.assigned_users
            : record.assigned_users
              ? [record.assigned_users]
              : []

          const updatedProject: OfflineProjectItem = {
            id: record.id,
            name: record.name,
            client: local?.client || 'Cliente EPA',
            code: record.epa_code || local?.code || 'EPA-001',
            location: record.location || local?.location || 'Área Operacional',
            status: record.status || local?.status || 'active',
            progress: record.progress ?? local?.progress ?? 0,
            contract: local?.contract || 'CT-2025',
            team: local?.team || ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
            rawClient: record.client,
            rawContract: record.contract,
            rawCompany: record.company,
            rawArea: record.area,
            assignedUsersIds: assignedIds,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
          }
          await offlineStorage.saveProject(updatedProject)
          hasProjectChanges = true
        }

        if (hasProjectChanges) {
          anyChangeDetected = true
          window.dispatchEvent(
            new CustomEvent<RealtimeRecordUpdateDetail>(REALTIME_RECORD_UPDATE, {
              detail: { collection: 'projects', id: '', action: 'update', record: null },
            }),
          )
        }
      } catch (projErr: any) {
        // Se a query falhar devido a dateFilter em formato estrito, tentar sem filtro de data
        if (dateFilter) {
          try {
            const fallbackFilter = !isAdmin && userId ? `assigned_users ~ "${userId}"` : undefined
            const serverProjects = await pb.collection('projects').getFullList({
              filter: fallbackFilter,
              sort: '-updated',
            })
            for (const record of serverProjects) {
              const local = await offlineStorage.getProject(record.id)
              if (
                local &&
                (local.syncStatus === 'pending_create' ||
                  local.syncStatus === 'pending_update' ||
                  local.syncStatus === 'conflict')
              ) {
                continue
              }
              const assignedIds: string[] = Array.isArray(record.assigned_users)
                ? record.assigned_users
                : record.assigned_users
                  ? [record.assigned_users]
                  : []
              const updatedProject: OfflineProjectItem = {
                id: record.id,
                name: record.name,
                client: local?.client || 'Cliente EPA',
                code: record.epa_code || local?.code || 'EPA-001',
                location: record.location || local?.location || 'Área Operacional',
                status: record.status || local?.status || 'active',
                progress: record.progress ?? local?.progress ?? 0,
                contract: local?.contract || 'CT-2025',
                team: local?.team || ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
                rawClient: record.client,
                rawContract: record.contract,
                rawCompany: record.company,
                rawArea: record.area,
                assignedUsersIds: assignedIds,
                archived: Boolean(record.archived),
                deleted: Boolean(record.deleted),
                deletedReason: record.deleted_reason || undefined,
                deletedBy: record.deleted_by || undefined,
                deletedAt: record.deleted_at || undefined,
                syncStatus: 'synced',
                lastModified: new Date(record.updated || Date.now()).getTime(),
                serverUpdatedAt: record.updated,
              }
              await offlineStorage.saveProject(updatedProject)
            }
          } catch {
            // ignore
          }
        }
        console.warn('Error pulling projects in polling:', projErr)
      }

      // Discover authorized project IDs for technician
      let allowedProjectIds: string[] = []
      if (!isAdmin && userId) {
        try {
          const cachedProjs = await offlineStorage.getAllProjects()
          allowedProjectIds = cachedProjs
            .filter((p) => !p.deleted && (p.assignedUsersIds || []).includes(userId))
            .map((p) => p.id)
        } catch {
          // ignore
        }
      }

      // 2. Pull RDOs
      try {
        let rdoFilter = dateFilter || ''
        if (!isAdmin && allowedProjectIds.length > 0) {
          const projClause = allowedProjectIds.map((pid) => `project = "${pid}"`).join(' || ')
          rdoFilter = rdoFilter ? `(${projClause}) && ${rdoFilter}` : `(${projClause})`
        } else if (!isAdmin && allowedProjectIds.length === 0) {
          rdoFilter = rdoFilter
            ? `performed_by = "${userId}" && ${rdoFilter}`
            : `performed_by = "${userId}"`
        }

        const serverRdos = await pb.collection('reports_rdo').getFullList({
          filter: rdoFilter || undefined,
          sort: '-updated',
        })

        let hasRdoChanges = false
        for (const record of serverRdos) {
          const local = await offlineStorage.getRdo(record.id)
          if (
            local &&
            (local.syncStatus === 'pending_create' ||
              local.syncStatus === 'pending_update' ||
              local.syncStatus === 'conflict')
          ) {
            continue
          }

          const updatedRdo: OfflineRdoItem = {
            id: record.id,
            number: record.number,
            projectId: record.project,
            projectName: local?.projectName || 'Projeto EPA',
            clientName: local?.clientName,
            contractCode: local?.contractCode,
            companyName: record.empresa_executora || local?.companyName || 'EPA Gestão Ambiental',
            location: local?.location,
            reportDate: record.report_date
              ? record.report_date.slice(0, 10)
              : local?.reportDate || '',
            weather: record.weather || local?.weather || 'Sol',
            performedBy: record.performed_by || local?.performedBy || '',
            performedByName: local?.performedByName,
            supervisedBy: record.supervised_by || local?.supervisedBy,
            supervisedByName: local?.supervisedByName,
            activityTitle: record.activity_title || '',
            activityDescription: record.activity_description || '',
            timeDisplacement: record.time_displacement || '',
            timeWaiting: record.time_waiting || '',
            interferences: record.interferences || '',
            planChanges: record.plan_changes || '',
            accidents: record.accidents || '',
            status: record.status || 'draft',
            reviewNotes: record.review_notes || '',
            returned_fields: record.returned_fields || undefined,
            returnedByName: record.returned_by_name || undefined,
            returnedAt: record.returned_at || undefined,
            submittedAt: record.submitted_at || local?.submittedAt,
            approvedAt: record.approved_at || local?.approvedAt,
            serverCreatedAt: record.created || local?.serverCreatedAt,
            change_history: record.change_history || undefined,
            wells: local?.wells || [],
            photos: local?.photos || [],
            fieldPhoto: local?.fieldPhoto,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
          }
          await offlineStorage.saveRdo(updatedRdo)
          hasRdoChanges = true
        }

        if (hasRdoChanges) {
          anyChangeDetected = true
          window.dispatchEvent(
            new CustomEvent<RealtimeRecordUpdateDetail>(REALTIME_RECORD_UPDATE, {
              detail: { collection: 'reports_rdo', id: '', action: 'update', record: null },
            }),
          )
        }
      } catch (rdoErr) {
        console.warn('Error pulling RDOs in polling:', rdoErr)
      }

      // 3. Pull Field Spreadsheets
      try {
        let fieldFilter = dateFilter || ''
        if (!isAdmin && allowedProjectIds.length > 0) {
          const projClause = allowedProjectIds.map((pid) => `project = "${pid}"`).join(' || ')
          fieldFilter = fieldFilter ? `(${projClause}) && ${fieldFilter}` : `(${projClause})`
        } else if (!isAdmin && allowedProjectIds.length === 0) {
          fieldFilter = fieldFilter
            ? `operator = "${userId}" && ${fieldFilter}`
            : `operator = "${userId}"`
        }

        const serverSheets = await pb.collection('field_spreadsheets').getFullList({
          filter: fieldFilter || undefined,
          sort: '-updated',
        })

        let hasFieldChanges = false
        for (const record of serverSheets) {
          const local = await offlineStorage.getFieldSheet(record.id)
          if (
            local &&
            (local.syncStatus === 'pending_create' ||
              local.syncStatus === 'pending_update' ||
              local.syncStatus === 'conflict')
          ) {
            continue
          }

          const rawExt = ((record.extraction_data as any) || []) as any[]
          const fallbackMorning = rawExt.find((r) => r.morning_time)?.morning_time || ''
          const fallbackAfternoon = rawExt.find((r) => r.afternoon_time)?.afternoon_time || ''

          const updatedSheet: OfflineFieldSheetItem = {
            id: record.id,
            number: record.number || local?.number,
            projectId: record.project,
            projectName: local?.projectName || 'Projeto EPA',
            clientName: local?.clientName,
            contractCode: local?.contractCode,
            date: record.date ? record.date.slice(0, 10) : local?.date || '',
            area: record.area || local?.area || 'Oficina Central',
            operator: record.operator || local?.operator || '',
            operatorName: local?.operatorName,
            weather: record.weather || local?.weather || 'Sol',
            pluviometer: record.pluviometer ?? local?.pluviometer ?? 0,
            morning_time: record.morning_time || fallbackMorning,
            afternoon_time: record.afternoon_time || fallbackAfternoon,
            infiltration_morning_time: record.infiltration_morning_time || '',
            infiltration_afternoon_time: record.infiltration_afternoon_time || '',
            extraction_data: record.extraction_data || [],
            infiltration_data: record.infiltration_data || {},
            nutrient_done: Boolean(record.nutrient_done),
            nutrient_map_kg: record.nutrient_map_kg || 0,
            nutrient_ureia_kg: record.nutrient_ureia_kg || 0,
            compressor_data: record.compressor_data || {},
            oil_removal_data: record.oil_removal_data || {},
            waste_liquid_qty: record.waste_liquid_qty || 0,
            waste_solid_qty: record.waste_solid_qty || 0,
            env_5s_check: Boolean(record.env_5s_check),
            env_checklist_monthly: Boolean(record.env_checklist_monthly),
            observations: record.observations || '',
            status: record.status || 'draft',
            reviewNotes: record.review_notes || '',
            returned_fields: record.returned_fields || undefined,
            returnedByName: record.returned_by_name || undefined,
            returnedAt: record.returned_at || undefined,
            submittedAt: record.submitted_at || local?.submittedAt,
            approvedAt: record.approved_at || local?.approvedAt,
            serverCreatedAt: record.created || local?.serverCreatedAt,
            change_history: record.change_history || undefined,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
          }
          await offlineStorage.saveFieldSheet(updatedSheet)
          hasFieldChanges = true
        }

        if (hasFieldChanges) {
          anyChangeDetected = true
          window.dispatchEvent(
            new CustomEvent<RealtimeRecordUpdateDetail>(REALTIME_RECORD_UPDATE, {
              detail: { collection: 'field_spreadsheets', id: '', action: 'update', record: null },
            }),
          )
        }
      } catch (sheetErr) {
        console.warn('Error pulling Field Sheets in polling:', sheetErr)
      }

      // 4. Se qualquer alteração foi baixada pelo polling, emitir broadcast geral
      if (anyChangeDetected) {
        window.dispatchEvent(
          new CustomEvent(SYNC_BROADCAST_EVENT, {
            detail: { syncedCount: 1, timestamp: Date.now() },
          }),
        )
      }

      // 5. Update and persist last pull timestamp
      const newPullTimestamp = new Date().toISOString()
      lastPullTimestampRef.current = newPullTimestamp
      localStorage.setItem('epa_last_pull_timestamp', newPullTimestamp)
    } catch (pullErr) {
      console.warn('Error in pullIncrementalServerData:', pullErr)
    } finally {
      pullInProgressRef.current = false
    }
  }, [])

  // Network and window lifecycle listeners (online event, window focus, periodic tick)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: '🟢 Conexão restabelecida',
        description: 'Você está online. Sincronizando dados com o sistema...',
      })
      syncNow()
      pullIncrementalServerData()
    }
    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: '🟠 Trabalhando offline',
        description: 'Sem conexão. Suas alterações serão salvas localmente no dispositivo.',
      })
    }

    const handleWindowFocus = () => {
      if (navigator.onLine && pb.authStore.isValid) {
        checkPending().then(() => {
          syncNow()
          pullIncrementalServerData()
        })
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && pb.authStore.isValid) {
        checkPending().then(() => {
          syncNow()
          pullIncrementalServerData()
        })
      }
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Anti-ressincronização inicial no carregamento se online
    if (navigator.onLine && pb.authStore.isValid) {
      const defaultWipe = new Date('2025-05-28T00:00:00Z').getTime()
      pb.collection('system_settings')
        .getFirstListItem('key = "last_operation_wipe_at"')
        .then(async (setting) => {
          const wipeTimestamp =
            setting && setting.value ? new Date(setting.value).getTime() : defaultWipe
          await offlineStorage.purgePreWipeOperationalData(wipeTimestamp)
          localStorage.setItem('epa_last_processed_wipe', String(wipeTimestamp))
          checkPending()
        })
        .catch(async () => {
          await offlineStorage.purgePreWipeOperationalData(defaultWipe)
          checkPending()
        })
    } else {
      // Offline fallback: purga imediatamente usando o timestamp de zeragem padrão
      const defaultWipe = new Date('2025-05-28T00:00:00Z').getTime()
      offlineStorage.purgePreWipeOperationalData(defaultWipe).then(() => checkPending())
    }

    // Initial check
    checkPending()

    // Polling de segurança a cada ~30s quando online para garantir que dados
    // sincronizados remotos sejam baixados mesmo se o websocket falhar
    const pollInterval = setInterval(() => {
      if (navigator.onLine && pb.authStore.isValid && !syncInProgressRef.current) {
        pullIncrementalServerData().then(() => {
          checkPending()
        })
      }
    }, 30000)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(pollInterval)
    }
  }, [syncNow, checkPending, toast])

  // Centralized Realtime Subscriptions for PocketBase collections:
  // 'reports_rdo', 'field_spreadsheets', 'projects', 'report_wells', 'report_photos', 'audit_logs'
  // Com reconexão automática ao evento 'online' e ao realtime reconnect do SDK,
  // tratamento de erro de subscrição com retry e backoff exponencial,
  // e atualização imediata do estado compartilhado com MERGE OBRIGATÓRIO (sobrescreve synced,
  // NUNCA rascunhos offline pendentes).
  useEffect(() => {
    if (!isOnline || !pb.authStore.isValid) return

    let cancelled = false
    const unsubscribes: Array<() => Promise<void>> = []
    let reconnectTimeout: any = null
    let retryAttempt = 0
    let isSubscribing = false
    const currentUserRecord = pb.authStore.record
    const isAdmin = currentUserRecord?.role === 'admin'
    const userId = currentUserRecord?.id || ''

    const broadcastUpdate = (detail: RealtimeRecordUpdateDetail) => {
      window.dispatchEvent(
        new CustomEvent<RealtimeRecordUpdateDetail>(REALTIME_RECORD_UPDATE, { detail }),
      )
    }

    // Helper: Verify if technician has permission to see an event/record
    const isRecordAllowedForTechnician = async (
      collection: 'projects' | 'reports_rdo' | 'field_spreadsheets',
      record: any,
    ): Promise<boolean> => {
      if (isAdmin) return true
      if (!userId) return false

      if (collection === 'projects') {
        const assigned: string[] = Array.isArray(record.assigned_users)
          ? record.assigned_users
          : record.assigned_users
            ? [record.assigned_users]
            : []
        return assigned.includes(userId)
      }

      // Para RDO e Planilhas: se o técnico é o performer/operador ou está no projeto atribuído
      if (collection === 'reports_rdo') {
        if (record.performed_by === userId || record.supervised_by === userId) return true
      }
      if (collection === 'field_spreadsheets') {
        if (record.operator === userId) return true
      }

      // Checa se o projeto do RDO/Planilha está entre os atribuídos ao técnico
      const targetProjId = record.project
      if (targetProjId) {
        try {
          const cachedProj = await offlineStorage.getProject(targetProjId)
          if (cachedProj && (cachedProj.assignedUsersIds || []).includes(userId)) {
            return true
          }
        } catch {
          // ignore
        }
      }

      return false
    }

    // Helper: Merge and Handle RDO realtime events
    const handleRdoEvent = async (action: 'create' | 'update' | 'delete', record: any) => {
      if (!record || !record.id) return
      try {
        const allowed = await isRecordAllowedForTechnician('reports_rdo', record)
        if (!allowed && !isAdmin) {
          return
        }

        const local = await offlineStorage.getRdo(record.id)
        // MERGE OBRIGATÓRIO: se o registro local é um rascunho offline pendente ou com conflito,
        // NUNCA sobrescrever com dados do servidor
        if (
          local &&
          (local.syncStatus === 'pending_create' ||
            local.syncStatus === 'pending_update' ||
            local.syncStatus === 'conflict')
        ) {
          broadcastUpdate({ collection: 'reports_rdo', id: record.id, action, record })
          return
        }

        if (action === 'delete') {
          if (local) {
            await offlineStorage.deleteRdo(record.id)
          }
        } else {
          // create ou update: dados do servidor sobrescrevem itens já sincronizados
          let wells = local?.wells || []
          let photos = local?.photos || []
          let fieldPhoto = local?.fieldPhoto

          try {
            const [serverWells, serverPhotos] = await Promise.all([
              pb
                .collection('report_wells')
                .getFullList({
                  filter: `report = "${record.id}"`,
                  sort: 'created',
                })
                .catch(() => []),
              pb
                .collection('report_photos')
                .getFullList({
                  filter: `report = "${record.id}"`,
                  sort: 'order',
                })
                .catch(() => []),
            ])

            if (serverWells && serverWells.length > 0) {
              wells = serverWells.map((w: any) => ({
                id: w.id,
                well_id: w.well_id,
                depth: w.depth,
                completion_date: w.completion_date ? w.completion_date.slice(0, 10) : undefined,
                diameter: w.diameter,
              }))
            }

            if (serverPhotos && serverPhotos.length > 0) {
              const inspection = serverPhotos.find((p: any) => p.category === 'field_inspection')
              const generals = serverPhotos.filter((p: any) => p.category !== 'field_inspection')
              if (inspection) {
                fieldPhoto = {
                  id: inspection.id,
                  image: inspection.image,
                  caption: inspection.caption,
                }
              }
              photos = generals.map((p: any) => ({
                id: p.id,
                image: p.image,
                caption: p.caption,
                order: p.order,
                category: 'general' as const,
              }))
            }
          } catch {
            // Em caso de erro ao buscar sub-itens, mantém os anteriores
          }

          let projectName = local?.projectName || 'Projeto EPA'
          let clientName = local?.clientName
          let contractCode = local?.contractCode
          let location = local?.location

          if (record.project) {
            try {
              const cachedProj = await offlineStorage.getProject(record.project)
              if (cachedProj) {
                projectName = cachedProj.name || projectName
                clientName = cachedProj.client || clientName
                contractCode = cachedProj.contract || contractCode
                location = cachedProj.location || location
              }
            } catch {
              // ignore
            }
          }

          const updatedItem: OfflineRdoItem = {
            id: record.id,
            number: record.number,
            projectId: record.project,
            projectName,
            clientName,
            contractCode,
            companyName: record.empresa_executora || local?.companyName || 'EPA Gestão Ambiental',
            location,
            reportDate: record.report_date
              ? record.report_date.slice(0, 10)
              : local?.reportDate || '',
            weather: record.weather || local?.weather || 'Sol',
            performedBy: record.performed_by || local?.performedBy || '',
            performedByName: local?.performedByName,
            supervisedBy: record.supervised_by || local?.supervisedBy,
            supervisedByName: local?.supervisedByName,
            activityTitle: record.activity_title || '',
            activityDescription: record.activity_description || '',
            timeDisplacement: record.time_displacement || '',
            timeWaiting: record.time_waiting || '',
            interferences: record.interferences || '',
            planChanges: record.plan_changes || '',
            accidents: record.accidents || '',
            status: record.status || 'draft',
            reviewNotes: record.review_notes || '',
            returned_fields: record.returned_fields || undefined,
            returnedByName: record.returned_by_name || undefined,
            returnedAt: record.returned_at || undefined,
            submittedAt: record.submitted_at || local?.submittedAt,
            approvedAt: record.approved_at || local?.approvedAt,
            serverCreatedAt: record.created || local?.serverCreatedAt,
            change_history: record.change_history || undefined,
            wells,
            photos,
            fieldPhoto,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
          }
          await offlineStorage.saveRdo(updatedItem)
        }
      } catch (err) {
        console.warn('Error handling realtime RDO event in offlineStorage:', err)
      } finally {
        broadcastUpdate({ collection: 'reports_rdo', id: record.id, action, record })
      }
    }

    // Helper: Merge and Handle Field Spreadsheet realtime events
    const handleFieldEvent = async (action: 'create' | 'update' | 'delete', record: any) => {
      if (!record || !record.id) return
      try {
        const allowed = await isRecordAllowedForTechnician('field_spreadsheets', record)
        if (!allowed && !isAdmin) {
          return
        }

        const local = await offlineStorage.getFieldSheet(record.id)
        // MERGE OBRIGATÓRIO: rascunhos pendentes locais NUNCA são sobrescritos
        if (
          local &&
          (local.syncStatus === 'pending_create' ||
            local.syncStatus === 'pending_update' ||
            local.syncStatus === 'conflict')
        ) {
          broadcastUpdate({ collection: 'field_spreadsheets', id: record.id, action, record })
          return
        }

        if (action === 'delete') {
          if (local) {
            await offlineStorage.deleteFieldSheet(record.id)
          }
        } else {
          const rawExt = ((record.extraction_data as any) || []) as any[]
          const fallbackMorning = rawExt.find((r) => r.morning_time)?.morning_time || ''
          const fallbackAfternoon = rawExt.find((r) => r.afternoon_time)?.afternoon_time || ''

          let projectName = local?.projectName || 'Projeto EPA'
          let clientName = local?.clientName
          let contractCode = local?.contractCode

          if (record.project) {
            try {
              const cachedProj = await offlineStorage.getProject(record.project)
              if (cachedProj) {
                projectName = cachedProj.name || projectName
                clientName = cachedProj.client || clientName
                contractCode = cachedProj.contract || contractCode
              }
            } catch {
              // ignore
            }
          }

          const updatedSheet: OfflineFieldSheetItem = {
            id: record.id,
            number: record.number || local?.number,
            projectId: record.project,
            projectName,
            clientName,
            contractCode,
            date: record.date ? record.date.slice(0, 10) : local?.date || '',
            area: record.area || local?.area || 'Oficina Central',
            operator: record.operator || local?.operator || '',
            operatorName: local?.operatorName,
            weather: record.weather || local?.weather || 'Sol',
            pluviometer: record.pluviometer ?? local?.pluviometer ?? 0,
            morning_time: record.morning_time || fallbackMorning,
            afternoon_time: record.afternoon_time || fallbackAfternoon,
            infiltration_morning_time: record.infiltration_morning_time || '',
            infiltration_afternoon_time: record.infiltration_afternoon_time || '',
            extraction_data: record.extraction_data || [],
            infiltration_data: record.infiltration_data || {},
            nutrient_done: Boolean(record.nutrient_done),
            nutrient_map_kg: record.nutrient_map_kg || 0,
            nutrient_ureia_kg: record.nutrient_ureia_kg || 0,
            compressor_data: record.compressor_data || {},
            oil_removal_data: record.oil_removal_data || {},
            waste_liquid_qty: record.waste_liquid_qty || 0,
            waste_solid_qty: record.waste_solid_qty || 0,
            env_5s_check: Boolean(record.env_5s_check),
            env_checklist_monthly: Boolean(record.env_checklist_monthly),
            observations: record.observations || '',
            status: record.status || 'draft',
            reviewNotes: record.review_notes || '',
            returned_fields: record.returned_fields || undefined,
            returnedByName: record.returned_by_name || undefined,
            returnedAt: record.returned_at || undefined,
            submittedAt: record.submitted_at || local?.submittedAt,
            approvedAt: record.approved_at || local?.approvedAt,
            serverCreatedAt: record.created || local?.serverCreatedAt,
            change_history: record.change_history || undefined,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
          }
          await offlineStorage.saveFieldSheet(updatedSheet)
        }
      } catch (err) {
        console.warn('Error handling realtime FieldSheet event in offlineStorage:', err)
      } finally {
        broadcastUpdate({ collection: 'field_spreadsheets', id: record.id, action, record })
      }
    }

    // Helper: Merge and Handle Projects realtime events
    const handleProjectEvent = async (action: 'create' | 'update' | 'delete', record: any) => {
      if (!record || !record.id) return
      try {
        const allowed = await isRecordAllowedForTechnician('projects', record)
        if (!allowed && !isAdmin) {
          await offlineStorage.deleteProject(record.id)
          broadcastUpdate({ collection: 'projects', id: record.id, action: 'delete', record })
          return
        }

        const local = await offlineStorage.getProject(record.id)
        // MERGE OBRIGATÓRIO: rascunhos pendentes locais NUNCA são sobrescritos
        if (
          local &&
          (local.syncStatus === 'pending_create' ||
            local.syncStatus === 'pending_update' ||
            local.syncStatus === 'conflict')
        ) {
          broadcastUpdate({ collection: 'projects', id: record.id, action, record })
          return
        }

        if (action === 'delete') {
          if (local) {
            await offlineStorage.deleteProject(record.id)
          }
        } else {
          const assignedIds: string[] = Array.isArray(record.assigned_users)
            ? record.assigned_users
            : record.assigned_users
              ? [record.assigned_users]
              : []

          const updatedProject: OfflineProjectItem = {
            id: record.id,
            name: record.name,
            client: local?.client || 'Cliente EPA',
            code: record.epa_code || local?.code || 'EPA-001',
            location: record.location || local?.location || 'Área Operacional',
            status: record.status || local?.status || 'active',
            progress: record.progress ?? local?.progress ?? 0,
            contract: local?.contract || 'CT-2025',
            team: local?.team || ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
            rawClient: record.client,
            rawContract: record.contract,
            rawCompany: record.company,
            rawArea: record.area,
            assignedUsersIds: assignedIds,
            archived: Boolean(record.archived),
            deleted: Boolean(record.deleted),
            deletedReason: record.deleted_reason || undefined,
            deletedBy: record.deleted_by || undefined,
            deletedAt: record.deleted_at || undefined,
            syncStatus: 'synced',
            lastModified: new Date(record.updated || Date.now()).getTime(),
            serverUpdatedAt: record.updated,
          }
          await offlineStorage.saveProject(updatedProject)
        }
      } catch (err) {
        console.warn('Error handling realtime Project event in offlineStorage:', err)
      } finally {
        broadcastUpdate({ collection: 'projects', id: record.id, action, record })
      }
    }

    // Helper: Handle child collections (report_wells, report_photos, wells)
    const handleReportSubCollection = async (
      colName: string,
      action: 'create' | 'update' | 'delete',
      record: any,
    ) => {
      if (colName === 'wells' && record?.project) {
        try {
          const updatedWells = await pb.collection('wells').getFullList({
            filter: `project = "${record.project}" && active = true`,
            sort: 'identification',
          })
          await offlineStorage.saveProjectWells(record.project, updatedWells)
        } catch (wErr) {
          console.warn('Erro ao atualizar poços no IndexedDB via realtime:', wErr)
        }
      }
      broadcastUpdate({ collection: colName, id: record?.id || '', action, record })
    }

    // Cancelar subscrições ativas
    const cancelExistingSubscriptions = async () => {
      while (unsubscribes.length > 0) {
        const fn = unsubscribes.pop()
        try {
          await fn?.()
        } catch {
          // ignore
        }
      }
    }

    // Subscrição com retry e backoff exponencial
    const setupSubscriptions = async () => {
      if (cancelled || !navigator.onLine || !pb.authStore.isValid) return
      if (isSubscribing) return
      isSubscribing = true

      await cancelExistingSubscriptions()

      try {
        const promises: Promise<() => Promise<void>>[] = [
          pb.collection('reports_rdo').subscribe('*', (e) => {
            handleRdoEvent(e.action as 'create' | 'update' | 'delete', e.record)
          }),
          pb.collection('field_spreadsheets').subscribe('*', (e) => {
            handleFieldEvent(e.action as 'create' | 'update' | 'delete', e.record)
          }),
          pb.collection('projects').subscribe('*', (e) => {
            handleProjectEvent(e.action as 'create' | 'update' | 'delete', e.record)
          }),
          pb.collection('report_wells').subscribe('*', (e) => {
            handleReportSubCollection(
              'report_wells',
              e.action as 'create' | 'update' | 'delete',
              e.record,
            )
          }),
          pb.collection('report_photos').subscribe('*', (e) => {
            handleReportSubCollection(
              'report_photos',
              e.action as 'create' | 'update' | 'delete',
              e.record,
            )
          }),
          pb.collection('wells').subscribe('*', (e) => {
            handleReportSubCollection('wells', e.action as 'create' | 'update' | 'delete', e.record)
          }),
        ]

        if (isAdmin) {
          promises.push(
            pb.collection('audit_logs').subscribe('*', (e) => {
              broadcastUpdate({
                collection: 'audit_logs',
                id: e.record.id,
                action: e.action as 'create' | 'update' | 'delete',
                record: e.record,
              })
            }),
          )
        }

        const subs = await Promise.all(promises)

        if (cancelled) {
          subs.forEach((fn) => fn().catch(() => {}))
        } else {
          unsubscribes.push(...subs)
          retryAttempt = 0 // reset backoff on success
          console.log('[Realtime] Subscrições PocketBase conectadas com sucesso.')
        }
      } catch (subErr) {
        console.warn('[Realtime] Erro ao subscrever coleções PocketBase:', subErr)
        // Retry com backoff exponencial: 2s, 4s, 8s, até max 30s
        if (!cancelled && navigator.onLine) {
          retryAttempt++
          const delay = Math.min(1000 * Math.pow(2, retryAttempt), 30000)
          clearTimeout(reconnectTimeout)
          reconnectTimeout = setTimeout(() => {
            if (!cancelled && navigator.onLine && pb.authStore.isValid) {
              setupSubscriptions()
            }
          }, delay)
        }
      } finally {
        isSubscribing = false
      }
    }

    setupSubscriptions()

    // 1. Reconexão ao evento 'online' do navegador: cancelar e refazer subscrições + polling
    const handleOnlineEvent = () => {
      console.log('[Realtime] Evento online detectado: reconectando subscrições e puxando dados...')
      retryAttempt = 0
      clearTimeout(reconnectTimeout)
      setupSubscriptions()
      pullIncrementalServerData()
    }
    window.addEventListener('online', handleOnlineEvent)

    // 2. Reconexão ao realtime reconnect do PocketBase SDK
    // O PocketBase Client expõe o realtime (EventSource/SSE) com hooks e reconexão automática
    const realtimeService = (pb as any).realtime
    let handleSdkReconnect: (() => void) | null = null
    if (realtimeService && typeof realtimeService.onConnect === 'function') {
      handleSdkReconnect = () => {
        console.log(
          '[Realtime] PocketBase SDK reconectado ao servidor SSE. Renovando subscrições...',
        )
        pullIncrementalServerData()
      }
      try {
        realtimeService.onConnect(handleSdkReconnect)
      } catch {
        // ignore if not supported
      }
    }

    // 3. Observa mudanças de autenticação/token no pb.authStore
    const unsubAuth = pb.authStore.onChange(() => {
      if (pb.authStore.isValid) {
        setupSubscriptions()
      }
    })

    return () => {
      cancelled = true
      clearTimeout(reconnectTimeout)
      window.removeEventListener('online', handleOnlineEvent)
      unsubAuth()
      cancelExistingSubscriptions()
    }
  }, [isOnline, pullIncrementalServerData])

  return (
    <SyncContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        failedCount,
        failedItems,
        lastSyncTime,
        syncError,
        conflicts,
        syncNow,
        retryFailed,
        resolveConflict,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  return useContext(SyncContext)
}
