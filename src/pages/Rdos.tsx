import { useState, useEffect, useRef } from 'react'
import {
  isValidDeletionJustification,
  INVALID_JUSTIFICATION_MESSAGE,
} from '@/lib/justificationValidator'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Upload,
  User,
  Wrench,
  X,
  Building,
  CloudSun,
  ShieldCheck,
  RotateCcw,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { SheetSyncBadge } from '@/components/SheetSyncBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import {
  useSync,
  SYNC_BROADCAST_EVENT,
  REALTIME_RECORD_UPDATE,
  RealtimeRecordUpdateDetail,
} from '@/context/SyncContext'
import { offlineStorage, OfflineRdoItem } from '@/services/offlineStorage'
import { authHeaders, exportUrl, updateRdoStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { type Status } from '@/data/epa'
import { EPA_LOGO_BASE64 } from '@/components/epaLogoBase64'
import { CorrectionHistorySection } from '@/components/CorrectionHistorySection'
import {
  RDO_RETURN_OPTIONS,
  createRdoSnapshot,
  diffRdo,
  appendOrUpdateReturnCycle,
} from '@/services/historyDiffService'

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

export function RdosPage({ query }: { query: string }) {
  const [editing, setEditing] = useState<OfflineRdoItem | null>(null)
  const [items, setItems] = useState<OfflineRdoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tabFilter, setTabFilter] = useState<'active' | 'archived' | 'deleted'>('active')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
  const [deleteModalRdo, setDeleteModalRdo] = useState<OfflineRdoItem | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const { isSyncing: isGlobalSyncing, retrySyncItem } = useSync()

  const loadRdos = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      // 1. Load from IndexedDB
      // RBAC check: Técnico e Administrador têm acesso ao RDO
      if (user && user.role !== 'admin' && user.role !== 'technician') {
        toast({
          title: 'Você não possui permissão para esta função.',
          description: 'Acesso restrito ao perfil Técnico e Administrador.',
          variant: 'destructive',
        })
        setItems([])
        setLoading(false)
        return
      }

      // Verificação da data da zeragem operacional do sistema (v0.0.70+)
      // Fallback seguro: data de criação da zeragem no backend: 2025-05-28T00:00:00Z
      let wipeTimestamp = new Date('2025-05-28T00:00:00Z').getTime()
      try {
        if (navigator.onLine && pb.authStore.isValid) {
          const wipeSetting = await pb
            .collection('system_settings')
            .getFirstListItem('key = "last_operation_wipe_at"')
            .catch(() => null)
          if (wipeSetting?.value) {
            wipeTimestamp = new Date(wipeSetting.value).getTime()
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar data da zeragem em RDOs:', err)
      }

      let localRdos = await offlineStorage.getAllRdos()

      // 2. Se online e PocketBase disponível, sincroniza cache com os IDs reais do servidor
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const records = await pb.collection('reports_rdo').getFullList({
            sort: '-number',
            expand:
              'project,project.client,project.contract,project.company,performed_by,supervised_by,deleted_by',
          })

          const serverRdoIds = new Set(records.map((r) => r.id))

          // Purga do IndexedDB: qualquer registro pré-zeragem ou registro sincronizado que
          // não exista no servidor é removido (preservando rascunhos pendentes pós-zeragem).
          await offlineStorage.purgePreWipeOperationalData(wipeTimestamp, {
            knownServerRdoIds: serverRdoIds,
            purgeAllSynced: records.length === 0,
          })

          for (const rec of records) {
            const existingLocal = localRdos.find((l) => l.id === rec.id)
            if (!existingLocal || existingLocal.syncStatus === 'synced') {
              // Fetch report wells and photos if not cached
              const wells = await pb.collection('report_wells').getFullList({
                filter: `report = "${rec.id}"`,
                sort: 'created',
              })
              const photos = await pb.collection('report_photos').getFullList({
                filter: `report = "${rec.id}"`,
                sort: 'order',
              })

              const proj = rec.expand?.project as any
              const client = proj?.expand?.client as any
              const contract = proj?.expand?.contract as any
              const company = proj?.expand?.company as any
              const performer = rec.expand?.performed_by as any
              const supervisor = rec.expand?.supervised_by as any

              const fieldInspectionPhoto = photos.find(
                (p) => (p as any).category === 'field_inspection',
              )
              const generalPhotos = photos.filter((p) => (p as any).category !== 'field_inspection')

              const rawSnapshot = (rec as any).admin_snapshot
              const parsedSnapshot =
                typeof rawSnapshot === 'string' && rawSnapshot.trim() !== ''
                  ? JSON.parse(rawSnapshot)
                  : rawSnapshot && typeof rawSnapshot === 'object'
                    ? rawSnapshot
                    : undefined

              // Poços: se vieram de report_wells, usa eles. Se não houver nenhum em report_wells,
              // usa os poços guardados dentro do admin_snapshot do próprio registro!
              let finalWells = wells.map((w) => ({
                id: w.id,
                well_id: w.well_id,
                depth: w.depth,
                completion_date: w.completion_date ? w.completion_date.slice(0, 10) : undefined,
                diameter: w.diameter,
              }))
              if (
                finalWells.length === 0 &&
                parsedSnapshot?.wells &&
                Array.isArray(parsedSnapshot.wells) &&
                parsedSnapshot.wells.length > 0
              ) {
                finalWells = parsedSnapshot.wells.map((w: any) => ({
                  id: w.id,
                  well_id: w.well_id,
                  depth: w.depth,
                  completion_date: w.completion_date
                    ? String(w.completion_date).slice(0, 10)
                    : undefined,
                  diameter: w.diameter,
                }))
              }

              const item: OfflineRdoItem = {
                id: rec.id,
                number: rec.number,
                projectId: rec.project,
                projectName: proj?.name || 'Recuperação Ambiental Lote A',
                clientName: client?.name || 'Petrobras — Refinaria Sul',
                contractCode: contract?.code || 'CT-EPA-2025-017',
                companyName:
                  (rec as any).empresa_executora || company?.name || 'EPA Gestão Ambiental',
                location: proj?.location || 'Refinaria Sul — Área Industrial',
                reportDate: rec.report_date ? rec.report_date.slice(0, 10) : '2025-05-28',
                weather: rec.weather || 'Sol',
                performedBy: rec.performed_by,
                performedByName: performer?.name || 'Carlos Oliveira',
                supervisedBy: rec.supervised_by,
                supervisedByName:
                  parsedSnapshot?.supervised_by_name || supervisor?.name || 'Marina Santos',
                activityTitle: rec.activity_title || '',
                activityDescription: rec.activity_description || '',
                timeDisplacement: rec.time_displacement || '',
                timeWaiting: rec.time_waiting || '',
                interferences: rec.interferences || '',
                planChanges: rec.plan_changes || '',
                accidents: rec.accidents || '',
                status: rec.status,
                reviewNotes: rec.review_notes || '',
                returned_fields: (rec as any).returned_fields || undefined,
                returnedByName: (rec as any).returned_by_name || undefined,
                returnedAt: (rec as any).returned_at || undefined,
                submittedAt: (rec as any).submitted_at || undefined,
                approvedAt: (rec as any).approved_at || undefined,
                serverCreatedAt: rec.created || undefined,
                change_history: (rec as any).change_history || undefined,
                admin_snapshot: parsedSnapshot || existingLocal?.admin_snapshot,
                wells: finalWells,
                photos: generalPhotos.map((p) => ({
                  id: p.id,
                  image: p.image,
                  caption: p.caption,
                  order: p.order,
                  category: 'general',
                })),
                fieldPhoto: fieldInspectionPhoto
                  ? {
                      id: fieldInspectionPhoto.id,
                      image: fieldInspectionPhoto.image,
                      caption: fieldInspectionPhoto.caption,
                    }
                  : undefined,
                syncStatus: 'synced',
                lastModified: new Date(rec.updated).getTime(),
                serverUpdatedAt: rec.updated,
                archived: Boolean(rec.archived),
                deleted: Boolean(rec.deleted),
                deletedReason: rec.deleted_reason || undefined,
                deletedBy: rec.deleted_by || undefined,
                deletedByName: (rec.expand?.deleted_by as any)?.name || undefined,
                deletedAt: rec.deleted_at || undefined,
              }
              await offlineStorage.saveRdo(item)
            }
          }
          localRdos = await offlineStorage.getAllRdos()
        } catch (err) {
          console.warn('Could not refresh RDOs from server:', err)
        }
      } else {
        // Modo offline: purga local para garantir que nenhum dado pré-zeragem seja exibido
        await offlineStorage.purgePreWipeOperationalData(wipeTimestamp)
        localRdos = await offlineStorage.getAllRdos()
      }

      // Sort by number descending (se não tiver número no servidor, ordena pela data de criação/modificação)
      localRdos.sort((a, b) => {
        const numA = typeof a.number === 'number' && a.number > 0 ? a.number : 0
        const numB = typeof b.number === 'number' && b.number > 0 ? b.number : 0
        if (numA !== numB) return numB - numA
        const dateA = a.serverCreatedAt
          ? new Date(a.serverCreatedAt).getTime()
          : a.lastModified || 0
        const dateB = b.serverCreatedAt
          ? new Date(b.serverCreatedAt).getTime()
          : b.lastModified || 0
        return dateB - dateA
      })
      setItems(localRdos)
    } catch (err) {
      console.error('Error loading RDOs:', err)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadRdos()

    const handleSyncComplete = () => {
      loadRdos({ silent: true })
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeRecordUpdateDetail>
      const col = customEvent.detail?.collection
      if (
        col === 'reports_rdo' ||
        col === 'report_wells' ||
        col === 'report_photos' ||
        col === 'projects' ||
        col === 'wells'
      ) {
        loadRdos({ silent: true })
      }
    }

    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    }
  }, [])

  const filtered = items.filter((r) => {
    let matchesTab = false
    if (tabFilter === 'deleted') {
      matchesTab = Boolean(r.deleted)
    } else if (tabFilter === 'archived') {
      matchesTab = !r.deleted && Boolean(r.archived)
    } else {
      matchesTab = !r.deleted && !r.archived
    }
    const matchesStatus = tabFilter === 'deleted' ? true : filter === 'all' || r.status === filter
    const numDisplay =
      typeof r.number === 'number' && r.number > 0 ? `RDO Nº ${r.number}` : 'RDO Offline'
    const matchesQuery =
      `${numDisplay} ${r.projectName} ${r.activityTitle} ${r.deletedReason || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
    return matchesTab && matchesStatus && matchesQuery
  })

  const openNew = async () => {
    // Look up an active project to prefill project references
    let initialProjectId = ''
    let initialProjectName = ''
    let initialClientName = 'Petrobras — Refinaria Sul'
    let initialContractCode = 'CT-EPA-2025-017'
    let initialCompanyName = 'EPA Engenharia de Proteção Ambiental'
    let initialLocation = 'Refinaria Sul — Área Operacional'
    let baseSheetRdo: any = undefined

    try {
      const localProjects = await offlineStorage.getAllProjects()
      let activeProj: any = undefined

      if (user?.role === 'technician') {
        activeProj = localProjects.find(
          (p) =>
            !p.deleted &&
            !p.archived &&
            p.status === 'active' &&
            Array.isArray(p.assignedUsersIds) &&
            p.assignedUsersIds.includes(user.id),
        )
      }
      if (!activeProj) {
        activeProj =
          localProjects.find((p) => !p.deleted && !p.archived && p.status === 'active') ||
          localProjects[0]
      }

      if (activeProj) {
        initialProjectId = activeProj.id
        initialProjectName = activeProj.name
        initialClientName = activeProj.client || initialClientName
        initialContractCode = activeProj.contract || initialContractCode
        initialLocation = activeProj.location || initialLocation
        if (activeProj.base_sheet_published && activeProj.base_sheet_rdo) {
          baseSheetRdo = activeProj.base_sheet_rdo
        }
      }
    } catch (e) {
      console.warn('Could not read cached projects for new RDO:', e)
    }

    // Os poços são gerenciados diretamente na ficha (report_wells / formData.wells)
    let preloadedWells: OfflineRdoItem['wells'] = []

    if (baseSheetRdo?.wells && Array.isArray(baseSheetRdo.wells) && baseSheetRdo.wells.length > 0) {
      preloadedWells = baseSheetRdo.wells.map((w: any) => ({
        well_id: w.well_id,
        depth: w.depth !== undefined && w.depth !== null ? Number(w.depth) : undefined,
        completion_date: w.completion_date || '',
        diameter: w.diameter || '4"',
      }))
    } else {
      try {
        if (initialProjectId) {
          let projectWells = await offlineStorage.getProjectWells(initialProjectId)
          if (
            (!projectWells || projectWells.length === 0) &&
            navigator.onLine &&
            pb.authStore.isValid
          ) {
            try {
              projectWells = await pb.collection('wells').getFullList({
                filter: `project = "${initialProjectId}" && active = true`,
                sort: 'identification',
              })
              if (projectWells.length > 0) {
                await offlineStorage.saveProjectWells(initialProjectId, projectWells)
              }
            } catch {
              // fallback
            }
          }
          if (projectWells && projectWells.length > 0) {
            preloadedWells = projectWells
              .filter((pw: any) => pw.active !== false)
              .map((pw: any) => ({
                well_id: pw.identification || pw.well_id,
                depth: pw.depth !== undefined && pw.depth !== null ? Number(pw.depth) : undefined,
                completion_date: '',
                diameter: pw.default_diameter || pw.diameter || '4"',
              }))
          }
        }

        if (preloadedWells.length === 0) {
          const existingRdos = items.filter(
            (r) =>
              !r.deleted &&
              (r.projectId === initialProjectId || r.projectName === initialProjectName),
          )
          const lastRdo = existingRdos[0]
          if (lastRdo && lastRdo.wells && lastRdo.wells.length > 0) {
            preloadedWells = lastRdo.wells.map((w) => ({
              well_id: w.well_id,
              depth: w.depth,
              completion_date: '',
              diameter: w.diameter || '4"',
            }))
          } else {
            preloadedWells = [
              {
                well_id: 'PR-01',
                depth: 8.0,
                completion_date: '',
                diameter: '4"',
              },
              {
                well_id: 'PR-02',
                depth: 8.0,
                completion_date: '',
                diameter: '4"',
              },
            ]
          }
        }
      } catch (e) {
        preloadedWells = [
          {
            well_id: 'PR-01',
            depth: 8.0,
            completion_date: '',
            diameter: '4"',
          },
        ]
      }
    }

    const nowIso = new Date().toISOString()
    const finalCompanyName = (baseSheetRdo?.empresa_executora || initialCompanyName).trim()
    const finalSupervisedBy = (
      baseSheetRdo?.supervised_by ||
      (user?.role === 'admin' ? user?.id : '') ||
      ''
    ).trim()
    const finalSupervisedByName = (
      baseSheetRdo?.supervised_by_name ||
      (user?.role === 'admin' ? user?.name : '') ||
      ''
    ).trim()
    const finalActivityTitle = (baseSheetRdo?.activity_title || '').trim()
    const finalActivityDescription = (baseSheetRdo?.activity_description_base || '').trim()

    let initialSnapshot: any = undefined

    if (baseSheetRdo) {
      // Ficha base ativa do projeto: gera o snapshot que trava os campos no Técnico
      initialSnapshot = {
        supervised_by: finalSupervisedBy,
        supervised_by_name: finalSupervisedByName,
        performed_by: (baseSheetRdo.performed_by || '').trim(),
        performed_by_name: (baseSheetRdo.performed_by_name || '').trim(),
        empresa_executora: finalCompanyName,
        wells: (preloadedWells || []).map((w) => ({
          well_id: w.well_id,
          depth: w.depth,
          completion_date: w.completion_date || '',
          diameter: w.diameter || '',
        })),
        filled_fields: {
          supervisedBy: finalSupervisedBy,
          supervisedByName: finalSupervisedByName,
          companyName: finalCompanyName,
          ...(finalActivityTitle ? { activityTitle: finalActivityTitle } : {}),
          ...(finalActivityDescription ? { activityDescription: finalActivityDescription } : {}),
          ...(baseSheetRdo.filled_fields || {}),
        },
        captured_at: nowIso,
      }
    } else if (user?.role === 'admin') {
      initialSnapshot = {
        supervised_by: user?.id || '',
        supervised_by_name: (user?.name || '').trim(),
        performed_by: '',
        performed_by_name: '',
        empresa_executora: initialCompanyName,
        wells: (preloadedWells || []).map((w) => ({
          well_id: w.well_id,
          depth: w.depth,
          completion_date: w.completion_date || '',
          diameter: w.diameter || '',
        })),
        filled_fields: {
          supervisedBy: user?.id || '',
          supervisedByName: (user?.name || '').trim(),
          companyName: initialCompanyName,
        },
        captured_at: nowIso,
      }
    }

    const newReport: OfflineRdoItem = {
      id: 'rdo_' + Date.now(),
      number: undefined,
      projectId: initialProjectId,
      projectName: initialProjectName,
      clientName: initialClientName,
      contractCode: initialContractCode,
      companyName: finalCompanyName,
      location: initialLocation,
      reportDate: nowIso.slice(0, 10),
      weather: 'Sol',
      performedBy: user?.role === 'technician' ? user?.id || '' : baseSheetRdo?.performed_by || '',
      performedByName:
        user?.role === 'technician' ? user?.name || '' : baseSheetRdo?.performed_by_name || '',
      supervisedBy: finalSupervisedBy,
      supervisedByName: finalSupervisedByName,
      activityTitle: finalActivityTitle,
      activityDescription: finalActivityDescription,
      timeDisplacement: '',
      timeWaiting: '',
      interferences: '',
      planChanges: '',
      accidents: '',
      status: 'draft',
      wells: preloadedWells,
      photos: [],
      fieldPhoto: undefined,
      admin_snapshot: initialSnapshot,
      syncStatus: 'pending_create',
      lastModified: Date.now(),
    }
    setIsNew(true)
    setEditing(newReport)
  }

  if (editing) {
    return (
      <RdoFullPageEditor
        report={editing}
        isNew={isNew}
        onBack={() => {
          setEditing(null)
          setIsNew(false)
          loadRdos()
        }}
        onSaved={() => {
          loadRdos()
        }}
        onDelete={() => setDeleteModalRdo(editing)}
        onToggleArchive={() => handleToggleArchiveRdo(editing)}
        actionLoading={actionLoadingId === editing.id}
      />
    )
  }

  const activeCount = items.filter((r) => !r.deleted && !r.archived).length
  const archivedCount = items.filter((r) => !r.deleted && Boolean(r.archived)).length
  const deletedCount = items.filter((r) => Boolean(r.deleted)).length

  const confirmDeleteRdo = async () => {
    if (!deleteModalRdo) return
    if (user?.role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta ação.',
        description: 'Apenas Administradores podem excluir relatórios.',
        variant: 'destructive',
      })
      setDeleteModalRdo(null)
      setDeleteReason('')
      return
    }

    const trimmedReason = deleteReason.trim()
    if (!isValidDeletionJustification(trimmedReason)) {
      toast({
        title: 'Justificativa inválida',
        description: INVALID_JUSTIFICATION_MESSAGE,
        variant: 'destructive',
      })
      return
    }

    const rdoToDelete = deleteModalRdo
    setIsDeleting(true)
    try {
      const nowIso = new Date().toISOString()
      const updatedItem: OfflineRdoItem = {
        ...rdoToDelete,
        deleted: true,
        deletedReason: trimmedReason,
        deletedBy: user?.id,
        deletedByName: user?.name,
        deletedAt: nowIso,
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      // Sync to PocketBase backend first if online to validate permissions and real server persistence
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          await pb.collection('reports_rdo').update(rdoToDelete.id, {
            deleted: true,
            deleted_reason: trimmedReason,
            deleted_by: user?.id || null,
            deleted_at: nowIso,
          })
          updatedItem.syncStatus = 'synced'
        } catch (pbErr: any) {
          console.error('Backend soft delete error:', pbErr)
          const reason =
            pbErr?.data?.message ||
            pbErr?.message ||
            'Erro de permissão ou falha de comunicação com o servidor ao excluir o RDO.'
          throw new Error(reason)
        }
      }

      // Save soft-deleted in local IndexedDB
      await offlineStorage.saveRdo(updatedItem)

      setItems((prev) => prev.map((item) => (item.id === rdoToDelete.id ? updatedItem : item)))
      if (editing?.id === rdoToDelete.id) {
        setEditing(null)
      }

      const deleteLabel =
        typeof rdoToDelete.number === 'number' && rdoToDelete.number > 0
          ? `RDO Nº ${rdoToDelete.number}`
          : 'RDO Offline'
      toast({
        title: 'RDO excluído e arquivado com sucesso',
        description: `O ${deleteLabel} foi movido para os itens excluídos com justificativa registrada.`,
      })
      setDeleteModalRdo(null)
      setDeleteReason('')
    } catch (err: any) {
      console.error('Delete RDO error:', err)
      toast({
        title: 'Não foi possível excluir o RDO',
        description:
          err.message ||
          'Falha ao registrar a exclusão. O modal permanece aberto para nova tentativa.',
        variant: 'destructive',
      })
      // Mantém o modal aberto e não limpa deleteReason para o Admin tentar novamente
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleArchiveRdo = async (rdo: OfflineRdoItem) => {
    const nextArchived = !rdo.archived
    setActionLoadingId(rdo.id)
    try {
      const updated: OfflineRdoItem = {
        ...rdo,
        archived: nextArchived,
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      // Update in local IndexedDB
      await offlineStorage.saveRdo(updated)

      // Update in PocketBase if online
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          await pb.collection('reports_rdo').update(rdo.id, {
            archived: nextArchived,
          })
          updated.syncStatus = 'synced'
          await offlineStorage.saveRdo(updated)
        } catch (serverErr: any) {
          console.warn('Archive update failed on server, queued for sync:', serverErr)
        }
      }

      setItems((prev) => prev.map((item) => (item.id === rdo.id ? updated : item)))
      if (editing?.id === rdo.id) {
        setEditing(updated)
      }

      const archiveLabel =
        typeof rdo.number === 'number' && rdo.number > 0 ? `RDO Nº ${rdo.number}` : 'RDO Offline'
      toast({
        title: nextArchived ? 'RDO arquivado' : 'RDO desarquivado',
        description: nextArchived
          ? `O ${archiveLabel} foi movido para os arquivados.`
          : `O ${archiveLabel} foi restaurado para a listagem ativa.`,
      })
    } catch (err: any) {
      console.error('Toggle archive error:', err)
      toast({
        title: 'Erro ao alterar estado de arquivamento',
        description: err.message || 'Verifique suas permissões.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const baseItems = items.filter((r) =>
    tabFilter === 'deleted'
      ? Boolean(r.deleted)
      : tabFilter === 'archived'
        ? !r.deleted && Boolean(r.archived)
        : !r.deleted && !r.archived,
  )

  const counts = {
    draft: baseItems.filter((r) => r.status === 'draft').length,
    submitted: baseItems.filter((r) => r.status === 'submitted').length,
    approved: baseItems.filter((r) => r.status === 'approved').length,
    returned: baseItems.filter((r) => r.status === 'returned').length,
  }

  return (
    <div className="space-y-6">
      {/* Abas Ativos vs Arquivados vs Excluídos (Admin) */}
      <div className="flex items-center gap-2 border-b pb-2 dark:border-slate-800">
        <button
          onClick={() => setTabFilter('active')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
            tabFilter === 'active'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
          )}
        >
          <FileText className="h-4 w-4" />
          RDOs Ativos ({activeCount})
        </button>
        {user?.role !== 'technician' && (
          <button
            onClick={() => setTabFilter('archived')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
              tabFilter === 'archived'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Archive className="h-4 w-4" />
            Arquivados ({archivedCount})
          </button>
        )}
        {user?.role === 'admin' && (
          <button
            onClick={() => setTabFilter('deleted')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
              tabFilter === 'deleted'
                ? 'bg-red-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Trash2 className="h-4 w-4" />
            Excluídos ({deletedCount})
          </button>
        )}
      </div>

      {tabFilter === 'archived' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <b>Visualização de RDOs Arquivados:</b> Relatórios arquivados para histórico em modo
              somente leitura. Você pode desarquivá-los a qualquer momento para retorná-los à
              listagem ativa.
            </span>
          </div>
        </div>
      )}

      {tabFilter === 'deleted' && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 shrink-0 text-red-600" />
            <span>
              <b>Arquivo de RDOs Excluídos (Acesso Restrito a Administrador):</b> Registros
              excluídos logicamente do sistema. Seus dados, poços vinculados e fotografias
              permanecem preservados para auditoria junto à justificativa do responsável.
            </span>
          </div>
        </div>
      )}

      {/* Counters filter */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Rascunhos', count: counts.draft, status: 'draft' as Status },
          { label: 'Aguardando aprovação', count: counts.submitted, status: 'submitted' as Status },
          { label: 'Aprovados', count: counts.approved, status: 'approved' as Status },
          { label: 'Devolvidos', count: counts.returned, status: 'returned' as Status },
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => setFilter(filter === item.status ? 'all' : item.status)}
            className={cn(
              'epa-card flex items-center justify-between p-4 text-left transition hover:shadow-md min-h-[72px]',
              filter === item.status &&
                'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20',
            )}
          >
            <div>
              <p className="text-2xl font-semibold">{item.count}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
            </div>
            <StatusBadge status={item.status} compact />
          </button>
        ))}
      </div>

      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-center dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              readOnly
              placeholder="Filtro de busca ativo no topo..."
              className="pl-9 dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          {filter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilter('all')}
              className="w-fit text-xs dark:border-slate-800"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Limpar filtro ({filter})
            </Button>
          )}
          <Button
            onClick={openNew}
            className="w-full sm:w-fit bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo RDO
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-slate-500">Carregando RDOs...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
            <p className="mt-3 text-sm font-semibold">Nenhum RDO encontrado</p>
            <p className="mt-1 text-xs text-slate-500">
              {filter !== 'all'
                ? `Não há relatórios com status "${filter}".`
                : 'Clique no botão acima para criar o primeiro RDO.'}
            </p>
          </div>
        ) : (
          <div className="table-scroll-container">
            <table className="w-full min-w-[860px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">RDO / Data</th>
                  <th className="px-5 py-3.5">Projeto & Local</th>
                  <th className="px-5 py-3.5">Atividade</th>
                  <th className="px-5 py-3.5">Responsáveis</th>
                  <th className="px-5 py-3.5">Status & Sync</th>
                  <th className="px-5 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {filtered.map((report) => (
                  <tr
                    key={report.id}
                    className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {typeof report.number === 'number' && report.number > 0 ? (
                          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            RDO Nº {report.number}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            RDO Offline
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {report.reportDate} · {report.weather}
                      </p>
                      {report.serverCreatedAt && (
                        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          Criado:{' '}
                          {new Date(report.serverCreatedAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                      {report.submittedAt && report.status !== 'draft' && (
                        <p className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                          Enviado:{' '}
                          {new Date(report.submittedAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                      {report.approvedAt && report.status === 'approved' && (
                        <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Aprovado:{' '}
                          {new Date(report.approvedAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                      {report.returnedAt && report.status === 'returned' && (
                        <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                          Devolvido:{' '}
                          {new Date(report.returnedAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </p>
                      )}
                    </td>
                    <td className="max-w-[220px] px-5 py-4">
                      <p className="truncate text-sm font-medium">{report.projectName}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <MapPin className="h-3 w-3" />
                        {report.location || 'Área operacional'}
                      </p>
                    </td>
                    <td className="max-w-[260px] px-5 py-4">
                      <p className="truncate text-sm text-slate-700 dark:text-slate-300">
                        {report.activityTitle || '(Sem título)'}
                      </p>
                      <p className="mt-1 flex gap-3 text-[10px] text-slate-400">
                        <span>{report.wells?.length || 0} poços</span>
                        <span>{report.photos?.length || 0} fotos</span>
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-xs font-medium">{report.performedByName || 'Técnico'}</p>
                      <p className="text-[10px] text-slate-400">
                        {report.supervisedByName || 'Técnico'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={report.status} />
                          <SheetSyncBadge
                            syncStatus={report.syncStatus}
                            isGlobalSyncing={isGlobalSyncing}
                            syncError={report.syncError}
                            onRetry={() => retrySyncItem?.(report.id, 'rdo')}
                          />
                        </div>
                        {report.syncError && report.syncStatus === 'failed' && (
                          <p
                            className="max-w-[200px] truncate text-[10px] text-red-600 dark:text-red-400 font-medium"
                            title={report.syncError}
                          >
                            Motivo: {report.syncError}
                          </p>
                        )}
                        {report.reviewNotes && (
                          <p className="max-w-40 truncate text-[10px] text-amber-700 dark:text-amber-400">
                            {report.reviewNotes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!report.deleted && (
                          <>
                            {user?.role !== 'technician' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleArchiveRdo(report)
                                }}
                                disabled={actionLoadingId === report.id}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                                title={report.archived ? 'Desarquivar RDO' : 'Arquivar RDO'}
                              >
                                {actionLoadingId === report.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : report.archived ? (
                                  <ArchiveRestore className="h-4 w-4 text-amber-600" />
                                ) : (
                                  <Archive className="h-4 w-4" />
                                )}
                              </button>
                            )}
                            {user?.role === 'admin' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteModalRdo(report)
                                  setDeleteReason('')
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                                title="Excluir RDO (apenas Admin com justificativa)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                        {report.deleted && (
                          <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                            Excluído
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            // Se o RDO não possui poços carregados, busca poços ativos do projeto para herança
                            if (!report.wells || report.wells.length === 0) {
                              try {
                                const targetPid = report.projectId
                                if (targetPid) {
                                  let projWells = await offlineStorage.getProjectWells(targetPid)
                                  if (
                                    (!projWells || projWells.length === 0) &&
                                    navigator.onLine &&
                                    pb.authStore.isValid
                                  ) {
                                    try {
                                      projWells = await pb.collection('wells').getFullList({
                                        filter: `project = "${targetPid}" && active = true`,
                                        sort: 'identification',
                                      })
                                      if (projWells.length > 0) {
                                        await offlineStorage.saveProjectWells(targetPid, projWells)
                                      }
                                    } catch {
                                      // ignore
                                    }
                                  }
                                  if (projWells && projWells.length > 0) {
                                    report.wells = projWells
                                      .filter((pw: any) => pw.active !== false)
                                      .map((pw: any) => ({
                                        well_id: pw.identification || pw.well_id,
                                        depth:
                                          pw.depth !== undefined && pw.depth !== null
                                            ? Number(pw.depth)
                                            : undefined,
                                        completion_date: '',
                                        diameter: pw.default_diameter || pw.diameter || '4"',
                                      }))
                                    await offlineStorage.saveRdo(report)
                                  }
                                }
                              } catch (wErr) {
                                console.warn('Erro ao herdar poços do projeto ao abrir RDO:', wErr)
                              }
                            }
                            setEditing(report)
                            setIsNew(false)
                          }}
                          className="text-xs hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-800 min-h-[36px]"
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          {report.deleted
                            ? 'Ver Arquivado'
                            : report.archived
                              ? 'Visualizar'
                              : user?.role === 'technician' &&
                                  (report.status === 'submitted' || report.status === 'approved')
                                ? 'Visualizar'
                                : 'Abrir / Editar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de confirmação de exclusão do RDO com justificativa obrigatória */}
      {deleteModalRdo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 dark:bg-red-950/50">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir{' '}
                  {typeof deleteModalRdo.number === 'number' && deleteModalRdo.number > 0
                    ? `RDO Nº ${deleteModalRdo.number}`
                    : 'RDO Offline'}
                </h3>
                <p className="text-xs text-slate-500">
                  Exclusão com método de segurança e auditoria
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Você está prestes a excluir o relatório{' '}
              <b className="text-slate-900 dark:text-white">
                {typeof deleteModalRdo.number === 'number' && deleteModalRdo.number > 0
                  ? `RDO Nº ${deleteModalRdo.number}`
                  : 'RDO Offline'}{' '}
                — {deleteModalRdo.projectName}
              </b>
              .
            </p>

            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              🛡️ <b>Registro e Arquivamento:</b> O item não desaparecerá do banco de dados. Ele será
              marcado como excluído logicamente e ficará arquivado na aba <b>"Excluídos"</b>{' '}
              (visível apenas para Administradores), preservando os poços e fotos para trilha de
              auditoria.
            </div>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Justificativa da Exclusão{' '}
                <span className="text-red-500">* (obrigatória e fundamentada)</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Informe uma justificativa válida explicando o motivo da exclusão..."
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {isValidDeletionJustification(deleteReason)
                    ? '✓ Justificativa válida'
                    : 'Informe uma justificativa real para a exclusão'}
                </span>
                <span>{deleteReason.length} caracteres</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteModalRdo(null)
                  setDeleteReason('')
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={confirmDeleteRdo}
                className="bg-red-600 hover:bg-red-700 text-white min-w-[130px] disabled:opacity-50"
              >
                {isDeleting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Excluindo...
                  </span>
                ) : (
                  'Confirmar Exclusão'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * REQUISITO OBRIGATÓRIO #3: TODAS AS INFORMAÇÕES EM UMA ÚNICA TELA (RDO)
 * Sem múltiplos passos "Próximo". Numa mesma página, rolável, na ordem:
 * Cabeçalho → Atividade → Descrição → Tabela de Poços → Registro Fotográfico →
 * Acidentes/Incidentes → Interferências/Dificuldades → Mudanças no Plano → Tempos → Ações.
 */
function RdoFullPageEditor({
  report: initialReport,
  isNew,
  onBack,
  onSaved,
  onDelete,
  onToggleArchive,
  actionLoading,
}: {
  report: OfflineRdoItem
  isNew: boolean
  onBack: () => void
  onSaved: () => void
  onDelete?: () => void
  onToggleArchive?: () => void
  actionLoading?: boolean
}) {
  const [formData, setFormData] = useState<OfflineRdoItem>({ ...initialReport })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(initialReport.reviewNotes || '')
  const [reviewReturnedFields, setReviewReturnedFields] = useState<string[]>(
    initialReport.returned_fields || [],
  )

  const isReturnedField = (fieldName: string) =>
    formData.status === 'returned' && !!formData.returned_fields?.includes(fieldName)

  const clearReturnedField = (fieldName: string) => {
    if (formData.returned_fields?.includes(fieldName)) {
      setFormData((prev) => ({
        ...prev,
        returned_fields: prev.returned_fields?.filter((f) => f !== fieldName),
      }))
    }
  }
  const galleryPhotosInputRef = useRef<HTMLInputElement>(null)
  const cameraPhotosInputRef = useRef<HTMLInputElement>(null)
  const galleryFieldPhotoInputRef = useRef<HTMLInputElement>(null)
  const cameraFieldPhotoInputRef = useRef<HTMLInputElement>(null)

  const { user, setHasUnsavedChanges } = useAuth()
  const { isOnline, syncNow } = useSync()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isTechnician = user?.role === 'technician'
  const isDeleted = Boolean(formData.deleted)
  // O Técnico fica estritamente bloqueado (somente leitura) quando o status for 'submitted' ou 'approved'.
  // Apenas Administradores podem editar nesses estados, ou o Técnico quando o Admin devolver ('returned' / 'draft').
  const isLocked =
    (!isAdmin && (formData.status === 'approved' || formData.status === 'submitted')) || isDeleted

  // Snapshot administrativo gravado no registro persistido (fonte da verdade definitiva)
  // Prioriza o admin_snapshot vindo do servidor / initialReport ou do próprio formData
  const adminSnapshot = initialReport.admin_snapshot || formData.admin_snapshot
  const snapshotWells = adminSnapshot?.wells || []
  const snapshotFilledFields = (adminSnapshot?.filled_fields || {}) as Record<string, any>

  const isFieldLockedByAdmin = (field: string) =>
    !isAdmin &&
    snapshotFilledFields[field] !== undefined &&
    snapshotFilledFields[field] !== null &&
    String(snapshotFilledFields[field]).trim() !== ''

  const handleFieldChange = (field: keyof OfflineRdoItem, value: any) => {
    if (isFieldLockedByAdmin(field as string)) {
      return
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  // Wells Handlers (Os poços são cadastrados diretamente na ficha pelo Administrador)
  // O Técnico só pode adicionar poço se o Admin não pré-configurou poços na ficha (snapshotWells vazio e initialReport.wells vazio)
  const canAddWell =
    isAdmin ||
    ((!snapshotWells || snapshotWells.length === 0) &&
      (!initialReport.wells || initialReport.wells.length === 0))
  const handleAddWell = () => {
    if (!canAddWell) return
    const nextIndex = (formData.wells?.length || 0) + 1
    const newWell = {
      well_id: `PM-${String(nextIndex).padStart(2, '0')}`,
      depth: 8.0,
      completion_date: formData.reportDate || new Date().toISOString().slice(0, 10),
      diameter: '2"',
    }
    const updated = [...(formData.wells || []), newWell]
    handleFieldChange('wells', updated)
    toast({
      title: 'Poço adicionado à ficha',
      description: `Poço ${newWell.well_id} inserido na tabela.`,
    })
  }

  const isWellRowEmpty = (well: any) => {
    if (!well) return true
    const idEmpty = !well.well_id || !String(well.well_id).trim()
    const depthEmpty =
      well.depth === undefined || well.depth === null || String(well.depth).trim() === ''
    const dateEmpty = !well.completion_date || !String(well.completion_date).trim()
    const diamEmpty = !well.diameter || !String(well.diameter).trim()
    return idEmpty && depthEmpty && dateEmpty && diamEmpty
  }

  const handleRemoveWell = (index: number) => {
    const persistedWell = initialReport.wells?.[index]
    const snapWell = snapshotWells?.[index]
    const lockedWell = snapWell || persistedWell
    if (!isAdmin && lockedWell && !isWellRowEmpty(lockedWell)) {
      toast({
        title: 'Ação não permitida',
        description: 'Técnicos não podem remover poços configurados pelo Administrador.',
        variant: 'destructive',
      })
      return
    }
    const targetWell = formData.wells?.[index]
    if (!isAdmin && !isWellRowEmpty(targetWell)) {
      toast({
        title: 'Ação não permitida',
        description: 'Técnicos só podem remover poços vazios inseridos na ficha.',
        variant: 'destructive',
      })
      return
    }
    const updated = [...(formData.wells || [])]
    updated.splice(index, 1)
    handleFieldChange('wells', updated)
    toast({ title: 'Poço removido', description: 'Linha excluída da tabela.' })
  }

  const handleWellFieldChange = (index: number, field: string, value: any) => {
    const currentWell = formData.wells?.[index]
    if (!currentWell) return

    if (!isAdmin) {
      const snapWell = snapshotWells?.[index]
      const persistedWell = initialReport.wells?.[index]
      const rawSnapVal = snapWell ? (snapWell as any)[field] : undefined
      const rawPersistedVal = persistedWell ? (persistedWell as any)[field] : undefined
      const valToCheck = rawSnapVal !== undefined ? rawSnapVal : rawPersistedVal
      const hasLockedVal =
        valToCheck !== undefined && valToCheck !== null && String(valToCheck).trim() !== ''
      if (hasLockedVal) {
        return
      }
    }

    const updated = [...(formData.wells || [])]
    updated[index] = { ...updated[index], [field]: value }
    handleFieldChange('wells', updated)
  }

  // Photos Handlers
  const handleAddPhotoFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const dataUrl = uploadEvent.target?.result as string
        const newPhoto = {
          id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          caption: `Registro de campo — ${formData.projectName}`,
          order: formData.photos?.length || 0,
          dataUrl,
        }
        setFormData((prev) => ({
          ...prev,
          photos: [...(prev.photos || []), newPhoto],
        }))
        setHasUnsavedChanges(true)
        toast({
          title: 'Foto adicionada',
          description: 'Imagem armazenada localmente com sucesso.',
        })
      }
      reader.readAsDataURL(file)
    })
    if (galleryPhotosInputRef.current) galleryPhotosInputRef.current.value = ''
    if (cameraPhotosInputRef.current) cameraPhotosInputRef.current.value = ''
  }

  const handleRemovePhoto = (index: number) => {
    const updated = [...(formData.photos || [])]
    updated.splice(index, 1)
    handleFieldChange('photos', updated)
    toast({ title: 'Foto excluída', description: 'Registro fotográfico removido.' })
  }

  const handlePhotoCaptionChange = (index: number, caption: string) => {
    const updated = [...(formData.photos || [])]
    updated[index] = { ...updated[index], caption }
    handleFieldChange('photos', updated)
  }

  // Field/Inspection Photo Handlers
  const handleSelectFieldPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string
      const fieldPhotoObj = {
        id: 'field_photo_' + Date.now(),
        caption:
          formData.fieldPhoto?.caption || 'Figura 01 – Mapa de localização da área de interesse.',
        dataUrl,
      }
      setFormData((prev) => ({
        ...prev,
        fieldPhoto: fieldPhotoObj,
      }))
      setHasUnsavedChanges(true)
      toast({
        title: 'Foto do campo adicionada',
        description: 'Imagem do local da inspeção salva localmente com sucesso.',
      })
    }
    reader.readAsDataURL(file)
    if (galleryFieldPhotoInputRef.current) galleryFieldPhotoInputRef.current.value = ''
    if (cameraFieldPhotoInputRef.current) cameraFieldPhotoInputRef.current.value = ''
  }

  const handleRemoveFieldPhoto = () => {
    setFormData((prev) => ({
      ...prev,
      fieldPhoto: undefined,
    }))
    setHasUnsavedChanges(true)
    toast({
      title: 'Foto do campo removida',
      description: 'A fotografia do local da inspeção foi excluída.',
    })
  }

  const handleFieldPhotoCaptionChange = (caption: string) => {
    setFormData((prev) => ({
      ...prev,
      fieldPhoto: prev.fieldPhoto ? { ...prev.fieldPhoto, caption } : undefined,
    }))
    setHasUnsavedChanges(true)
  }

  // Save logic (Draft or Submitted)
  const saveReport = async (targetStatus?: Status) => {
    if (isLocked) {
      toast({
        title: 'Documento bloqueado para edição',
        description:
          'Não é possível alterar este RDO enquanto aguarda aprovação ou estiver aprovado.',
        variant: 'destructive',
      })
      return
    }

    // Check project association
    if (!formData.projectId || isProvisionalId(formData.projectId)) {
      try {
        const localProjects = await offlineStorage.getAllProjects()
        const activeProj =
          localProjects.find((p) => !p.deleted && !p.archived && p.status === 'active') ||
          localProjects[0]
        if (activeProj && !isProvisionalId(activeProj.id)) {
          formData.projectId = activeProj.id
          formData.projectName = formData.projectName || activeProj.name
        }
      } catch (e) {
        console.warn('Error resolving active project on RDO save:', e)
      }
    }

    if (!formData.projectId) {
      toast({
        title: 'Projeto obrigatório não selecionado para o RDO',
        description: 'Vincule um projeto ao relatório antes de salvar.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    // Se o Admin estiver despachando/atribuindo o RDO ao Técnico, o status mantém-se 'draft'
    // (a permissão já permite ao Técnico editar rascunhos 'draft' e devoluções 'returned', sem sujar o histórico com devolução).
    // O status 'returned' ocorre EXCLUSIVAMENTE quando o RDO já estava 'submitted' e o Admin clica expressamente em "Devolver para correção".
    // Para o Técnico enviando para aprovação, targetStatus é 'submitted'.
    const effectiveStatus: Status =
      targetStatus === 'submitted'
        ? isAdmin
          ? 'draft'
          : 'submitted'
        : targetStatus || formData.status

    // Rastreamento de alterações pós-devolução pelo Técnico
    let updatedHistory = formData.change_history ? [...formData.change_history] : []
    const nowIso = new Date().toISOString()

    if (formData.status === 'returned' || updatedHistory.length > 0) {
      const lastIndex = updatedHistory.length - 1
      const activeCycle = lastIndex >= 0 ? updatedHistory[lastIndex] : null
      if (activeCycle?.snapshot) {
        const changes = diffRdo(activeCycle.snapshot, formData, user?.id, user?.name || 'Técnico')
        updatedHistory[lastIndex] = {
          ...activeCycle,
          changes,
          correctedBy: user?.id,
          correctedByName: user?.name || 'Técnico',
          correctedAt: nowIso,
          submittedAt: targetStatus === 'submitted' ? nowIso : activeCycle.submittedAt,
        }
      }
    }

    // Se quem está salvando é o Admin, gera e atualiza o admin_snapshot contendo
    // supervised_by_name (texto puro), performed_by/performed_by_name, empresa_executora,
    // wells completos com valores preenchidos e o dicionário completo filled_fields.
    // Se for o Técnico salvando, preserva o admin_snapshot que já veio do Admin/servidor.
    let currentAdminSnapshot = formData.admin_snapshot || initialReport.admin_snapshot
    if (isAdmin) {
      const wellsSnapshot = (formData.wells || []).map((w) => ({
        id: w.id,
        well_id: String(w.well_id || '').trim(),
        depth:
          w.depth !== undefined && w.depth !== null && String(w.depth).trim() !== ''
            ? Number(w.depth)
            : undefined,
        completion_date: w.completion_date ? String(w.completion_date).trim() : '',
        diameter: w.diameter ? String(w.diameter).trim() : '',
      }))

      // Mapeia genericamente todos os campos do formulário preenchidos pelo Administrador
      const excludedKeys = new Set([
        'id',
        'status',
        'syncStatus',
        'lastModified',
        'photos',
        'fieldPhoto',
        'wells',
        'change_history',
        'admin_snapshot',
        'created',
        'updated',
        'projectId',
        'projectName',
      ])
      const filledFieldsMap: Record<string, any> = {}
      Object.entries(formData).forEach(([key, value]) => {
        if (excludedKeys.has(key)) return
        if (value === undefined || value === null) return
        if (typeof value === 'string' && value.trim() === '') return
        filledFieldsMap[key] = value
      })
      if (formData.companyName && String(formData.companyName).trim()) {
        filledFieldsMap.empresa_executora = String(formData.companyName).trim()
      }

      const effectiveSupName = (formData.supervisedByName || user?.name || '').trim()

      currentAdminSnapshot = {
        supervised_by: formData.supervisedBy || user?.id || '',
        supervised_by_name: effectiveSupName,
        performed_by: formData.performedBy || '',
        performed_by_name: (formData.performedByName || '').trim(),
        empresa_executora: (formData.companyName || '').trim(),
        wells: wellsSnapshot,
        filled_fields: filledFieldsMap,
        captured_at: nowIso,
      }
    }

    const updatedItem: OfflineRdoItem = {
      ...formData,
      status: effectiveStatus,
      change_history: updatedHistory,
      admin_snapshot: currentAdminSnapshot,
      syncStatus: isNew || isProvisionalId(formData.id) ? 'pending_create' : 'pending_update',
      lastModified: Date.now(),
    }

    try {
      await offlineStorage.saveRdo(updatedItem)
      setFormData(updatedItem)
      setHasUnsavedChanges(false)

      if (isOnline) {
        await syncNow()
      }

      toast({
        title:
          targetStatus === 'submitted'
            ? isAdmin
              ? 'RDO disponibilizado ao Técnico'
              : 'RDO enviado para aprovação'
            : 'RDO salvo com sucesso',
        description:
          targetStatus === 'submitted' && isAdmin
            ? 'RDO atribuído e liberado para preenchimento do Técnico.'
            : isOnline
              ? 'Dados sincronizados com o servidor.'
              : 'Salvo localmente no dispositivo (IndexedDB). Sincronizará quando voltar a internet.',
      })
      onSaved()
    } catch (err) {
      console.error('Error saving RDO:', err)
      toast({
        title: 'Não foi possível realizar esta ação',
        description: 'Erro ao gravar informações.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Admin Approval / Return
  const handleAdminStatusChange = async (nextStatus: 'approved' | 'returned') => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        description: 'Apenas Administradores podem aprovar ou devolver relatórios.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const nowIso = new Date().toISOString()
      let updatedHistory = formData.change_history ? [...formData.change_history] : []

      if (nextStatus === 'returned') {
        const snapshot = createRdoSnapshot(formData)
        const requestedLabels = reviewReturnedFields.map((fId) => {
          const opt = RDO_RETURN_OPTIONS.find((o) => o.id === fId)
          return opt ? opt.label : fId
        })

        const cycleResult = appendOrUpdateReturnCycle(updatedHistory, undefined, {
          returnedAt: nowIso,
          returnedBy: user?.id,
          returnedByName: user?.name || 'Administrador',
          returnReason: reviewNotes || 'Ajustes solicitados.',
          requestedFields: reviewReturnedFields,
          requestedFieldsLabels: requestedLabels,
          snapshot,
        })
        updatedHistory = cycleResult.history
      }

      const updatedItem: OfflineRdoItem = {
        ...formData,
        status: nextStatus,
        reviewNotes: nextStatus === 'returned' ? reviewNotes : '',
        returned_fields:
          nextStatus === 'returned' ? reviewReturnedFields : formData.returned_fields,
        returnedByName:
          nextStatus === 'returned' ? user?.name || 'Administrador' : formData.returnedByName,
        returnedAt: nextStatus === 'returned' ? nowIso : formData.returnedAt,
        change_history: updatedHistory.length > 0 ? updatedHistory : formData.change_history,
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      await offlineStorage.saveRdo(updatedItem)
      setFormData(updatedItem)
      setReviewOpen(false)
      setHasUnsavedChanges(false)

      if (isOnline) {
        try {
          await updateRdoStatus(
            formData.id,
            nextStatus,
            reviewNotes,
            nextStatus === 'returned' ? reviewReturnedFields : undefined,
            user?.name || 'Administrador',
            nextStatus === 'returned' ? updatedHistory : undefined,
          )
        } catch {
          // ignore if offline / mock
        }
        await syncNow()
      }

      toast({
        title:
          nextStatus === 'approved' ? 'RDO aprovado com sucesso' : 'RDO devolvido para correção',
        description:
          nextStatus === 'approved'
            ? 'O relatório foi bloqueado para edições.'
            : 'O técnico foi notificado para os ajustes.',
      })
      onSaved()
    } catch (err) {
      console.error('Admin status error:', err)
      toast({
        title: 'Erro ao processar alteração',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // PDF Export (Apenas Administradores têm permissão de visualizar/exportar PDF do RDO)
  const canExportPdf = isAdmin

  const handleExportPdf = async () => {
    if (!canExportPdf) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Exportação permitida para Administradores.',
        variant: 'destructive',
      })
      return
    }

    setIsExporting(true)
    try {
      if (isOnline) {
        try {
          const res = await fetch(exportUrl('rdo', formData.id), { headers: authHeaders() })
          if (res.ok) {
            const html = await res.text()
            const popup = window.open('', '_blank')
            if (popup) {
              popup.document.open()
              popup.document.write(html)
              popup.document.close()
              popup.focus()
              setTimeout(() => popup.print(), 500)
              toast({
                title: 'PDF gerado com sucesso',
                description: 'Documento oficial pronto para impressão/salvar em PDF.',
              })
              return
            }
          }
        } catch (serverErr) {
          console.warn('Server export failed, falling back to local generator:', serverErr)
        }
      }

      // Offline / Fallback client-side HTML print generation matching official model
      generateLocalPdfPrint(formData)
      toast({
        title: 'PDF gerado com sucesso',
        description: 'Documento oficial formatado segundo o padrão EPA.',
      })
    } catch (err) {
      console.error('PDF error:', err)
      toast({
        title: 'Não foi possível gerar o PDF',
        description: 'Erro ao gerar documento para impressão.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Top sticky bar for easy actions on tablet & desktop */}
      <div className="sticky top-[72px] z-20 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-md backdrop-blur md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/95">
        <div>
          <button
            onClick={onBack}
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à lista de RDOs
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              {typeof formData.number === 'number' && formData.number > 0
                ? `RDO Nº ${formData.number}`
                : 'RDO (Rascunho Offline)'}
            </h2>
            <StatusBadge status={formData.status} />
            <SheetSyncBadge
              syncStatus={formData.syncStatus}
              isGlobalSyncing={isOnline && formData.syncStatus === 'pending_update'}
              syncError={formData.syncError}
            />
            {formData.serverCreatedAt && (
              <span className="hidden sm:inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Criado:{' '}
                {new Date(formData.serverCreatedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            )}
            {formData.submittedAt && (
              <span className="hidden md:inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                Enviado:{' '}
                {new Date(formData.submittedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            )}
            {formData.approvedAt && (
              <span className="hidden md:inline-block rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                Aprovado:{' '}
                {new Date(formData.approvedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            )}
            {formData.returnedAt && (
              <span className="hidden md:inline-block rounded-md bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                Devolvido:{' '}
                {new Date(formData.returnedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            )}
            {isDeleted ? (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                Item Excluído (Arquivado para auditoria)
              </span>
            ) : isLocked ? (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold',
                  formData.status === 'submitted'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                )}
              >
                {formData.status === 'submitted'
                  ? 'Bloqueado — Aguardando aprovação do Administrador'
                  : 'Bloqueado após aprovação'}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Arquivar / Desarquivar (não aplicável a itens excluídos nem para técnicos) */}
          {!isDeleted && !isTechnician && onToggleArchive && (
            <Button
              variant="outline"
              onClick={onToggleArchive}
              disabled={actionLoading}
              className="min-h-[44px] text-xs font-semibold dark:border-slate-800"
            >
              {actionLoading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : formData.archived ? (
                <ArchiveRestore className="mr-1.5 h-4 w-4 text-amber-600" />
              ) : (
                <Archive className="mr-1.5 h-4 w-4 text-slate-500" />
              )}
              {formData.archived ? 'Desarquivar RDO' : 'Arquivar RDO'}
            </Button>
          )}

          {/* Excluir (Admin apenas, quando ainda não estiver excluído) */}
          {!isDeleted && isAdmin && onDelete && (
            <Button
              variant="ghost"
              onClick={onDelete}
              className="min-h-[44px] text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Excluir
            </Button>
          )}

          {canExportPdf && (
            <Button
              variant="outline"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="min-h-[44px] text-xs font-semibold dark:border-slate-800"
            >
              {isExporting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PDF...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Visualizar / Exportar PDF
                </span>
              )}
            </Button>
          )}

          {!isLocked && !formData.archived && (
            <>
              <Button
                variant="outline"
                onClick={() => saveReport('draft')}
                disabled={isSaving}
                className="min-h-[44px] text-xs font-semibold dark:border-slate-800"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Salvar rascunho
              </Button>
              <Button
                onClick={() => saveReport('submitted')}
                disabled={isSaving || !formData.activityTitle.trim()}
                className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white flex-1 sm:flex-none"
              >
                <Send className="mr-1.5 h-4 w-4" />
                {isAdmin ? 'Atribuir ao Técnico' : 'Enviar para aprovação'}
              </Button>{' '}
            </>
          )}

          {isAdmin && formData.status === 'submitted' && !formData.archived && (
            <>
              <Button
                onClick={() => handleAdminStatusChange('approved')}
                disabled={isSaving}
                className="min-h-[44px] bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-semibold"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Aprovar RDO
              </Button>
              <Button
                variant="outline"
                onClick={() => setReviewOpen(true)}
                disabled={isSaving}
                className="min-h-[44px] border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold dark:border-amber-700 dark:text-amber-300"
              >
                <AlertCircle className="mr-1.5 h-4 w-4" />
                Devolver para correção
              </Button>
            </>
          )}
        </div>
      </div>

      {isDeleted && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/40 space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-red-900 dark:text-red-200 text-sm">
                RDO Excluído pelo Administrador
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                Excluído em:{' '}
                {formData.deletedAt
                  ? new Date(formData.deletedAt).toLocaleString('pt-BR')
                  : 'Data registrada no servidor'}{' '}
                {formData.deletedByName ? `· por ${formData.deletedByName}` : ''}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 p-3.5 text-xs text-slate-800 dark:bg-slate-900/80 dark:text-slate-200 border border-red-200 dark:border-red-900">
            <span className="font-semibold text-red-800 dark:text-red-300">
              Justificativa registrada:{' '}
            </span>
            <span className="italic">
              {formData.deletedReason || '(Sem justificativa fornecida)'}
            </span>
          </div>
        </div>
      )}

      {formData.archived && !isDeleted && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                RDO Arquivado
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Este relatório está em modo de leitura nos arquivos. Você pode desarquivá-lo a
                qualquer momento.
              </p>
            </div>
          </div>
          {onToggleArchive && (
            <Button
              size="sm"
              onClick={onToggleArchive}
              disabled={actionLoading}
              className="bg-amber-700 hover:bg-amber-800 text-white text-xs"
            >
              {actionLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
              )}
              Desarquivar
            </Button>
          )}
        </div>
      )}

      {formData.reviewNotes && formData.status === 'returned' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                Motivo da Devolução (Ajustes Solicitados)
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                {formData.reviewNotes}
              </p>
              {formData.returned_fields && formData.returned_fields.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                    Campos apontados:
                  </span>
                  {formData.returned_fields.map((f) => {
                    const opt = RDO_RETURN_OPTIONS.find((o) => o.id === f)
                    return (
                      <span
                        key={f}
                        className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
                      >
                        {opt?.label || f}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico completo de correções pós-devolução (visível para Admin e Técnico quando houver histórico) */}
      {formData.change_history && formData.change_history.length > 0 && (
        <CorrectionHistorySection
          cycles={formData.change_history}
          currentStatus={formData.status}
          documentType="rdo"
        />
      )}
      {/* 1. CABEÇALHO DO RELATÓRIO */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={FileText}
          title="1. Cabeçalho do Relatório"
          subtitle="Data do relatório, condições climáticas, equipe responsável e numeração sequencial"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Data do Relatório</label>
              {isReturnedField('reportDate') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              type="date"
              value={formData.reportDate ?? ''}
              onChange={(e) => {
                handleFieldChange('reportDate', e.target.value)
                clearReturnedField('reportDate')
              }}
              disabled={isLocked || isFieldLockedByAdmin('reportDate')}
              readOnly={isFieldLockedByAdmin('reportDate')}
              className={cn(
                'mt-1.5',
                isFieldLockedByAdmin('reportDate') &&
                  'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-not-allowed select-none',
                isReturnedField('reportDate') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Condição Climática</label>
              {isReturnedField('weather') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            {isFieldLockedByAdmin('weather') ? (
              <div className="mt-1.5 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                <span>{formData.weather || 'Sol'}</span>
              </div>
            ) : (
              <select
                value={formData.weather ?? 'Sol'}
                onChange={(e) => {
                  handleFieldChange('weather', e.target.value)
                  clearReturnedField('weather')
                }}
                disabled={isLocked}
                className={cn(
                  'epa-input mt-1.5',
                  isReturnedField('weather') &&
                    'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
                )}
              >
                <option value="Sol">Sol</option>
                <option value="Nublado">Nublado</option>
                <option value="Chuva">Chuva</option>
                <option value="Instável">Instável</option>
              </select>
            )}
          </div>
          <div>
            <label className="epa-label">Número do RDO (Sequencial do Servidor)</label>
            <Input
              readOnly
              disabled
              value={
                typeof formData.number === 'number' && formData.number > 0
                  ? `RDO Nº ${formData.number}`
                  : 'RDO Offline'
              }
              className="mt-1.5 font-mono min-h-[42px] bg-slate-100 cursor-not-allowed text-slate-700 font-semibold dark:bg-slate-800 dark:text-slate-300"
            />
          </div>
          <div className="sm:col-span-1 lg:col-span-1.5">
            <label className="epa-label">Realizado por (Técnico Executor)</label>
            {(() => {
              const isPerformedLocked =
                isFieldLockedByAdmin('performedByName') ||
                isFieldLockedByAdmin('performedBy') ||
                (!isAdmin && Boolean((adminSnapshot?.performed_by_name || '').trim()))
              const performedDisplay =
                formData.performedByName || adminSnapshot?.performed_by_name || ''
              if (isPerformedLocked) {
                return (
                  <div className="mt-1.5 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                    <span>{performedDisplay}</span>
                  </div>
                )
              }
              return (
                <Input
                  placeholder="Nome do técnico executor"
                  value={formData.performedByName ?? ''}
                  onChange={(e) => handleFieldChange('performedByName', e.target.value)}
                  disabled={isLocked}
                  className="mt-1.5"
                />
              )
            })()}
          </div>
          <div className="sm:col-span-1 lg:col-span-1.5">
            <label className="epa-label">Supervisionado por (Responsável Técnico)</label>
            {(() => {
              const isSupervisorLocked =
                isFieldLockedByAdmin('supervisedByName') ||
                isFieldLockedByAdmin('supervisedBy') ||
                (!isAdmin && Boolean((adminSnapshot?.supervised_by_name || '').trim()))
              const supervisorDisplay =
                formData.supervisedByName || adminSnapshot?.supervised_by_name || ''
              if (isSupervisorLocked) {
                return (
                  <div className="mt-1.5 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                    <span>{supervisorDisplay}</span>
                  </div>
                )
              }
              return (
                <Input
                  placeholder="Nome do responsável técnico ou supervisor"
                  value={formData.supervisedByName ?? ''}
                  onChange={(e) => handleFieldChange('supervisedByName', e.target.value)}
                  disabled={isLocked}
                  className="mt-1.5"
                />
              )
            })()}
          </div>
        </div>
      </section>

      {/* 2. ATIVIDADE E DESCRIÇÃO DOS SERVIÇOS (CONFORME MODELO OFICIAL EPA) */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={Wrench}
          title="2. Atividade e Descrição dos Serviços"
          subtitle="Formatação idêntica ao modelo oficial EPA (faixas ATIVIDADE e DESCRIÇÃO DA ATIVIDADE com foto do campo/local centralizada)"
        />

        <div className="mt-6 space-y-6">
          {/* FAIXA: ATIVIDADE */}
          <div
            className={cn(
              'overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm transition',
              isReturnedField('activityTitle') &&
                'border-amber-400 ring-2 ring-amber-300 dark:ring-amber-700',
            )}
          >
            <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-2 text-center border-b border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                ATIVIDADE
              </h3>
              {isReturnedField('activityTitle') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <div className="p-4 bg-white dark:bg-slate-900">
              <Input
                placeholder="Ex.: Tamponamento de poços de monitoramento ou Operação de Extração"
                value={formData.activityTitle ?? ''}
                onChange={(e) => {
                  handleFieldChange('activityTitle', e.target.value)
                  clearReturnedField('activityTitle')
                }}
                disabled={isLocked}
                className={cn(
                  'font-medium text-sm border-slate-300 dark:border-slate-700',
                  isReturnedField('activityTitle') &&
                    'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30',
                )}
              />
            </div>
          </div>

          {/* FAIXA: DESCRIÇÃO DA ATIVIDADE */}
          <div
            className={cn(
              'overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm transition',
              isReturnedField('activityDescription') &&
                'border-amber-400 ring-2 ring-amber-300 dark:ring-amber-700',
            )}
          >
            <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-2 text-center border-b border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2">
              <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                DESCRIÇÃO DA ATIVIDADE
              </h3>
              {isReturnedField('activityDescription') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 space-y-6">
              <div>
                <Textarea
                  placeholder="Descreva minuciosamente os serviços executados, procedimentos e informações de campo..."
                  value={formData.activityDescription ?? ''}
                  onChange={(e) => {
                    handleFieldChange('activityDescription', e.target.value)
                    clearReturnedField('activityDescription')
                  }}
                  disabled={isLocked}
                  className={cn(
                    'epa-textarea min-h-[120px] text-xs sm:text-sm',
                    isReturnedField('activityDescription') &&
                      'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30',
                  )}
                />
              </div>

              {/* FOTO DO CAMPO / LOCAL DA INSPEÇÃO (CENTRALIZADA COM LEGENDA ACIMA) */}
              <div
                className={cn(
                  'rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40 transition',
                  isReturnedField('fieldPhoto') &&
                    'border-amber-400 ring-2 ring-amber-300 dark:ring-amber-700 bg-amber-50/30 dark:bg-amber-950/20',
                )}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                        Foto do Campo / Local da Inspeção (Modelo Oficial)
                      </span>
                      {isReturnedField('fieldPhoto') && (
                        <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                          🟨 CORREÇÃO SOLICITADA
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Exibida sob a descrição da atividade com legenda centralizada no topo da
                      imagem.
                    </p>
                  </div>

                  {!isLocked && (
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Input Galeria (sem capture) */}
                      <input
                        type="file"
                        ref={galleryFieldPhotoInputRef}
                        onChange={handleSelectFieldPhoto}
                        accept="image/*"
                        className="hidden"
                      />
                      {/* Input Câmera (com capture="environment") */}
                      <input
                        type="file"
                        ref={cameraFieldPhotoInputRef}
                        onChange={handleSelectFieldPhoto}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => galleryFieldPhotoInputRef.current?.click()}
                        className="flex-1 sm:flex-initial text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 active:scale-[0.98] transition shadow-sm dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 min-h-[44px] px-3 font-semibold"
                      >
                        <Upload className="mr-1.5 h-4 w-4 shrink-0" />
                        Galeria
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => cameraFieldPhotoInputRef.current?.click()}
                        className="flex-1 sm:flex-initial text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 active:scale-[0.98] transition shadow-sm dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 min-h-[44px] px-3 font-semibold"
                      >
                        <Camera className="mr-1.5 h-4 w-4 shrink-0" />
                        Tirar foto
                      </Button>
                    </div>
                  )}
                </div>

                {formData.fieldPhoto ? (
                  <div className="mt-4 flex flex-col items-center">
                    {/* Legenda centralizada no topo exatamente como no modelo: Figura 01 – Mapa de localização da área de interesse. */}
                    <div className="w-full max-w-2xl mb-3 text-center">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        Legenda da Imagem (Centralizada no topo da foto)
                      </label>
                      <Input
                        value={formData.fieldPhoto.caption ?? ''}
                        onChange={(e) => handleFieldPhotoCaptionChange(e.target.value)}
                        disabled={isLocked}
                        placeholder="Ex.: Figura 01 – Mapa de localização da área de interesse."
                        className="text-center font-bold text-xs sm:text-sm h-9 border-slate-300 dark:border-slate-700"
                      />
                    </div>

                    {/* Imagem do Campo */}
                    <div className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                      {(() => {
                        const fieldPhotoSrc =
                          formData.fieldPhoto.dataUrl ||
                          (formData.fieldPhoto.image?.startsWith('http')
                            ? formData.fieldPhoto.image
                            : formData.fieldPhoto.image
                              ? `${pb.baseUrl}/api/files/report_photos/${formData.fieldPhoto.id}/${formData.fieldPhoto.image}`
                              : 'https://img.usecurling.com/p/640/420?q=field%20site')
                        return (
                          <img
                            src={fieldPhotoSrc}
                            alt={formData.fieldPhoto.caption || 'Foto do campo / local da inspeção'}
                            className="w-full h-auto max-h-[500px] object-contain mx-auto block"
                          />
                        )
                      })()}
                      {!isLocked && (
                        <div className="absolute right-2 top-2 flex flex-wrap items-center gap-1.5 bg-slate-950/80 backdrop-blur p-1 rounded-md shadow">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => galleryFieldPhotoInputRef.current?.click()}
                            className="h-7 px-2 text-[11px] text-white hover:bg-white/20"
                            title="Selecionar outra foto da galeria"
                          >
                            <Upload className="mr-1 h-3 w-3" />
                            Galeria
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => cameraFieldPhotoInputRef.current?.click()}
                            className="h-7 px-2 text-[11px] text-white hover:bg-white/20"
                            title="Tirar nova foto com a câmera"
                          >
                            <Camera className="mr-1 h-3 w-3" />
                            Câmera
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRemoveFieldPhoto}
                            className="h-7 px-2 text-[11px] text-red-300 hover:bg-red-500/30 hover:text-red-100"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Excluir
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/70 p-6 text-center transition dark:border-slate-700 dark:bg-slate-900/50">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Camera className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nenhuma foto do local/campo inserida
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                      Adicione a fotografia da área de interesse selecionando da galeria ou tirando
                      uma foto na câmera. Conforme o modelo oficial, ela será exibida centralizada
                      sob a descrição.
                    </p>
                    {!isLocked && (
                      <div className="mt-4 flex flex-wrap justify-center gap-2 w-full max-w-sm">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => galleryFieldPhotoInputRef.current?.click()}
                          className="flex-1 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] font-semibold"
                        >
                          <Upload className="mr-1.5 h-4 w-4" />
                          Selecionar da galeria
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => cameraFieldPhotoInputRef.current?.click()}
                          className="flex-1 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] font-semibold"
                        >
                          <Camera className="mr-1.5 h-4 w-4" />
                          Tirar foto
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TABELA DE POÇOS */}
      <section className="epa-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SectionHeader
              icon={Layers}
              title="3. Tabela de Poços"
              subtitle="Identificação, profundidade, data de conclusão e diâmetro dos poços trabalhados"
            />
            {isReturnedField('wells') && (
              <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 uppercase shadow-sm">
                🟨 CORREÇÃO SOLICITADA
              </span>
            )}
          </div>
          {!isLocked && canAddWell && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddWell}
              className="w-full sm:w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[40px]"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar Poço
            </Button>
          )}
        </div>

        {/* Mensagem de orientação / banner para o Técnico */}
        {isTechnician && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div className="leading-relaxed">
              Poços definidos pelo Administrador. Se o poço necessário não constar na lista,
              solicite o cadastro prévio ao Administrador.
            </div>
          </div>
        )}

        {/* Dica para mobile */}
        <p className="mt-2 text-[11px] text-slate-400 sm:hidden flex items-center gap-1">
          <span>👉 Deslize para visualizar e editar os dados dos poços</span>
        </p>

        {formData.wells && formData.wells.length > 0 ? (
          <div className="mt-3 table-scroll-container rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="p-3 w-48">ID do Poço</th>
                  <th className="p-3">Profundidade (m)</th>
                  <th className="p-3">Data Conclusão</th>
                  <th className="p-3">Diâmetro</th>
                  {!isLocked && (isAdmin || isTechnician) && (
                    <th className="p-3 w-12 text-center">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {formData.wells.map((well, index) => {
                  const snapWell = snapshotWells?.[index]
                  const persistedWell = initialReport?.wells?.[index]
                  const lockedWell = snapWell || persistedWell

                  const effectiveWellId = (snapWell?.well_id || persistedWell?.well_id || '').trim()
                  const hasLockedWellId = isTechnician && Boolean(effectiveWellId)

                  const effectiveDepth =
                    snapWell?.depth !== undefined &&
                    snapWell?.depth !== null &&
                    String(snapWell.depth).trim() !== ''
                      ? snapWell.depth
                      : persistedWell?.depth !== undefined &&
                          persistedWell?.depth !== null &&
                          String(persistedWell.depth).trim() !== ''
                        ? persistedWell.depth
                        : undefined
                  const hasLockedDepth = isTechnician && effectiveDepth !== undefined

                  const effectiveDate = (
                    snapWell?.completion_date ||
                    persistedWell?.completion_date ||
                    ''
                  ).trim()
                  const hasLockedCompletionDate = isTechnician && Boolean(effectiveDate)

                  const effectiveDiameter = (
                    snapWell?.diameter ||
                    persistedWell?.diameter ||
                    ''
                  ).trim()
                  const hasLockedDiameter = isTechnician && Boolean(effectiveDiameter)

                  return (
                    <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="p-2">
                        {hasLockedWellId ? (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                            <span>{effectiveWellId}</span>
                          </div>
                        ) : (
                          <Input
                            value={well.well_id ?? ''}
                            onChange={(e) =>
                              handleWellFieldChange(index, 'well_id', e.target.value)
                            }
                            disabled={isLocked}
                            placeholder="PM-01"
                            className="h-10 text-xs sm:text-sm font-semibold uppercase font-mono"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {hasLockedDepth ? (
                          <div className="flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                            <span>{`${effectiveDepth} m`}</span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.1"
                            value={well.depth ?? ''}
                            onChange={(e) => handleWellFieldChange(index, 'depth', e.target.value)}
                            disabled={isLocked}
                            placeholder="8.5"
                            className="h-10 text-xs sm:text-sm font-mono"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {hasLockedCompletionDate ? (
                          <div className="flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                            <span>
                              {(() => {
                                const parts = String(effectiveDate).slice(0, 10).split('-')
                                return parts.length === 3
                                  ? `${parts[2]}/${parts[1]}/${parts[0]}`
                                  : effectiveDate
                              })()}
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="date"
                            value={well.completion_date ?? ''}
                            onChange={(e) =>
                              handleWellFieldChange(index, 'completion_date', e.target.value)
                            }
                            disabled={isLocked}
                            className="h-10 text-xs sm:text-sm"
                          />
                        )}
                      </td>
                      <td className="p-2">
                        {hasLockedDiameter ? (
                          <div className="flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                            <span>{effectiveDiameter}</span>
                          </div>
                        ) : (
                          <Input
                            value={well.diameter ?? ''}
                            onChange={(e) =>
                              handleWellFieldChange(index, 'diameter', e.target.value)
                            }
                            disabled={isLocked}
                            placeholder='2"'
                            className="h-10 text-xs sm:text-sm font-mono"
                          />
                        )}
                      </td>
                      {!isLocked && (isAdmin || isWellRowEmpty(lockedWell || well)) && (
                        <td className="p-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveWell(index)}
                            className="h-9 w-9 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50"
                            title={isAdmin ? 'Remover poço (Admin)' : 'Remover poço vazio'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400">
            {isTechnician
              ? 'Nenhum poço vinculado a este RDO. Como não há poços cadastrados, a tabela de poços não será incluída no PDF final.'
              : 'Nenhum poço vinculado a este RDO. Não haverá tabela de poços no PDF final a menos que poços sejam adicionados.'}
          </div>
        )}

        {/* Aviso abaixo da tabela para o Técnico */}
        {isTechnician && (
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 italic">
            * Poços definidos pelo Administrador. Se o poço necessário não constar na lista,
            solicite o cadastro prévio ao Administrador.
          </p>
        )}
      </section>

      {/* 4. REGISTRO FOTOGRÁFICO */}
      <section
        className={cn(
          'epa-card p-6 transition',
          isReturnedField('photos') && 'border-amber-400 ring-2 ring-amber-300 dark:ring-amber-700',
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SectionHeader
              icon={Camera}
              title="4. Registro Fotográfico"
              subtitle="Fotos de campo com legendas (aparecem fielmente distribuídas no PDF do RDO)"
            />
            {isReturnedField('photos') && (
              <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 uppercase shadow-sm">
                🟨 CORREÇÃO SOLICITADA
              </span>
            )}
          </div>
          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                ref={galleryPhotosInputRef}
                onChange={handleAddPhotoFiles}
                multiple
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={cameraPhotosInputRef}
                onChange={handleAddPhotoFiles}
                accept="image/*"
                capture="environment"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => galleryPhotosInputRef.current?.click()}
                className="flex-1 sm:flex-initial text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] px-3 font-semibold shadow-sm"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Galeria
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraPhotosInputRef.current?.click()}
                className="flex-1 sm:flex-initial text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] px-3 font-semibold shadow-sm"
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Tirar foto
              </Button>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {formData.photos?.map((photo, index) => {
            const imgSrc =
              photo.dataUrl ||
              (photo.image?.startsWith('http')
                ? photo.image
                : photo.image
                  ? `${pb.baseUrl}/api/files/report_photos/${photo.id}/${photo.image}`
                  : 'https://img.usecurling.com/p/640/420?q=monitoring%20well')

            return (
              <div
                key={photo.id || index}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={imgSrc}
                    alt={photo.caption}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-slate-900/70 text-white hover:bg-red-600 transition"
                      title="Excluir foto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <span className="absolute left-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    Foto {index + 1}
                  </span>
                </div>
                <div className="p-3">
                  <label className="text-[9px] uppercase font-semibold text-slate-400">
                    Legenda da Foto
                  </label>
                  <Input
                    value={photo.caption ?? ''}
                    onChange={(e) => handlePhotoCaptionChange(index, e.target.value)}
                    disabled={isLocked}
                    placeholder="Legenda descritiva da imagem..."
                    className="mt-1 h-10 text-xs sm:text-sm"
                  />
                </div>
              </div>
            )
          })}

          {!isLocked && (
            <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/40">
              <Camera className="h-8 w-8 mb-2 text-slate-400" />
              <span className="text-xs font-semibold">Adicionar nova fotografia</span>
              <span className="text-[10px] text-slate-400 mt-1 mb-3">
                Formatos JPG, PNG (Galeria do dispositivo ou Câmera)
              </span>
              <div className="flex flex-wrap justify-center gap-2 w-full max-w-sm">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => galleryPhotosInputRef.current?.click()}
                  className="flex-1 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] font-semibold"
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Galeria
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => cameraPhotosInputRef.current?.click()}
                  className="flex-1 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[44px] font-semibold"
                >
                  <Camera className="mr-1.5 h-4 w-4" />
                  Tirar foto
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 5. OBSERVAÇÕES TÉCNICAS: ACIDENTES, INTERFERÊNCIAS, MUDANÇAS, TEMPOS */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={AlertCircle}
          title="5. Observações Técnicas & Controle Operacional"
          subtitle="Acidentes/incidentes, interferências, alterações no plano e tempos de deslocamento/espera"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Acidentes / Incidentes</label>
              {isReturnedField('accidents') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.accidents ?? ''}
              onChange={(e) => {
                handleFieldChange('accidents', e.target.value)
                clearReturnedField('accidents')
              }}
              disabled={isLocked}
              className={cn(
                'mt-1.5',
                isReturnedField('accidents') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Interferências / Dificuldades</label>
              {isReturnedField('interferences') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.interferences ?? ''}
              onChange={(e) => {
                handleFieldChange('interferences', e.target.value)
                clearReturnedField('interferences')
              }}
              disabled={isLocked}
              className={cn(
                'mt-1.5',
                isReturnedField('interferences') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Mudanças no Plano de Trabalho</label>
              {isReturnedField('planChanges') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.planChanges ?? ''}
              onChange={(e) => {
                handleFieldChange('planChanges', e.target.value)
                clearReturnedField('planChanges')
              }}
              disabled={isLocked}
              className={cn(
                'mt-1.5',
                isReturnedField('planChanges') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="epa-label">Tempo de Espera</label>
              {isReturnedField('timeWaiting') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              placeholder="Ex.: Sem ocorrências ou 00h30"
              value={formData.timeWaiting ?? ''}
              onChange={(e) => {
                handleFieldChange('timeWaiting', e.target.value)
                clearReturnedField('timeWaiting')
              }}
              disabled={isLocked}
              className={cn(
                'mt-1.5',
                isReturnedField('timeWaiting') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="epa-label">Tempo de Deslocamento</label>
              {isReturnedField('timeDisplacement') && (
                <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase">
                  🟨 CORREÇÃO SOLICITADA
                </span>
              )}
            </div>
            <Input
              placeholder="Ex.: 00h00 ou 01h20"
              value={formData.timeDisplacement ?? ''}
              onChange={(e) => {
                handleFieldChange('timeDisplacement', e.target.value)
                clearReturnedField('timeDisplacement')
              }}
              disabled={isLocked}
              className={cn(
                'mt-1.5',
                isReturnedField('timeDisplacement') &&
                  'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30 ring-1 ring-amber-400',
              )}
            />
          </div>
        </div>
      </section>

      {/* 6. BOTÕES FINAIS DE AÇÃO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 epa-card p-6">
        <div>
          <p className="text-sm font-semibold">Finalização do Relatório</p>
          <p className="text-xs text-slate-500">
            {isLocked
              ? formData.status === 'submitted'
                ? 'Este RDO foi enviado para aprovação e está bloqueado para edição. Aguarde a liberação do Administrador.'
                : 'Este RDO já foi aprovado e está bloqueado para modificações.'
              : 'Verifique todos os dados antes de salvar ou enviar para aprovação.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="min-h-[44px] flex-1 sm:flex-none">
            Voltar
          </Button>
          {!isLocked && (
            <>
              <Button
                variant="outline"
                onClick={() => saveReport('draft')}
                disabled={isSaving}
                className="min-h-[44px] flex-1 sm:flex-none"
              >
                Salvar Rascunho
              </Button>
              <Button
                onClick={() => saveReport('submitted')}
                disabled={isSaving || !formData.activityTitle.trim()}
                className="min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white flex-1 sm:flex-none"
              >
                {isAdmin ? 'Enviar para o técnico' : 'Enviar para aprovação'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Devolução modal com seleção de campos e justificativa */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">Devolver RDO para Correção</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Selecione os campos que necessitam de ajuste e descreva as correções para o
                  técnico.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Campos com Pendência (opcional / selecione os que se aplicam):
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto p-1 border rounded-lg border-slate-200 dark:border-slate-800">
                {RDO_RETURN_OPTIONS.map((field) => {
                  const checked = reviewReturnedFields.includes(field.id)
                  return (
                    <label
                      key={field.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition',
                        checked
                          ? 'border-amber-400 bg-amber-50/70 font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setReviewReturnedFields((prev) => [...prev, field.id])
                          } else {
                            setReviewReturnedFields((prev) => prev.filter((f) => f !== field.id))
                          }
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="truncate">{field.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição detalhada das correções <span className="text-red-500">*</span>:
              </label>
              <Textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="min-h-[100px] dark:border-slate-800 dark:bg-slate-950"
                placeholder="Ex.: Favor conferir a profundidade do PZ-02 e anexar a foto da leitura final do hidrômetro."
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => handleAdminStatusChange('returned')}
                disabled={!reviewNotes.trim() || isSaving}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Confirmar Devolução
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}

/**
 * Generates offline A4 printable HTML with EPA Logo strictly repeated on EVERY single page via @page and running headers.
 */
function generateLocalPdfPrint(report: OfflineRdoItem) {
  const popup = window.open('', '_blank')
  if (!popup) return

  const logoSrc = EPA_LOGO_BASE64

  // Lista de poços: cadastrados no relatório. Se não houver nenhum poço, a tabela não deve aparecer no PDF.
  const wellsList = report.wells && report.wells.length > 0 ? report.wells : []

  // Divide poços em páginas de tabela (~25 por folha)
  const wellsPage1 = wellsList.slice(0, 25)
  const wellsPage2 = wellsList.slice(25)

  const renderWellsTable = (list: typeof wellsList) => `
    <table class="wells-table">
      <thead>
        <tr>
          <th style="width:25%;">Identificação<br />do Poço</th>
          <th style="width:25%;">Profundidade</th>
          <th style="width:25%;">Data de<br />finalização</th>
          <th style="width:25%;">Diâmetro do<br />Poço (pol.)</th>
        </tr>
      </thead>
      <tbody>
        ${list
          .map(
            (w) => `
          <tr>
            <td style="text-align:center;font-weight:bold;">${w.well_id || ''}</td>
            <td style="text-align:center;">${w.depth || ''}</td>
            <td style="text-align:center;">${w.completion_date || ''}</td>
            <td style="text-align:center;">${w.diameter || ''}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `

  // Field/Inspection Photo HTML for Section 2 (exact official EPA PDF model: centered caption on top, centered full-width image below)
  let fieldPhotoHtml = ''
  if (report.fieldPhoto && (report.fieldPhoto.dataUrl || report.fieldPhoto.image)) {
    const fieldSrc =
      report.fieldPhoto.dataUrl ||
      (report.fieldPhoto.image?.startsWith('http')
        ? report.fieldPhoto.image
        : report.fieldPhoto.image
          ? `${pb.baseUrl}/api/files/report_photos/${report.fieldPhoto.id}/${report.fieldPhoto.image}`
          : 'https://img.usecurling.com/p/640/420?q=field%20site')
    const fieldCaption =
      report.fieldPhoto.caption || 'Figura 01 – Mapa de localização da área de interesse.'

    fieldPhotoHtml = `
    <div style="margin-top:14px;text-align:center;break-inside:avoid;page-break-inside:avoid;">
      <p style="margin:0 0 8px 0;text-align:center;font-size:11px;font-weight:bold;color:#000;">${fieldCaption}</p>
      <div style="display:inline-block;width:100%;max-width:680px;text-align:center;">
        <img src="${fieldSrc}" style="width:100%;max-height:480px;object-fit:contain;border:1px solid #000;display:block;margin:0 auto;" alt="${fieldCaption}" />
      </div>
    </div>`
  }

  const rdoNumStr = `RDO ${String(report.number).padStart(2, '0')} – ${report.location || 'Açailândia - MA'}`
  const activityValue = report.activityTitle?.trim() || 'Tamponamento de poços – Açailândia - MA'

  // Cabeçalho Oficial Repetido no topo de cada página (Logo + Título + Metadados)
  const renderPageHeader = () => `
    <div class="rdo-page-header">
      <div class="logo-title-box">
        <div class="logo-cell">
          <img src="${logoSrc}" class="epa-logo-img" alt="Grupo EPA" />
        </div>
        <div class="title-cell">
          Relatório Diário de Acompanhamento de Obras
        </div>
      </div>
      <table class="header-meta-table">
        <tr>
          <td style="width:50%;"><b>Cliente:</b> ${report.clientName || 'VALE S.A.'}</td>
          <td style="width:50%;"><b>Local:</b> ${report.location || 'Açailândia -MA.'}</td>
        </tr>
        <tr>
          <td><b>Contrato:</b> ${report.contractCode || '5900117667'}</td>
          <td><b>Projeto EPA:</b> ${report.projectName || '24-0234'}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Empresa:</b> ${report.companyName || 'EPA Engenharia de Proteção Ambiental'}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Realizado por:</b> ${report.performedByName || 'Rodrigo Bezerra e Evandlier Sampaio'}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Supervisionado por:</b> ${report.supervisedByName || 'Karoline Ferreira.'}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Data:</b> ${report.reportDate || ''}</td>
        </tr>
        <tr>
          <td colspan="2"><b>Clima:</b> ${report.weather || 'Ensolarado'}</td>
        </tr>
      </table>
    </div>
  `

  const renderPageFooter = () => `
    <div class="rdo-page-footer">
      <div class="footer-line"></div>
      <div class="footer-text">${rdoNumStr}</div>
    </div>
  `

  let wellsPagesHtml = ''
  if (wellsList.length > 0) {
    wellsPagesHtml = `
    <!-- PÁGINA: TABELA DE POÇOS PARTE 1 -->
    <div class="rdo-page">
      ${renderPageHeader()}
      <div class="rdo-page-content">
        ${renderWellsTable(wellsPage1)}
      </div>
      ${renderPageFooter()}
    </div>
    ${
      wellsPage2.length > 0
        ? `
    <!-- PÁGINA: TABELA DE POÇOS PARTE 2 -->
    <div class="rdo-page">
      ${renderPageHeader()}
      <div class="rdo-page-content">
        ${renderWellsTable(wellsPage2)}
      </div>
      ${renderPageFooter()}
    </div>
    `
        : ''
    }`
  }

  // Seção de Fotos em Pares (páginas individuais de fotos com cabeçalho)
  const photoPagesHtml: string[] = []
  if (report.photos && report.photos.length > 0) {
    for (let i = 0; i < report.photos.length; i += 2) {
      const p1 = report.photos[i]
      const p2 = report.photos[i + 1]
      const src1 =
        p1.dataUrl ||
        (p1.image?.startsWith('http')
          ? p1.image
          : p1.image
            ? `${pb.baseUrl}/api/files/report_photos/${p1.id}/${p1.image}`
            : 'https://img.usecurling.com/p/640/420?q=monitoring%20well')
      const src2 = p2
        ? p2.dataUrl ||
          (p2.image?.startsWith('http')
            ? p2.image
            : p2.image
              ? `${pb.baseUrl}/api/files/report_photos/${p2.id}/${p2.image}`
              : 'https://img.usecurling.com/p/640/420?q=monitoring%20well')
        : ''

      const label = `Fotos ${String(i + 1).padStart(2, '0')}${p2 ? ` e ${String(i + 2).padStart(2, '0')}` : ''} – ${p1.caption || 'Tamponamento do poço.'}`
      const isFirstPhotoPage = i === 0
      photoPagesHtml.push(`
        <div class="rdo-page">
          ${renderPageHeader()}
          <div class="rdo-page-content">
            ${isFirstPhotoPage ? `<div style="font-size:11px;font-weight:normal;margin-bottom:8px;text-align:center;">As fotos 01 a ${String(report.photos.length).padStart(2, '0')} evidenciam os trabalhos executados.</div>` : ''}
            <div class="photo-pair-block">
              <table style="width:100%;border-collapse:collapse;border:none;">
                <tr>
                  <td style="width:50%;padding:4px;text-align:center;border:none;vertical-align:top;">
                    <img src="${src1}" style="width:100%;max-height:360px;object-fit:cover;border:1px solid #000;display:block;" alt="Foto ${i + 1}" />
                  </td>
                  <td style="width:50%;padding:4px;text-align:center;border:none;vertical-align:top;">
                    ${src2 ? `<img src="${src2}" style="width:100%;max-height:360px;object-fit:cover;border:1px solid #000;display:block;" alt="Foto ${i + 2}" />` : ''}
                  </td>
                </tr>
              </table>
              <div class="photo-caption-box">
                ${label}
              </div>
            </div>
          </div>
          ${renderPageFooter()}
        </div>
      `)
    }
  }

  const html = `<!doctype html>
  <html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>${rdoNumStr}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000000;
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        font-size: 11px;
        line-height: 1.35;
      }

      /* Folha da página formatada em A4 com margens internas */
      .rdo-page {
        width: 210mm;
        min-height: 297mm;
        height: 297mm;
        padding: 14mm 15mm 14mm 15mm;
        margin: 0 auto;
        position: relative;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        page-break-after: always;
        break-after: page;
        box-sizing: border-box;
      }

      .rdo-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      .rdo-page-header {
        width: 100%;
        margin-bottom: 8px;
      }

      /* Logo + Título no Topo */
      .logo-title-box {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        border: 1px solid #000000;
        padding: 6px 12px;
        margin-bottom: -1px; /* une a borda com a tabela abaixo */
        background: #ffffff;
      }
      .logo-cell {
        flex: 0 0 160px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }
      .epa-logo-img {
        height: 44px;
        max-width: 155px;
        object-fit: contain;
        display: block;
      }
      .title-cell {
        flex: 1;
        text-align: center;
        font-size: 13px;
        font-weight: bold;
        color: #000000;
        padding-right: 20px;
        letter-spacing: 0.1px;
      }

      /* Tabela de Metadados / Cabeçalho */
      .header-meta-table {
        width: 100%;
        border-collapse: collapse;
        margin: 0;
      }
      .header-meta-table td {
        border: 1px solid #000000;
        padding: 4.5px 7px;
        font-size: 11px;
        color: #000000;
        vertical-align: middle;
      }
      .header-meta-table td b {
        font-weight: bold;
        color: #000000;
      }

      /* Conteúdo Principal da Página */
      .rdo-page-content {
        flex: 1;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }

      /* Faixas Oficiais EPA */
      .official-banner {
        border: 1px solid #000000;
        text-align: center;
        font-weight: bold;
        font-size: 11px;
        text-transform: uppercase;
        padding: 3.5px 6px;
        background: #ffffff;
        color: #000000;
        letter-spacing: 0.5px;
        margin-top: 10px;
      }
      .official-box {
        border: 1px solid #000000;
        border-top: none;
        padding: 6px 8px;
        min-height: 22px;
        font-size: 11px;
        color: #000000;
        background: #ffffff;
        line-height: 1.35;
      }

      /* Tabela de Poços */
      table.wells-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      table.wells-table th {
        background: #ffffff;
        color: #000000;
        border: 1px solid #000000;
        padding: 4.5px 6px;
        font-size: 10px;
        font-weight: bold;
        text-align: center;
        line-height: 1.2;
      }
      table.wells-table td {
        border: 1px solid #000000;
        padding: 3.5px 6px;
        font-size: 10px;
        color: #000000;
      }

      /* Fotos e Legendas */
      .photo-pair-block {
        width: 100%;
        margin-top: 10px;
      }
      .photo-caption-box {
        border: 1px solid #000000;
        text-align: center;
        font-size: 10px;
        padding: 5px 8px;
        margin-top: 4px;
        background: #ffffff;
        font-weight: bold;
        color: #000000;
      }

      /* Seções de Controle / Observações Técnicas */
      .control-section-item {
        margin-top: 8px;
      }
      .control-section-item:first-child {
        margin-top: 0;
      }

      /* Rodapé da Página */
      .rdo-page-footer {
        width: 100%;
        margin-top: auto;
        padding-top: 8px;
      }
      .footer-line {
        border-top: 1px solid #000000;
        width: 100%;
        margin-bottom: 5px;
      }
      .footer-text {
        font-size: 11px;
        font-weight: bold;
        color: #000000;
        text-align: left;
      }

      @media screen {
        body {
          background: #e2e8f0;
          padding: 20px 0;
        }
        .rdo-page {
          box-shadow: 0 4px 14px rgba(0,0,0,0.18);
          margin-bottom: 24px;
        }
      }
    </style>
  </head>
  <body>

    <!-- PÁGINA 1: ATIVIDADE E DESCRIÇÃO COM FIGURA -->
    <div class="rdo-page">
      ${renderPageHeader()}
      <div class="rdo-page-content">
        <div class="official-banner" style="margin-top:0;">ATIVIDADE</div>
        <div class="official-box">${activityValue}</div>

        <div class="official-banner">DESCRIÇÃO DA ATIVIDADE</div>
        <div class="official-box">
          <div style="white-space:pre-wrap;">${report.activityDescription || 'No dia de hoje, a equipe da EPA Engenharia realizou atividades de tamponamento na área.'}</div>
          ${fieldPhotoHtml}
        </div>
      </div>
      ${renderPageFooter()}
    </div>

    <!-- TABELA DE POÇOS (DINÂMICA: NÃO APARECE SE NÃO HOUVER POÇOS) -->
    ${wellsPagesHtml}

    <!-- PÁGINAS FOTOGRÁFICAS (EM PARES) -->
    ${photoPagesHtml.join('\n')}

    <!-- PÁGINA FINAL: CONTROLE OPERACIONAL / OBSERVAÇÕES -->
    <div class="rdo-page">
      ${renderPageHeader()}
      <div class="rdo-page-content">
        <div class="control-section-item">
          <div class="official-banner" style="margin-top:0;">Tempo em deslocamento de máquinas e equipamentos</div>
          <div class="official-box">${report.timeDisplacement || 'N.A'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Tempo aguardando liberação (externa)</div>
          <div class="official-box">${report.timeWaiting || 'N.A'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Interferências/Dificuldades</div>
          <div class="official-box">${report.interferences || 'Sem interferências ou dificuldades.'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Mudanças no Plano de Trabalho</div>
          <div class="official-box">${report.planChanges || 'Sem mudanças no Plano de Trabalho.'}</div>
        </div>

        <div class="control-section-item">
          <div class="official-banner">Acidentes/Incidentes</div>
          <div class="official-box">${report.accidents || 'Sem acidentes e/ou incidentes.'}</div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-top:40px;gap:40px;">
          <div style="flex:1;text-align:center;border-top:1px solid #000;padding-top:6px;font-size:10px;">
            <b>${report.performedByName || 'Rodrigo Bezerra e Evandlier Sampaio'}</b><br />
            Realizado por
          </div>
          <div style="flex:1;text-align:center;border-top:1px solid #000;padding-top:6px;font-size:10px;">
            <b>${report.supervisedByName || 'Karoline Ferreira.'}</b><br />
            Supervisionado por
          </div>
        </div>
      </div>
      ${renderPageFooter()}
    </div>

  </body>
  </html>`

  popup.document.open()
  popup.document.write(html)
  popup.document.close()
  popup.focus()
  setTimeout(() => popup.print(), 500)
}
