import { useMemo, useState, useEffect, useRef } from 'react'
import { applyDateMask, isValidBrDate, INVALID_BR_DATE_MESSAGE } from '@/lib/dateMask'
import {
  isValidDeletionJustification,
  INVALID_JUSTIFICATION_MESSAGE,
} from '@/lib/justificationValidator'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Beaker,
  CheckCircle2,
  Droplets,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Gauge,
  Leaf,
  Loader2,
  Plus,
  Printer,
  Recycle,
  Save,
  Search,
  Send,
  Settings2,
  TestTubes,
  Trash2,
  Wind,
  X,
  RotateCcw,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { logoEpa } from '@/components/EpaLogo'
import { StatusBadge } from '@/components/StatusBadge'
import { SheetSyncBadge } from '@/components/SheetSyncBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import {
  useSync,
  SYNC_BROADCAST_EVENT,
  REALTIME_RECORD_UPDATE,
  RealtimeRecordUpdateDetail,
} from '@/context/SyncContext'
import {
  offlineStorage,
  OfflineFieldSheetItem,
  OfflineProjectItem,
} from '@/services/offlineStorage'
import { authHeaders, exportUrl, updateFieldStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { useAreaConfigPreset } from '@/lib/areaConfigPreset'
import { parseAdminSnapshot, isValidPocketBaseId } from '@/lib/payloadSanitizer'
import {
  FIELD_SHEET_RETURN_GROUPS,
  parseReturnedList,
  isRecordFieldAuthorized,
} from '@/lib/returnFields'
import { directSaveSheetToServer, type DirectSaveResult } from '@/services/directSheetSave'
import { type Status } from '@/data/epa'
import {
  parseHydrometerValue,
  normalizeWellKey,
  validateHydrometerReadings,
  getLatestReadingsMap,
  HYDROMETER_ERROR_MESSAGE,
} from '@/lib/hydrometerValidator'
import {
  FIELD_SHEET_RETURN_OPTIONS,
  createFieldSheetSnapshot,
  diffFieldSheet,
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

/** SELEÇÃO MÚLTIPLA DE ÁREAS — a Planilha de Campo guarda as áreas no campo 'area'
 *  (texto) já existente e já sincronizado, com os nomes separados por vírgula.
 *  Planilhas antigas (uma área) viram uma lista de um item — nenhuma migração
 *  necessária e nenhum campo novo no payload de sincronização. */
function parseAreaList(area?: string | null): string[] {
  if (!area || typeof area !== 'string') return []
  return area
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a !== '')
}

function serializeAreaList(list: string[]): string {
  return list
    .map((a) => (a || '').trim())
    .filter((a) => a !== '')
    .join(', ')
}

/** Extrai lista ordenada de índices numéricos de compressores presentes em compressor_data (mínimo 1 e 2) */
function getCompressorIndices(compData: Record<string, any> | null | undefined): number[] {
  const set = new Set<number>([1, 2])
  if (compData && typeof compData === 'object') {
    for (const key of Object.keys(compData)) {
      const match = key.match(/\d+$/)
      if (match) {
        const num = parseInt(match[0], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          set.add(num)
        }
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** Extrai lista ordenada de índices numéricos de saídas presentes em infiltration_data (mínimo 1, 2 e 3) */
function getInfiltrationExitNumbers(infData: Record<string, any> | null | undefined): number[] {
  const set = new Set<number>([1, 2, 3])
  if (infData && typeof infData === 'object') {
    for (const key of Object.keys(infData)) {
      const match = key.match(/^out(\d+)(Morning|Afternoon)?$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (!isNaN(num) && num >= 1 && num <= 100) {
          set.add(num)
        }
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}

import { CorrectionHistorySection } from '@/components/CorrectionHistorySection'

export function FieldSpreadsheets({ query }: { query: string }) {
  const [editing, setEditing] = useState<OfflineFieldSheetItem | null>(null)
  const [items, setItems] = useState<OfflineFieldSheetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tabFilter, setTabFilter] = useState<'active' | 'archived' | 'deleted'>('active')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
  const [deleteModalSheet, setDeleteModalSheet] = useState<OfflineFieldSheetItem | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const { isSyncing: isGlobalSyncing, retrySyncItem } = useSync()

  const loadSheets = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      // RBAC check: Only Admin and Technician can access Field Spreadsheets
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
        console.warn('Erro ao consultar data da zeragem em Planilhas:', err)
      }

      // Descarte preventivo de rascunhos inválidos/travados
      await offlineStorage.purgeInvalidOrStuckDrafts()

      let localSheets = await offlineStorage.getAllFieldSheets()

      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const records = await pb.collection('field_spreadsheets').getFullList({
            sort: '-date',
            expand:
              'project,project.client,project.contract,project.company,operator,assigned_technicians,deleted_by',
          })

          const serverSheetIds = new Set(records.map((r) => r.id))

          // Purga do IndexedDB: qualquer registro pré-zeragem ou registro sincronizado que
          // não exista no servidor é removido (preservando rascunhos pendentes pós-zeragem).
          await offlineStorage.purgePreWipeOperationalData(wipeTimestamp, {
            knownServerSheetIds: serverSheetIds,
            purgeAllSynced: records.length === 0,
          })

          for (const rec of records) {
            const existingLocal = localSheets.find((l) => l.id === rec.id)
            if (!existingLocal || existingLocal.syncStatus === 'synced') {
              const proj = rec.expand?.project as any
              const client = proj?.expand?.client as any
              const contract = proj?.expand?.contract as any
              const op = rec.expand?.operator as any

              const rawExt = ((rec.extraction_data as any) || []) as any[]
              const fallbackMorning = rawExt.find((r) => r.morning_time)?.morning_time || ''
              const fallbackAfternoon = rawExt.find((r) => r.afternoon_time)?.afternoon_time || ''

              const rawSnapshot = (rec as any).admin_snapshot
              const parsedSnapshot = parseAdminSnapshot(rawSnapshot) || undefined

              const item: OfflineFieldSheetItem = {
                id: rec.id,
                number: rec.number || undefined,
                projectId: rec.project,
                projectName: proj?.name || 'Recuperação Ambiental Lote A',
                clientName: client?.name || 'Petrobras — Refinaria Sul',
                contractCode: contract?.code || 'CT-EPA-2025-017',
                date: rec.date ? rec.date.slice(0, 10) : '2025-05-28',
                area: rec.area || 'Oficina Central',
                operator: rec.operator,
                operatorName: parsedSnapshot?.technician_name || op?.name || '',
                assigned_technicians: Array.isArray((rec as any).assigned_technicians)
                  ? ((rec as any).assigned_technicians as string[])
                  : undefined,
                // Fonte prioritária de nomes: registros expandidos do servidor.
                expand_assigned_technicians: Array.isArray(
                  (rec.expand as any)?.assigned_technicians,
                )
                  ? (
                      (rec.expand as any).assigned_technicians as Array<{
                        id: string
                        name?: string
                        email?: string
                      }>
                    ).map((u) => ({ id: u.id, name: u.name || u.email || '' }))
                  : undefined,
                weather: rec.weather || 'Ensolarado',
                pluviometer:
                  rec.pluviometer === 0 || rec.pluviometer === '0' ? '' : (rec.pluviometer ?? ''),
                morning_time: rec.morning_time || '',
                afternoon_time: rec.afternoon_time || '',
                infiltration_morning_time: rec.infiltration_morning_time || '',
                infiltration_afternoon_time: rec.infiltration_afternoon_time || '',
                extraction_data: rec.extraction_data || [],
                infiltration_data: rec.infiltration_data || {},
                nutrient_done: Boolean(rec.nutrient_done),
                nutrient_map_kg:
                  rec.nutrient_map_kg === 0 || rec.nutrient_map_kg === '0'
                    ? ''
                    : (rec.nutrient_map_kg ?? ''),
                nutrient_ureia_kg:
                  rec.nutrient_ureia_kg === 0 || rec.nutrient_ureia_kg === '0'
                    ? ''
                    : (rec.nutrient_ureia_kg ?? ''),
                compressor_data: rec.compressor_data || {},
                oil_removal_data: rec.oil_removal_data || {},
                waste_liquid_qty:
                  rec.waste_liquid_qty === 0 || rec.waste_liquid_qty === '0'
                    ? ''
                    : (rec.waste_liquid_qty ?? ''),
                waste_solid_qty:
                  rec.waste_solid_qty === 0 || rec.waste_solid_qty === '0'
                    ? ''
                    : (rec.waste_solid_qty ?? ''),
                env_5s_check: Boolean(rec.env_5s_check),
                env_checklist_monthly: Boolean(rec.env_checklist_monthly),
                observations: rec.observations || '',
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
              await offlineStorage.saveFieldSheet(item)
            }
          }
          localSheets = await offlineStorage.getAllFieldSheets()
        } catch (err) {
          console.warn('Could not refresh sheets from server:', err)
        }
      } else {
        // Modo offline: purga local para garantir que nenhum dado pré-zeragem seja exibido
        await offlineStorage.purgePreWipeOperationalData(wipeTimestamp)
        localSheets = await offlineStorage.getAllFieldSheets()
      }

      // Ordenação cronológica / por número sequencial do servidor descendente
      localSheets.sort((a, b) => {
        const numA = typeof a.number === 'number' && a.number > 0 ? a.number : 0
        const numB = typeof b.number === 'number' && b.number > 0 ? b.number : 0
        if (numA !== numB) return numB - numA
        const dateA = a.serverCreatedAt
          ? new Date(a.serverCreatedAt).getTime()
          : a.date
            ? new Date(a.date).getTime()
            : a.lastModified || 0
        const dateB = b.serverCreatedAt
          ? new Date(b.serverCreatedAt).getTime()
          : b.date
            ? new Date(b.date).getTime()
            : b.lastModified || 0
        return dateB - dateA
      })
      setItems(localSheets)
    } catch (err) {
      console.error('Error loading field sheets:', err)
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadSheets()

    const handleSyncComplete = () => {
      loadSheets({ silent: true })
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeRecordUpdateDetail>
      const col = customEvent.detail?.collection
      if (col === 'field_spreadsheets' || col === 'projects' || col === 'wells') {
        loadSheets({ silent: true })
      }
    }

    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    }
  }, [])

  const filtered = items.filter((s) => {
    let matchesTab = false
    if (tabFilter === 'deleted') {
      matchesTab = Boolean(s.deleted)
    } else if (tabFilter === 'archived') {
      matchesTab = !s.deleted && Boolean(s.archived)
    } else {
      matchesTab = !s.deleted && !s.archived
    }
    const matchesStatus = tabFilter === 'deleted' ? true : filter === 'all' || s.status === filter
    const numDisplay =
      typeof s.number === 'number' && s.number > 0 ? `Planilha Nº ${s.number}` : 'Planilha Offline'
    const matchesQuery =
      `${numDisplay} ${s.projectName} ${s.area} ${s.date} ${s.deletedReason || ''}`
        .toLowerCase()
        .includes(query.toLowerCase())
    return matchesTab && matchesStatus && matchesQuery
  })

  const activeCount = items.filter((s) => !s.deleted && !s.archived).length
  const archivedCount = items.filter((s) => !s.deleted && Boolean(s.archived)).length
  const deletedCount = items.filter((s) => Boolean(s.deleted)).length

  const confirmDeleteSheet = async () => {
    if (!deleteModalSheet) return
    if (user?.role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta ação.',
        description: 'Apenas Administradores podem excluir planilhas de campo.',
        variant: 'destructive',
      })
      setDeleteModalSheet(null)
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

    const sheetToDelete = deleteModalSheet
    setIsDeleting(true)
    try {
      const nowIso = new Date().toISOString()
      const updatedItem: OfflineFieldSheetItem = {
        ...sheetToDelete,
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
          const deletePayload: Record<string, unknown> = {
            deleted: true,
            deleted_reason: trimmedReason,
            deleted_by: user?.id && !user.id.startsWith('user_') ? user.id : null,
            deleted_at: nowIso,
          }
          await pb.collection('field_spreadsheets').update(sheetToDelete.id, deletePayload)
          updatedItem.syncStatus = 'synced'
        } catch (pbErr: any) {
          console.error('Backend soft delete error:', pbErr)
          const reason =
            pbErr?.data?.message ||
            pbErr?.message ||
            'Erro de permissão ou falha de comunicação com o servidor ao excluir a planilha.'
          throw new Error(reason)
        }
      }

      // Save soft delete locally
      await offlineStorage.saveFieldSheet(updatedItem)

      setItems((prev) => prev.map((item) => (item.id === sheetToDelete.id ? updatedItem : item)))
      if (editing?.id === sheetToDelete.id) {
        setEditing(null)
      }

      toast({
        title: 'Planilha de campo excluída e arquivada com sucesso',
        description: `A planilha de ${sheetToDelete.date} (${sheetToDelete.area}) foi movida para os itens excluídos com justificativa registrada.`,
      })
      setDeleteModalSheet(null)
      setDeleteReason('')
    } catch (err: any) {
      console.error('Delete sheet error:', err)
      toast({
        title: 'Não foi possível excluir a planilha',
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

  const handleToggleArchiveSheet = async (sheet: OfflineFieldSheetItem) => {
    const nextArchived = !sheet.archived
    setActionLoadingId(sheet.id)
    try {
      const updated: OfflineFieldSheetItem = {
        ...sheet,
        archived: nextArchived,
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      await offlineStorage.saveFieldSheet(updated)

      if (navigator.onLine && pb.authStore.isValid) {
        try {
          await pb.collection('field_spreadsheets').update(sheet.id, {
            archived: nextArchived,
          })
          updated.syncStatus = 'synced'
          await offlineStorage.saveFieldSheet(updated)
        } catch (serverErr: any) {
          console.warn('Archive update failed on server, queued for sync:', serverErr)
        }
      }

      setItems((prev) => prev.map((item) => (item.id === sheet.id ? updated : item)))
      if (editing?.id === sheet.id) {
        setEditing(updated)
      }

      toast({
        title: nextArchived ? 'Planilha arquivada' : 'Planilha desarquivada',
        description: nextArchived
          ? `A planilha de ${sheet.date} foi movida para os arquivados.`
          : `A planilha de ${sheet.date} foi restaurada para a listagem ativa.`,
      })
    } catch (err: any) {
      console.error('Toggle archive sheet error:', err)
      toast({
        title: 'Erro ao alterar estado de arquivamento',
        description: err.message || 'Verifique suas permissões.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const openNew = async () => {
    let initialProjectId = '6699p05pm2uv1x2'
    let initialProjectName = 'Recuperação Ambiental Lote A'
    let initialClientName = 'Petrobras — Refinaria Sul'
    let initialContractCode = 'CT-EPA-2025-017'
    let baseSheetField: any = undefined

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
        initialClientName = activeProj.client || ''
        initialContractCode = activeProj.contract || activeProj.code || ''
        if (activeProj.base_sheet_published && activeProj.base_sheet_field) {
          const rawBaseField = activeProj.base_sheet_field
          baseSheetField = parseAdminSnapshot(rawBaseField) || rawBaseField
        }
      }
    } catch (e) {
      console.warn('Could not read cached projects for new field spreadsheet:', e)
    }

    // Inicialização da tabela de extração (poços gerenciados na própria ficha)
    let initialExtractionData: Array<{
      well: string
      morning: string
      afternoon: string
      pump: string
      autopump: string
      autopump_condition?: string
      autopump_condition_other?: string
    }> = []

    if (
      baseSheetField?.wells &&
      Array.isArray(baseSheetField.wells) &&
      baseSheetField.wells.length > 0
    ) {
      initialExtractionData = baseSheetField.wells.map((w: any) => ({
        well: w.well || '',
        morning: '',
        afternoon: '',
        pump: w.pump || '',
        autopump: w.autopump || '',
      }))
    } else if (
      baseSheetField?.extraction_data &&
      Array.isArray(baseSheetField.extraction_data) &&
      baseSheetField.extraction_data.length > 0
    ) {
      initialExtractionData = baseSheetField.extraction_data.map((w: any) => ({
        well: w.well || '',
        morning: '',
        afternoon: '',
        pump: w.pump || '',
        autopump: w.autopump || '',
      }))
    } else {
      try {
        const existingSheets = items.filter(
          (s) =>
            !s.deleted &&
            (s.projectId === initialProjectId || s.projectName === initialProjectName),
        )
        const lastSheet = existingSheets[0]
        if (lastSheet && lastSheet.extraction_data && lastSheet.extraction_data.length > 0) {
          initialExtractionData = lastSheet.extraction_data.map((row) => ({
            well: row.well,
            morning: '',
            afternoon: '',
            pump: '',
            autopump: '',
          }))
        } else {
          initialExtractionData = [
            { well: 'PR-01', morning: '', afternoon: '', pump: '', autopump: '' },
            { well: 'PR-02', morning: '', afternoon: '', pump: '', autopump: '' },
          ]
        }
      } catch (e) {
        initialExtractionData = [
          { well: 'PR-01', morning: '', afternoon: '', pump: '', autopump: '' },
          { well: 'PR-02', morning: '', afternoon: '', pump: '', autopump: '' },
        ]
      }
    }

    const nowIso = new Date().toISOString()
    const finalArea = (baseSheetField?.area || 'Oficina Central').trim()

    // Validação estrita do operator: nunca usar ID inexistente como 'cfpekk93zx4j1pr'
    let resolvedOperator = ''
    let resolvedOperatorName = ''

    try {
      let activeUsers: any[] = []
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          activeUsers = await pb.collection('users').getFullList({
            filter: 'active = true',
            sort: 'name',
          })
        } catch {
          // offline fallback
        }
      }

      const candidateOpId = (baseSheetField?.operator || '').trim()
      const candidateOpName = (
        baseSheetField?.technician_name ||
        baseSheetField?.operatorName ||
        ''
      ).trim()

      const foundUser =
        candidateOpId && candidateOpId !== 'cfpekk93zx4j1pr'
          ? activeUsers.find((u) => u.id === candidateOpId)
          : null

      if (foundUser) {
        resolvedOperator = foundUser.id
        resolvedOperatorName = foundUser.name || candidateOpName
      } else if (
        candidateOpId &&
        candidateOpId !== 'cfpekk93zx4j1pr' &&
        isValidPocketBaseId(candidateOpId)
      ) {
        // ID com formato válido PocketBase sem lista remota disponível
        resolvedOperator = candidateOpId
        resolvedOperatorName = candidateOpName || user?.name || ''
      } else if (user?.role === 'technician' && user?.id && !isProvisionalId(user.id)) {
        // Técnico criando a própria planilha: operator = identidade autenticada
        resolvedOperator = user.id
        resolvedOperatorName = (user.name || '').trim()
      }
      // Admin: NUNCA atribuir automaticamente (nem cair em outro usuário/admin) —
      // o campo fica vazio para escolha EXPLÍCITA no editor (select de técnicos reais).
    } catch {
      if (user?.role === 'technician' && user?.id && !isProvisionalId(user.id)) {
        resolvedOperator = user.id
        resolvedOperatorName = (user.name || '').trim()
      }
    }

    const finalOperator = resolvedOperator.trim()
    const finalOperatorName = (
      resolvedOperatorName || (user?.role === 'technician' ? user?.name || '' : '')
    ).trim()

    // Herança completa dos valores cadastrados pelo Administrador na ficha base
    const baseFilled =
      baseSheetField?.filled_fields && typeof baseSheetField.filled_fields === 'object'
        ? baseSheetField.filled_fields
        : {}

    const inheritedDate = baseSheetField?.date || baseFilled.date || nowIso.slice(0, 10)
    const inheritedWeather = baseSheetField?.weather || baseFilled.weather || 'Ensolarado'
    const inheritedPluviometer =
      baseSheetField?.pluviometer !== undefined &&
      baseSheetField?.pluviometer !== null &&
      baseSheetField?.pluviometer !== ''
        ? baseSheetField.pluviometer
        : baseFilled.pluviometer !== undefined &&
            baseFilled.pluviometer !== null &&
            baseFilled.pluviometer !== ''
          ? baseFilled.pluviometer
          : ('' as any)
    const inheritedMorningTime = baseSheetField?.morning_time || baseFilled.morning_time || ''
    const inheritedAfternoonTime = baseSheetField?.afternoon_time || baseFilled.afternoon_time || ''
    const inheritedInfMorningTime =
      baseSheetField?.infiltration_morning_time || baseFilled.infiltration_morning_time || ''
    const inheritedInfAfternoonTime =
      baseSheetField?.infiltration_afternoon_time || baseFilled.infiltration_afternoon_time || ''
    const inheritedInfiltrationData = {
      geralMorning: '',
      geralAfternoon: '',
      out1Morning: '',
      out1Afternoon: '',
      out2Morning: '',
      out2Afternoon: '',
      out3Morning: '',
      out3Afternoon: '',
      bombaInfiltracao: '',
      bombaGeral: '',
      ...(baseSheetField?.infiltration_data || {}),
      ...(baseFilled.infiltration_data || {}),
    }
    const inheritedNutrientDone = Boolean(
      baseSheetField?.nutrient_done ?? baseFilled.nutrient_done ?? false,
    )
    const inheritedNutrientMap =
      baseSheetField?.nutrient_map_kg !== undefined &&
      baseSheetField?.nutrient_map_kg !== null &&
      baseSheetField?.nutrient_map_kg !== ''
        ? baseSheetField.nutrient_map_kg
        : baseFilled.nutrient_map_kg !== undefined &&
            baseFilled.nutrient_map_kg !== null &&
            baseFilled.nutrient_map_kg !== ''
          ? baseFilled.nutrient_map_kg
          : ('' as any)
    const inheritedNutrientUreia =
      baseSheetField?.nutrient_ureia_kg !== undefined &&
      baseSheetField?.nutrient_ureia_kg !== null &&
      baseSheetField?.nutrient_ureia_kg !== ''
        ? baseSheetField.nutrient_ureia_kg
        : baseFilled.nutrient_ureia_kg !== undefined &&
            baseFilled.nutrient_ureia_kg !== null &&
            baseFilled.nutrient_ureia_kg !== ''
          ? baseFilled.nutrient_ureia_kg
          : ('' as any)
    const inheritedCompressorData = {
      horimetro1: '',
      horimetro2: '',
      pressao1: '',
      pressao2: '',
      drenagem1: '',
      drenagem2: '',
      tempoDesligado1: '',
      tempoDesligado2: '',
      filtroAr1: '',
      filtroAr2: '',
      nivelOleo1: '',
      nivelOleo2: '',
      trocaOleo1: '',
      trocaOleo2: '',
      linhaAr1: '',
      linhaAr2: '',
      ...(baseFilled.compressor_data || {}),
      ...(baseSheetField?.compressor_data || {}),
    }
    const inheritedOilRemovalData = {
      sao1Volume: '',
      sao1DataLimpeza: '',
      sao2Volume: '',
      sao2DataLimpeza: '',
      ...(baseFilled.oil_removal_data || {}),
      ...(baseSheetField?.oil_removal_data || {}),
    }
    const inheritedWasteLiquid =
      baseSheetField?.waste_liquid_qty !== undefined &&
      baseSheetField?.waste_liquid_qty !== null &&
      baseSheetField?.waste_liquid_qty !== ''
        ? baseSheetField.waste_liquid_qty
        : baseFilled.waste_liquid_qty !== undefined &&
            baseFilled.waste_liquid_qty !== null &&
            baseFilled.waste_liquid_qty !== ''
          ? baseFilled.waste_liquid_qty
          : ''
    const inheritedWasteSolid =
      baseSheetField?.waste_solid_qty !== undefined &&
      baseSheetField?.waste_solid_qty !== null &&
      baseSheetField?.waste_solid_qty !== ''
        ? baseSheetField.waste_solid_qty
        : baseFilled.waste_solid_qty !== undefined &&
            baseFilled.waste_solid_qty !== null &&
            baseFilled.waste_solid_qty !== ''
          ? baseFilled.waste_solid_qty
          : ''
    const inheritedEnv5s = Boolean(baseSheetField?.env_5s_check ?? baseFilled.env_5s_check ?? false)
    const inheritedEnvMonthly = Boolean(
      baseSheetField?.env_checklist_monthly ?? baseFilled.env_checklist_monthly ?? false,
    )
    const inheritedObservations = baseSheetField?.observations || baseFilled.observations || ''

    let initialSheetSnapshot: any = undefined

    if (baseSheetField) {
      // Ficha base ativa do projeto: gera o snapshot que trava os campos no Técnico
      // Monta filled_fields com os valores reais preenchidos pelo Admin na base
      const mergedFilledFields: Record<string, any> = {
        operator: finalOperator,
        operatorName: finalOperatorName,
        area: finalArea,
        ...baseFilled,
      }
      if (baseSheetField.date) mergedFilledFields.date = baseSheetField.date
      if (baseSheetField.weather) mergedFilledFields.weather = baseSheetField.weather
      if (
        baseSheetField.pluviometer !== undefined &&
        baseSheetField.pluviometer !== null &&
        String(baseSheetField.pluviometer).trim() !== ''
      ) {
        mergedFilledFields.pluviometer = baseSheetField.pluviometer
      }
      if (baseSheetField.morning_time) mergedFilledFields.morning_time = baseSheetField.morning_time
      if (baseSheetField.afternoon_time)
        mergedFilledFields.afternoon_time = baseSheetField.afternoon_time
      if (baseSheetField.infiltration_morning_time)
        mergedFilledFields.infiltration_morning_time = baseSheetField.infiltration_morning_time
      if (baseSheetField.infiltration_afternoon_time)
        mergedFilledFields.infiltration_afternoon_time = baseSheetField.infiltration_afternoon_time
      if (baseSheetField.nutrient_done)
        mergedFilledFields.nutrient_done = baseSheetField.nutrient_done
      if (
        baseSheetField.nutrient_map_kg !== undefined &&
        baseSheetField.nutrient_map_kg !== null &&
        String(baseSheetField.nutrient_map_kg).trim() !== ''
      ) {
        mergedFilledFields.nutrient_map_kg = baseSheetField.nutrient_map_kg
      }
      if (
        baseSheetField.nutrient_ureia_kg !== undefined &&
        baseSheetField.nutrient_ureia_kg !== null &&
        String(baseSheetField.nutrient_ureia_kg).trim() !== ''
      ) {
        mergedFilledFields.nutrient_ureia_kg = baseSheetField.nutrient_ureia_kg
      }
      if (
        baseSheetField.waste_liquid_qty !== undefined &&
        baseSheetField.waste_liquid_qty !== null &&
        String(baseSheetField.waste_liquid_qty).trim() !== ''
      ) {
        mergedFilledFields.waste_liquid_qty = baseSheetField.waste_liquid_qty
      }
      if (
        baseSheetField.waste_solid_qty !== undefined &&
        baseSheetField.waste_solid_qty !== null &&
        String(baseSheetField.waste_solid_qty).trim() !== ''
      ) {
        mergedFilledFields.waste_solid_qty = baseSheetField.waste_solid_qty
      }
      if (baseSheetField.env_5s_check) mergedFilledFields.env_5s_check = baseSheetField.env_5s_check
      if (baseSheetField.env_checklist_monthly)
        mergedFilledFields.env_checklist_monthly = baseSheetField.env_checklist_monthly
      if (baseSheetField.observations) mergedFilledFields.observations = baseSheetField.observations

      // Também adiciona ao initialSheetSnapshot as subchaves de compressores, SAO e infiltração preenchidas
      if (baseSheetField.compressor_data || baseFilled.compressor_data) {
        mergedFilledFields.compressor_data = inheritedCompressorData
      }
      if (baseSheetField.oil_removal_data || baseFilled.oil_removal_data) {
        mergedFilledFields.oil_removal_data = inheritedOilRemovalData
      }
      if (baseSheetField.infiltration_data || baseFilled.infiltration_data) {
        mergedFilledFields.infiltration_data = inheritedInfiltrationData
      }

      initialSheetSnapshot = {
        operator: finalOperator,
        technician_name: finalOperatorName,
        wells: (initialExtractionData || []).map((row) => ({
          well: row.well || '',
          pump: row.pump || '',
        })),
        filled_fields: mergedFilledFields,
        captured_at: nowIso,
      }
    } else if (user?.role === 'admin') {
      initialSheetSnapshot = {
        operator: user?.id || '',
        technician_name: (user?.name || '').trim(),
        wells: (initialExtractionData || []).map((row) => ({
          well: row.well || '',
          pump: row.pump || '',
        })),
        filled_fields: {
          operator: user?.id || '',
          operatorName: (user?.name || '').trim(),
          area: finalArea,
        },
        captured_at: nowIso,
      }
    }

    const newSheet: OfflineFieldSheetItem = {
      id: 'field_' + Date.now(),
      projectId: initialProjectId,
      projectName: initialProjectName,
      clientName: initialClientName,
      contractCode: initialContractCode,
      date: inheritedDate,
      area: finalArea,
      operator: finalOperator,
      operatorName: finalOperatorName,
      admin_snapshot: initialSheetSnapshot,
      weather: inheritedWeather,
      pluviometer: inheritedPluviometer,
      morning_time: inheritedMorningTime,
      afternoon_time: inheritedAfternoonTime,
      infiltration_morning_time: inheritedInfMorningTime,
      infiltration_afternoon_time: inheritedInfAfternoonTime,
      extraction_data: initialExtractionData,
      infiltration_data: inheritedInfiltrationData,
      nutrient_done: inheritedNutrientDone,
      nutrient_map_kg: inheritedNutrientMap,
      nutrient_ureia_kg: inheritedNutrientUreia,
      compressor_data: inheritedCompressorData,
      oil_removal_data: inheritedOilRemovalData,
      waste_liquid_qty: inheritedWasteLiquid,
      waste_solid_qty: inheritedWasteSolid,
      env_5s_check: inheritedEnv5s,
      env_checklist_monthly: inheritedEnvMonthly,
      observations: inheritedObservations,
      status: 'draft',
      assigned_technicians: [],
      syncStatus: 'pending_create',
      lastModified: Date.now(),
    }
    setIsNew(true)
    setEditing(newSheet)
  }

  if (editing) {
    return (
      <FieldFullEditor
        sheet={editing}
        isNew={isNew}
        onBack={() => {
          setEditing(null)
          setIsNew(false)
          loadSheets()
        }}
        onSaved={() => {
          loadSheets()
        }}
        onDelete={() => setDeleteModalSheet(editing)}
        onToggleArchive={() => handleToggleArchiveSheet(editing)}
        actionLoading={actionLoadingId === editing.id}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Abas Ativas vs Arquivadas vs Excluídos (Admin) */}
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
          <FileSpreadsheet className="h-4 w-4" />
          Planilhas Ativas ({activeCount})
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
            Arquivadas ({archivedCount})
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
            Excluídas ({deletedCount})
          </button>
        )}
      </div>

      {tabFilter === 'archived' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <b>Visualização de Planilhas Arquivadas:</b> Registros arquivados para histórico em
              modo somente leitura. Você pode desarquivá-los a qualquer momento para retorná-los à
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
              <b>Arquivo de Planilhas Excluídas (Acesso Restrito a Administrador):</b> Registros
              excluídos logicamente do sistema. Seus dados operacionais, de extração, infiltração e
              compressores permanecem preservados para auditoria junto à justificativa do
              responsável.
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total de Planilhas', `${items.length} emitidas`, Droplets, 'emerald'],
          [
            'Rascunhos',
            `${items.filter((s) => s.status === 'draft').length} em campo`,
            Beaker,
            'blue',
          ],
          [
            'Aguardando Aprovação',
            `${items.filter((s) => s.status === 'submitted').length} relatórios`,
            Recycle,
            'amber',
          ],
          [
            'Aprovadas no Mês',
            `${items.filter((s) => s.status === 'approved').length} validadas`,
            Leaf,
            'teal',
          ],
        ].map(([label, value, Icon, color]) => (
          <div key={label as string} className="epa-card flex items-center gap-4 p-5 min-h-[80px]">
            <div
              className={`grid h-11 w-11 place-items-center rounded-xl bg-${color}-50 text-${color}-700 dark:bg-slate-800`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-semibold">{value as string}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{label as string}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row dark:border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              readOnly
              placeholder="Buscar por projeto, área ou data..."
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
              Limpar filtro
            </Button>
          )}
          <Button
            onClick={openNew}
            className="w-full sm:w-fit bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Planilha de Campo
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-slate-500">Carregando planilhas...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700" />
            <p className="mt-3 text-sm font-semibold">Nenhuma planilha encontrada</p>
            <p className="mt-1 text-xs text-slate-500">
              Clique em "Nova Planilha" para iniciar o registro.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((sheet) => {
              const parseNutrientVal = (val: unknown): number | null => {
                if (val === null || val === undefined || val === '') return null
                let s = String(val).trim()
                if (s === '' || s === '0') return null
                if (s.includes(',') && s.includes('.')) {
                  if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
                    s = s.replace(/\./g, '').replace(',', '.')
                  } else {
                    s = s.replace(/,/g, '')
                  }
                } else if (s.includes(',')) {
                  s = s.replace(',', '.')
                }
                const n = parseFloat(s)
                return isNaN(n) ? null : n
              }
              const mapVal = parseNutrientVal(sheet.nutrient_map_kg)
              const ureiaVal = parseNutrientVal(sheet.nutrient_ureia_kg)
              const totalNutrientNum = (mapVal ?? 0) + (ureiaVal ?? 0)
              const totalNutrientsDisplay =
                mapVal === null && ureiaVal === null
                  ? '—'
                  : totalNutrientNum === 0
                    ? '—'
                    : `${Number(totalNutrientNum.toFixed(2))} kg`

              const wasteDisplay = (() => {
                const w = sheet.waste_liquid_qty
                if (w === undefined || w === null || w === '' || w === 0 || w === '0') return '—'
                return String(w)
              })()
              return (
                <div
                  key={sheet.id}
                  onClick={() => {
                    setEditing(sheet)
                    setIsNew(false)
                  }}
                  className="group relative cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <StatusBadge status={sheet.status} />
                      <SheetSyncBadge
                        syncStatus={sheet.syncStatus}
                        isGlobalSyncing={isGlobalSyncing}
                        syncError={sheet.syncError}
                        onRetry={() => retrySyncItem?.(sheet.id, 'field')}
                      />
                      {!sheet.deleted && (
                        <>
                          {user?.role !== 'technician' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleArchiveSheet(sheet)
                              }}
                              disabled={actionLoadingId === sheet.id}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                              title={sheet.archived ? 'Desarquivar planilha' : 'Arquivar planilha'}
                            >
                              {actionLoadingId === sheet.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : sheet.archived ? (
                                <ArchiveRestore className="h-3.5 w-3.5 text-amber-600" />
                              ) : (
                                <Archive className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                          {user?.role === 'admin' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteModalSheet(sheet)
                                setDeleteReason('')
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                              title="Excluir planilha (apenas Admin com justificativa)"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </>
                      )}
                      {sheet.deleted && (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                          Excluída
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    {typeof sheet.number === 'number' && sheet.number > 0 ? (
                      <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        Planilha Nº {sheet.number}
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Planilha Offline
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {sheet.projectName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {sheet.area} · {sheet.date}
                  </p>
                  {sheet.serverCreatedAt && (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      Criado:{' '}
                      {new Date(sheet.serverCreatedAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                  {sheet.submittedAt && sheet.status !== 'draft' && (
                    <p className="mt-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                      Enviado:{' '}
                      {new Date(sheet.submittedAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                  {sheet.approvedAt && sheet.status === 'approved' && (
                    <p className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Aprovado:{' '}
                      {new Date(sheet.approvedAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                  {sheet.returnedAt && sheet.status === 'returned' && (
                    <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      Devolvido:{' '}
                      {new Date(sheet.returnedAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  )}
                  <div className="mt-4 grid grid-cols-3 divide-x border-y py-3 text-center dark:divide-slate-800 dark:border-slate-800">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {sheet.extraction_data?.length || 0}
                      </p>
                      <p className="text-[9px] text-slate-400">Poços</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{totalNutrientsDisplay}</p>
                      <p className="text-[9px] text-slate-400">Nutrientes</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{wasteDisplay}</p>
                      <p className="text-[9px] text-slate-400">Resíduos</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Por {sheet.operatorName || 'Técnico'}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {sheet.deleted
                        ? 'Ver Arquivada →'
                        : sheet.archived
                          ? 'Visualizar arquivada →'
                          : user?.role === 'technician' &&
                              (sheet.status === 'submitted' || sheet.status === 'approved')
                            ? 'Visualizar →'
                            : 'Abrir Planilha →'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal de confirmação de exclusão da Planilha de Campo com justificativa obrigatória */}
      {deleteModalSheet && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 dark:bg-red-950/50">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Excluir{' '}
                  {typeof deleteModalSheet.number === 'number' && deleteModalSheet.number > 0
                    ? `Planilha Nº ${deleteModalSheet.number}`
                    : 'Planilha de Campo'}
                </h3>
                <p className="text-xs text-slate-500">
                  Data: {deleteModalSheet.date} — Área: {deleteModalSheet.area}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Você está prestes a excluir{' '}
              <b className="text-slate-900 dark:text-white">
                {typeof deleteModalSheet.number === 'number' && deleteModalSheet.number > 0
                  ? `Planilha Nº ${deleteModalSheet.number}`
                  : 'Planilha de Campo'}{' '}
                do dia {deleteModalSheet.date} ({deleteModalSheet.projectName})
              </b>
              .
            </p>
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              🛡️ <b>Registro e Arquivamento:</b> O item não desaparecerá do banco de dados. Ele será
              marcado como excluído logicamente e ficará arquivado na aba <b>"Excluídas"</b>{' '}
              (visível apenas para Administradores), preservando os dados operacionais para trilha
              de auditoria.
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
                  setDeleteModalSheet(null)
                  setDeleteReason('')
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={confirmDeleteSheet}
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

function FieldFullEditor({
  sheet: initialSheet,
  isNew,
  onBack,
  onSaved,
  onDelete,
  onToggleArchive,
  actionLoading,
}: {
  sheet: OfflineFieldSheetItem
  isNew: boolean
  onBack: () => void
  onSaved: () => void
  onDelete?: () => void
  onToggleArchive?: () => void
  actionLoading?: boolean
}) {
  const [formData, setFormData] = useState<OfflineFieldSheetItem>({ ...initialSheet })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(initialSheet.reviewNotes || '')
  const [reviewReturnedFields, setReviewReturnedFields] = useState<string[]>(
    initialSheet.returned_fields || ['hidrometro'],
  )
  const [projectList, setProjectList] = useState<OfflineProjectItem[]>([])
  // Técnicos reais (role='technician', active=true) vindos da coleção users
  const [technicians, setTechnicians] = useState<Array<{ id: string; name: string }>>([])
  // Campo ÚNICO "Técnico / Responsável": técnicos atribuídos (assigned_technicians).
  // Em documentos antigos que têm operator preenchido mas assigned_technicians vazio,
  // pré-popula a lista com [operator] apenas para EXIBIÇÃO no campo único (migração visual;
  // nada é gravado no banco até o Admin salvar a ficha, e operator continua intocado).
  const resolveInitialAssigned = (sheet: OfflineFieldSheetItem): string[] => {
    if (Array.isArray(sheet.assigned_technicians) && sheet.assigned_technicians.length > 0) {
      return [...sheet.assigned_technicians]
    }
    const legacyOp = (sheet.operator || '').trim()
    return legacyOp && isValidPocketBaseId(legacyOp) ? [legacyOp] : []
  }
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>(() =>
    resolveInitialAssigned(initialSheet),
  )
  const [techPickerOpen, setTechPickerOpen] = useState(false)
  const techPickerRef = useRef<HTMLDivElement | null>(null)

  // Sincroniza o estado local de técnicos quando a ficha troca (abrir outra planilha)
  useEffect(() => {
    setSelectedTechnicians(resolveInitialAssigned(initialSheet))
    setTechPickerOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSheet.id])

  // Fecha o seletor de técnicos ao clicar fora dele
  useEffect(() => {
    if (!techPickerOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (techPickerRef.current && !techPickerRef.current.contains(e.target as Node)) {
        setTechPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [techPickerOpen])

  // Altera a lista do campo único e mantém operator/operatorName coerentes
  // (primeiro da lista alimenta os relatórios PDF e o backend — compatibilidade de dados).
  const applyAssignedTechnicians = (next: string[]) => {
    setSelectedTechnicians(next)
    const firstId = next.length > 0 ? next[0] : ''
    const firstName = firstId ? technicians.find((t) => t.id === firstId)?.name || '' : ''
    setFormData((p) => ({
      ...p,
      assigned_technicians: next,
      operator: firstId,
      operatorName: firstName,
    }))
    setHasUnsavedChanges(true)
  }

  const handleToggleTechnician = (techId: string) => {
    applyAssignedTechnicians(
      selectedTechnicians.includes(techId)
        ? selectedTechnicians.filter((id) => id !== techId)
        : [...selectedTechnicians, techId],
    )
  }

  const handleRemoveTechnician = (techId: string) => {
    applyAssignedTechnicians(selectedTechnicians.filter((id) => id !== techId))
  }

  const techNameOf = (id: string) => {
    // 1) Fonte prioritária: expand assigned_technicians vindo do servidor (funciona offline,
    //    pois fica persistido no IndexedDB junto com a planilha).
    const expanded = (initialSheet as any).expand_assigned_technicians?.find(
      (t: { id: string; name: string }) => t.id === id,
    )
    if (expanded?.name) return expanded.name
    // 2) Cadastro de técnicos carregado online
    const found = technicians.find((t) => t.id === id)
    if (found?.name) return found.name
    // 3) Usuário autenticado
    if (id === user?.id && user?.name) return user.name
    // ÚLTIMO RECURSO — NUNCA exibir o UUID cru
    return 'Nome indisponível'
  }

  useEffect(() => {
    let cancelled = false
    const loadTechnicians = async () => {
      try {
        if (!navigator.onLine || !pb.authStore.isValid) return
        const recs = await pb.collection('users').getFullList({
          filter: "role = 'technician' && active = true",
          sort: 'name',
        })
        if (!cancelled) {
          setTechnicians(recs.map((r: any) => ({ id: r.id, name: r.name || r.email })))
        }
      } catch (err) {
        console.warn('Erro ao carregar técnicos (users):', err)
      }
    }
    loadTechnicians()
    return () => {
      cancelled = true
    }
  }, [])

  const { user, setHasUnsavedChanges } = useAuth()
  const { isOnline, syncNow } = useSync()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'

  // Helpers para compressores e saídas de infiltração dinâmicos
  // Estado local para permitir compressores e saídas extras mesmo antes de preencher valores
  const [extraCompCount, setExtraCompCount] = useState<number>(0)
  const [extraInfExitCount, setExtraInfExitCount] = useState<number>(0)

  const activeCompressorIndices = useMemo(() => {
    const list = getCompressorIndices(formData.compressor_data)
    const maxInMap = list.length > 0 ? Math.max(...list) : 2
    const totalMax = Math.max(2, maxInMap, extraCompCount)
    const result: number[] = []
    for (let i = 1; i <= totalMax; i++) {
      result.push(i)
    }
    return result
  }, [formData.compressor_data, extraCompCount])

  const activeInfiltrationExitNumbers = useMemo(() => {
    const list = getInfiltrationExitNumbers(formData.infiltration_data)
    const maxInMap = list.length > 0 ? Math.max(...list) : 3
    const totalMax = Math.max(3, maxInMap, extraInfExitCount)
    const result: number[] = []
    for (let i = 1; i <= totalMax; i++) {
      result.push(i)
    }
    return result
  }, [formData.infiltration_data, extraInfExitCount])

  const handleAddCompressor = () => {
    const nextIdx = Math.max(
      3,
      (activeCompressorIndices[activeCompressorIndices.length - 1] || 2) + 1,
    )
    setExtraCompCount(nextIdx)
    const currentComp = { ...(formData.compressor_data || {}) }
    currentComp[`horimetro${nextIdx}`] = currentComp[`horimetro${nextIdx}`] || ''
    handleFieldChange('compressor_data', currentComp)
    toast({
      title: 'Compressor adicionado',
      description: `COMPRESSOR ${String(nextIdx).padStart(2, '0')} adicionado às tabelas de Compressores e Linha de Ar.`,
    })
  }

  const handleAddInfiltrationExit = () => {
    const nextExit = Math.max(
      4,
      (activeInfiltrationExitNumbers[activeInfiltrationExitNumbers.length - 1] || 3) + 1,
    )
    setExtraInfExitCount(nextExit)
    const currentInf = { ...(formData.infiltration_data || {}) }
    currentInf[`out${nextExit}Morning`] = currentInf[`out${nextExit}Morning`] || ''
    handleFieldChange('infiltration_data', currentInf)
    toast({
      title: 'Saída adicionada',
      description: `Saída ${String(nextExit).padStart(2, '0')} adicionada à tabela de Infiltração.`,
    })
  }

  // Sincronização em tempo real do editor com o IndexedDB e eventos do servidor
  const currentSheetIdRef = useRef(formData.id)
  useEffect(() => {
    currentSheetIdRef.current = formData.id
  }, [formData.id])

  useEffect(() => {
    const handleSyncComplete = async () => {
      try {
        const idToCheck = currentSheetIdRef.current
        let persisted = await offlineStorage.getFieldSheet(idToCheck)
        if (!persisted && isProvisionalId(idToCheck)) {
          const allSheets = await offlineStorage.getAllFieldSheets()
          persisted = allSheets.find(
            (s) =>
              s.client_token === idToCheck ||
              s.lastModified === formData.lastModified ||
              (s.date === formData.date && s.projectId === formData.projectId),
          )
        }
        if (persisted) {
          setFormData((prev) => ({
            ...prev,
            id: persisted.id,
            number: persisted.number !== undefined ? persisted.number : prev.number,
            syncStatus: persisted.syncStatus || 'synced',
            serverCreatedAt: persisted.serverCreatedAt || prev.serverCreatedAt,
            serverUpdatedAt: persisted.serverUpdatedAt || prev.serverUpdatedAt,
            submittedAt: persisted.submittedAt || prev.submittedAt,
            approvedAt: persisted.approvedAt || prev.approvedAt,
            returnedAt: persisted.returnedAt || prev.returnedAt,
            status: persisted.status || prev.status,
          }))
        }
      } catch (err) {
        console.warn('Erro ao atualizar FieldFullEditor pós-sync:', err)
      }
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeRecordUpdateDetail>
      const detail = customEvent.detail
      if (!detail) return
      if (detail.collection === 'field_spreadsheets') {
        const rec = detail.record as any
        const currentId = currentSheetIdRef.current
        if (rec && (detail.id === currentId || (rec.number && rec.number === formData.number))) {
          setFormData((prev) => ({
            ...prev,
            id: rec.id || prev.id,
            number: rec.number !== undefined ? rec.number : prev.number,
            syncStatus: 'synced',
            status: rec.status || prev.status,
            serverCreatedAt: rec.created || prev.serverCreatedAt,
            serverUpdatedAt: rec.updated || prev.serverUpdatedAt,
          }))
        } else {
          handleSyncComplete()
        }
      }
    }

    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    }
  }, [formData.date, formData.projectId, formData.lastModified, formData.number])

  const isTechnician = user?.role === 'technician'
  const isDeleted = Boolean(formData.deleted)
  // O Técnico fica estritamente bloqueado (somente leitura) quando o status for 'submitted' ou 'approved'.
  // Apenas Administradores podem editar nesses estados, ou o Técnico quando o Admin devolver ('returned' / 'draft').
  const isLocked =
    (!isAdmin && (formData.status === 'approved' || formData.status === 'submitted')) || isDeleted

  // DEVOLUÇÃO POR CAMPO: quando o Admin devolve a planilha ('returned'), o Técnico
  // só pode editar os campos das seções listadas em returned_fields (o servidor também
  // valida: guard em pocketbase/hooks/returned_fields_guard.js).
  // O campo returned_fields é JSON no PocketBase e PODE chegar como STRING JSON — o
  // parsing sempre passa por parseReturnedList (aceita array e string JSON).
  // REGRA DE SEGURANÇA: lista vazia/inválida/ausente NÃO libera — bloqueia por padrão.
  const rawReturnedUi =
    (formData as any).returned_fields ?? (formData as any).returnedFields ?? null
  const returnedFieldsList: string[] = useMemo(() => {
    const parsed = parseReturnedList(rawReturnedUi)
    // Aceita apenas grupos válidos e/ou nomes de campo reais do registro
    const knownGroups = Object.keys(FIELD_SHEET_RETURN_GROUPS)
    const allGroupFields = Object.values(FIELD_SHEET_RETURN_GROUPS).flat()
    const valid = parsed.filter(
      (entry) => knownGroups.includes(entry) || allGroupFields.includes(entry),
    )
    return valid
  }, [rawReturnedUi])
  const isReturnedCycle = !isAdmin && formData.status === 'returned'
  // Em ciclo de correção SEM lista válida: TUDO bloqueado (falha segura).
  const returnedListIsValid = returnedFieldsList.length > 0
  const isFieldEditableForTechnician = (field: string) =>
    !isReturnedCycle ||
    (returnedListIsValid && isRecordFieldAuthorized('field_sheet', field, returnedFieldsList))
  const allowsExtractionEdits =
    !isReturnedCycle ||
    (returnedListIsValid &&
      (isRecordFieldAuthorized('field_sheet', 'extraction_data', returnedFieldsList) ||
        isRecordFieldAuthorized('field_sheet', 'morning_time', returnedFieldsList) ||
        isRecordFieldAuthorized('field_sheet', 'afternoon_time', returnedFieldsList)))
  const isExtractionCellEditable = (col: string) =>
    !isReturnedCycle || (allowsExtractionEdits && isFieldEditableForTechnician(col))
  // Bloqueio visual por campo na devolução: true somente quando o ciclo de correção está ativo
  // e o campo NÃO está autorizado (lista vazia/inválida bloqueia tudo).
  const isReturnBlocked = (field: string) => !isFieldEditableForTechnician(field)

  // SELEÇÃO MÚLTIPLA DE ÁREAS: o Admin cadastra/disponibiliza as áreas (coleção 'areas');
  // o Técnico apenas SELECIONA as disponibilizadas — cadastro/edição continua exclusivo do Admin.
  const [availableAreas, setAvailableAreas] = useState<Array<{ id: string; name: string }>>(() => {
    try {
      const cached = localStorage.getItem('epa_areas_cache')
      return cached ? (JSON.parse(cached) as Array<{ id: string; name: string }>) : []
    } catch {
      return []
    }
  })
  const [areaPickerOpen, setAreaPickerOpen] = useState(false)
  const areaPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadAreas = async () => {
      try {
        if (!navigator.onLine || !pb.authStore.isValid) return
        const recs = await pb.collection('areas').getFullList({ sort: 'name' })
        const list = (recs as any[])
          .map((r) => ({ id: r.id, name: r.name || '' }))
          .filter((a) => a.name)
        if (!cancelled && list.length > 0) {
          setAvailableAreas(list)
          try {
            localStorage.setItem('epa_areas_cache', JSON.stringify(list))
          } catch {
            // ignore erros de cota do localStorage
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar áreas (areas):', err)
      }
    }
    loadAreas()
    return () => {
      cancelled = true
    }
  }, [])

  // Fecha o seletor de áreas ao clicar fora dele
  useEffect(() => {
    if (!areaPickerOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (areaPickerRef.current && !areaPickerRef.current.contains(e.target as Node)) {
        setAreaPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [areaPickerOpen])

  const selectedAreas = parseAreaList(
    typeof formData.area === 'string' ? formData.area : String(formData.area || ''),
  )
  // Editável: não bloqueado por status/envio nem por devolução — mesmas regras dos
  // demais campos do cabeçalho. OBS.: a trava de conteúdo da ficha base
  // (isFieldLockedByAdmin) NÃO se aplica à ADIÇÃO de áreas (requisito da seleção
  // múltipla); ela vira trava apenas para REMOÇÃO da área pré-definida pelo Admin.
  const areaEditable = !isLocked && isFieldEditableForTechnician('area') && !formData.archived

  const persistAreas = (next: string[]) => {
    // setFormData direto (e não handleFieldChange): isFieldLockedByAdmin('area')
    // bloquearia a adição quando a base do Admin trouxer uma área — a seleção
    // múltipla precisa permitir acrescentar áreas à lista vinda da base.
    setFormData((prev) => ({ ...prev, area: serializeAreaList(next) }))
    setHasUnsavedChanges(true)
  }

  const toggleArea = (name: string) => {
    if (!areaEditable) return
    const next = selectedAreas.includes(name)
      ? selectedAreas.filter((a) => a !== name)
      : [...selectedAreas, name]
    persistAreas(next)
  }

  const removeArea = (name: string) => {
    if (!areaEditable) return
    if (adminBaseAreas.includes(name)) {
      toast({
        title: 'Área definida pelo Administrador',
        description:
          'Esta área faz parte da configuração da ficha base e não pode ser removida. Se necessário, solicite a alteração ao Administrador.',
        variant: 'destructive',
      })
      return
    }
    persistAreas(selectedAreas.filter((a) => a !== name))
  }

  // Carrega projetos (local + PocketBase) para preenchimento de Cliente, Contrato e Projeto EPA
  useEffect(() => {
    let isMounted = true
    const loadProjectsAndDetails = async () => {
      try {
        const localProjects = await offlineStorage.getAllProjects()
        if (isMounted && localProjects.length > 0) {
          setProjectList(localProjects)
        }

        // Tentar obter dados adicionais se cliente ou contrato não estiverem preenchidos
        const currentProj = localProjects.find(
          (p) => p.id === formData.projectId || p.name === formData.projectName,
        )
        if (currentProj) {
          setFormData((prev) => ({
            ...prev,
            projectName: prev.projectName || currentProj.name,
            clientName: prev.clientName || currentProj.client,
            contractCode: prev.contractCode || currentProj.contract || currentProj.code,
          }))
        } else if (navigator.onLine && pb.authStore.isValid && formData.projectId) {
          try {
            const pRec = await pb.collection('projects').getOne(formData.projectId)
            if (isMounted && pRec) {
              setFormData((prev) => ({
                ...prev,
                projectName: prev.projectName || pRec.name,
                clientName: prev.clientName || (pRec as any).client,
                contractCode: prev.contractCode || (pRec as any).contract || (pRec as any).code,
              }))
            }
          } catch (e) {
            console.warn('Could not fetch project details from PB:', e)
          }
        }
      } catch (e) {
        console.warn('Could not load projects for field editor:', e)
      }
    }

    loadProjectsAndDetails()
    return () => {
      isMounted = false
    }
  }, [formData.projectId])

  // Snapshot administrativo gravado no registro persistido (fonte da verdade definitiva)
  // Prioriza initialSheet.admin_snapshot ou formData.admin_snapshot normalizados com parseAdminSnapshot
  const adminSnapshot =
    parseAdminSnapshot(initialSheet.admin_snapshot) ||
    parseAdminSnapshot(formData.admin_snapshot) ||
    null
  const snapshotWells = Array.isArray(adminSnapshot?.wells) ? adminSnapshot.wells : []
  const snapshotFilledFields = (
    adminSnapshot?.filled_fields &&
    typeof adminSnapshot.filled_fields === 'object' &&
    !Array.isArray(adminSnapshot.filled_fields)
      ? adminSnapshot.filled_fields
      : {}
  ) as Record<string, any>

  // Áreas vindas da FICHA BASE do Admin (snapshot filled_fields.area): configuração
  // administrativa — o Técnico não as remove, apenas ADICIONA outras. Sem área do
  // Admin na base, o Técnico tem liberdade total para montar a lista.
  // (Declarado após snapshotFilledFields — dependência de ordem corrigida em v0.0.201.)
  const adminBaseAreas = parseAreaList(
    typeof snapshotFilledFields.area === 'string'
      ? snapshotFilledFields.area
      : String(snapshotFilledFields.area || ''),
  )

  // PARTE 1 — Configuração de Áreas: hook pré-existente (área única -> preset do Admin).
  // Declarado APÓS formData/isAdmin/setFormData (regra de hooks). A trava é condicional
  // ao CONTEÚDO (campo preenchido pelo Admin = travado; vazio = livre) — vive dentro do hook.
  const { areaConfigSnapshot, isAreaPresetLocked } = useAreaConfigPreset({
    formData: formData as unknown as Record<string, any>,
    isAdmin,
    setFormData,
    pbClient: pb,
  })

  const isFieldLockedByAdmin = (field: string) => {
    if (isAdmin) return false
    const val = snapshotFilledFields[field]
    if (val === undefined || val === null) return false
    if (typeof val === 'boolean') {
      // Compatibilidade legada com snapshots antigos onde o valor era booleano true
      return val
    }
    if (typeof val === 'object') {
      return Object.values(val).some(
        (v) => v !== undefined && v !== null && String(v).trim() !== '' && v !== false,
      )
    }
    return String(val).trim() !== ''
  }

  const isSubFieldLockedByAdmin = (parentField: string, subField: string) => {
    if (isAdmin) return false
    const parentVal = snapshotFilledFields[parentField]
    if (!parentVal || typeof parentVal !== 'object') return false
    const subVal = parentVal[subField]
    return (
      subVal !== undefined && subVal !== null && String(subVal).trim() !== '' && subVal !== false
    )
  }

  const handleFieldChange = (field: keyof OfflineFieldSheetItem, value: any) => {
    if (isFieldLockedByAdmin(field as string)) {
      return
    }
    // Configuração da área: campo pré-preenchido pelo Admin não aceita edição do Técnico.
    if (isAreaPresetLocked(field as string)) {
      return
    }
    if (!isFieldEditableForTechnician(field as string)) {
      return
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  // Destaque visual: campo solicitado pelo Admin no ciclo de correção corrente.
  const isReturnedFieldRequested = (field: string) =>
    isReturnedCycle && returnedFieldsList.includes(field)
  const returnedFieldHighlight =
    'border-amber-400 ring-2 ring-amber-300/70 bg-amber-50/60 dark:bg-amber-950/30'
  // Aparência de campo bloqueado pela devolução (o input já vem desabilitado).
  const returnBlockedClass =
    'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800/60 dark:text-slate-500'

  // Extraction wells handlers
  // O Técnico só pode adicionar poço se o Admin não pré-configurou poços na ficha (snapshotWells vazio e initialSheet.extraction_data vazio)
  const canAddExtractionWell =
    isAdmin ||
    ((!snapshotWells || snapshotWells.length === 0) &&
      (!initialSheet.extraction_data || initialSheet.extraction_data.length === 0))

  const handleAddExtractionWell = () => {
    if (!canAddExtractionWell) return
    const existingCount = formData.extraction_data?.length || 0
    const nextPad = String(existingCount + 1).padStart(2, '0')
    const newRow = {
      well: `PR-${nextPad}`,
      morning: '',
      afternoon: '',
      pump: '',
      autopump: '',
    }
    const updated = [...(formData.extraction_data || []), newRow]
    handleFieldChange('extraction_data', updated)
    toast({ title: 'Poço adicionado', description: `Linha ${newRow.well} inserida na extração.` })
  }

  const isExtractionRowEmpty = (row: any) => {
    if (!row) return true
    const wellEmpty = !row.well || !String(row.well).trim()
    const pumpEmpty = row.pump === undefined || row.pump === null || String(row.pump).trim() === ''
    const morningEmpty = !row.morning || !String(row.morning).trim()
    const afternoonEmpty = !row.afternoon || !String(row.afternoon).trim()
    const autopumpEmpty = !row.autopump || !String(row.autopump).trim()
    const conditionEmpty = !row.autopump_condition || !String(row.autopump_condition).trim()
    return (
      wellEmpty && pumpEmpty && morningEmpty && afternoonEmpty && autopumpEmpty && conditionEmpty
    )
  }

  const handleRemoveExtractionWell = (index: number) => {
    const persistedRow = initialSheet.extraction_data?.[index]
    const snapRow = snapshotWells?.[index]
    const lockedRow = snapRow || persistedRow
    if (!isAdmin && lockedRow && !isExtractionRowEmpty(lockedRow)) {
      toast({
        title: 'Ação não permitida',
        description: 'Técnicos não podem remover poços configurados pelo Administrador.',
        variant: 'destructive',
      })
      return
    }
    const targetRow = formData.extraction_data?.[index]
    if (!isAdmin && !isExtractionRowEmpty(targetRow)) {
      toast({
        title: 'Ação não permitida',
        description: 'Técnicos só podem remover poços vazios da planilha.',
        variant: 'destructive',
      })
      return
    }
    const updated = [...(formData.extraction_data || [])]
    updated.splice(index, 1)
    handleFieldChange('extraction_data', updated)
    toast({ title: 'Poço removido', description: 'Linha excluída da extração.' })
  }

  const handleExtractionCellChange = (index: number, col: string, val: string) => {
    const currentRow = formData.extraction_data?.[index]
    if (!currentRow) return

    if (!isExtractionCellEditable(col)) {
      return
    }

    if (!isAdmin && (col === 'well' || col === 'pump')) {
      const snapRow = snapshotWells?.[index]
      const persistedRow = initialSheet.extraction_data?.[index]
      const rawSnapVal = snapRow ? (snapRow as any)[col] : undefined
      const rawPersistedVal = persistedRow ? (persistedRow as any)[col] : undefined
      const valToCheck = rawSnapVal !== undefined ? rawSnapVal : rawPersistedVal
      const hasLockedVal =
        valToCheck !== undefined && valToCheck !== null && String(valToCheck).trim() !== ''
      if (hasLockedVal) {
        return
      }
    }

    const updated = [...(formData.extraction_data || [])]
    updated[index] = { ...updated[index], [col]: val }
    handleFieldChange('extraction_data', updated)

    // Feedback imediato caso o Técnico informe uma leitura menor (intra-ficha e inter-fichas)
    if (col === 'morning' || col === 'afternoon') {
      const enteredNum = parseHydrometerValue(val)
      if (enteredNum !== null) {
        // Validação intra-ficha: se preenchendo a tarde e já há manhã na mesma linha
        if (col === 'afternoon') {
          const morningNum = parseHydrometerValue(updated[index].morning)
          if (morningNum !== null && enteredNum < morningNum) {
            toast({
              title: '⚠️ Leitura inválida',
              description: HYDROMETER_ERROR_MESSAGE,
              variant: 'destructive',
            })
          }
        }

        // Validação inter-fichas assíncrona ao digitar:
        // Checa se o valor digitado é menor que a última leitura registrada para este poço em outras fichas
        const wellKey = normalizeWellKey(updated[index]?.well)
        if (wellKey) {
          ;(async () => {
            try {
              const allLocal = await offlineStorage.getAllFieldSheets()
              const map = getLatestReadingsMap(allLocal, formData.id)
              const baseline = map[wellKey]
              if (baseline !== undefined && enteredNum < baseline) {
                toast({
                  title: '⚠️ Leitura inválida',
                  description: HYDROMETER_ERROR_MESSAGE,
                  variant: 'destructive',
                })
              }
            } catch (err) {
              console.warn('Erro ao verificar leitura anterior do hidrômetro ao digitar:', err)
            }
          })()
        }
      }
    }
  }

  // Save logic
  const saveSheet = async (targetStatus?: Status) => {
    if (isLocked) {
      toast({
        title: 'Documento bloqueado para edição',
        description:
          'Não é possível alterar esta Planilha de Campo enquanto aguarda aprovação ou estiver aprovada.',
        variant: 'destructive',
      })
      return
    }

    // 1. Validação de formato das datas preenchidas com isValidBrDate
    const dateFieldsToCheck: Array<{ label: string; val: unknown }> = [
      { label: 'Data da Planilha', val: formData.date },
      {
        label: 'Data da limpeza SAO 01',
        val: formData.oil_removal_data?.sao1DataLimpeza,
      },
      {
        label: 'Data da limpeza SAO 02',
        val: formData.oil_removal_data?.sao2DataLimpeza,
      },
    ]

    for (const df of dateFieldsToCheck) {
      if (df.val && !isValidBrDate(df.val)) {
        toast({
          title: 'Data inválida',
          description: INVALID_BR_DATE_MESSAGE,
          variant: 'destructive',
        })
        return
      }
    }

    // 2. Validação do hidrômetro (intra-ficha e inter-fichas)
    // Regra obrigatória: A nova leitura do hidrômetro nunca poderá ser menor que a leitura anterior.
    // Igual é permitido.
    const extractionRows = formData.extraction_data || []
    const currentProjectId = formData.projectId
    const currentSheetId = formData.id || ''

    if (extractionRows.length > 0) {
      // Coleta completa e mesclada de fichas candidatas (servidor + local)
      const mergedMap = new Map<string, OfflineFieldSheetItem>()

      // 1. Carrega todas as fichas locais do dispositivo
      try {
        const allLocal = await offlineStorage.getAllFieldSheets()
        for (const loc of allLocal) {
          if (!loc || loc.deleted) continue
          if (currentProjectId && loc.projectId && loc.projectId !== currentProjectId) continue
          if (currentSheetId && loc.id === currentSheetId) continue
          mergedMap.set(loc.id, loc)
        }
      } catch (cacheErr) {
        console.warn('Erro ao ler fichas locais para validação do hidrômetro:', cacheErr)
      }

      // 2. Se online, consulta o servidor para garantir fichas salvas por outros técnicos
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          let filterStr = `deleted = false`
          if (currentProjectId && !isProvisionalId(currentProjectId)) {
            filterStr += ` && project = "${currentProjectId}"`
          }
          if (currentSheetId && !isProvisionalId(currentSheetId)) {
            filterStr += ` && id != "${currentSheetId}"`
          }
          const serverRecs = await pb.collection('field_spreadsheets').getList(1, 100, {
            filter: filterStr,
            sort: '-date,-created',
          })
          for (const r of serverRecs.items) {
            let ext = (r as any).extraction_data
            if (typeof ext === 'string' && ext.trim() !== '') {
              try {
                ext = JSON.parse(ext)
              } catch {
                ext = []
              }
            }
            const sItem: OfflineFieldSheetItem = {
              id: r.id,
              projectId: (r as any).project,
              projectName: '',
              date: (r as any).date,
              created: (r as any).created,
              area: (r as any).area,
              operator: (r as any).operator,
              extraction_data: Array.isArray(ext) ? ext : [],
              status: (r as any).status,
              syncStatus: 'synced',
              lastModified: new Date((r as any).updated || 0).getTime(),
            } as OfflineFieldSheetItem
            // Se já tínhamos rascunho local pendente para esse id, mantém o local mais recente
            if (!mergedMap.has(r.id) || mergedMap.get(r.id)?.syncStatus === 'synced') {
              mergedMap.set(r.id, sItem)
            }
          }
        } catch (serverErr) {
          console.warn('Falha ao buscar fichas do servidor para hidrômetro:', serverErr)
        }
      }

      const allCandidateSheets = Array.from(mergedMap.values())

      const hydrometerCheck = validateHydrometerReadings(
        extractionRows,
        allCandidateSheets,
        currentSheetId,
      )

      if (!hydrometerCheck.valid) {
        toast({
          title: '⚠️ Leitura inválida',
          description: HYDROMETER_ERROR_MESSAGE,
          variant: 'destructive',
        })
        return
      }
    }

    setIsSaving(true)
    // Se o Admin estiver despachando/atribuindo a planilha ao Técnico, o status mantém-se 'draft'
    // (a permissão já permite ao Técnico editar rascunhos 'draft' e devoluções 'returned', sem sujar o histórico com devolução).
    // O status 'returned' ocorre EXCLUSIVAMENTE quando já estava 'submitted' e o Admin clica expressamente em "Devolver para correção".
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
        const changes = diffFieldSheet(
          activeCycle.snapshot,
          formData,
          user?.id,
          user?.name || 'Técnico',
        )
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

    // Tenta associar projeto ativo se disponível localmente, mas sem bloquear salvamento offline
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
        console.warn('Error resolving active project on FieldSheet save:', e)
      }
    }

    // Atribuição obrigatória: nunca salvar/enviar sem um técnico real selecionado.
    // Sem isso o servidor recusaria o create (operator é relation obrigatória) e a
    // ficha cairia na fila de sync com erro 400.
    if (!(formData.operator || '').trim()) {
      toast({
        title: 'Selecione um técnico',
        description:
          'Escolha ao menos um técnico no campo "Técnico / Responsável" antes de salvar ou enviar a planilha.',
        variant: 'destructive',
      })
      return
    }

    // Áreas: a Planilha de Campo exige ao menos uma área selecionada (campo 'area' é
    // obrigatório no servidor). Com a seleção múltipla, 'area' guarda os nomes separados
    // por vírgula — sem área o create seria recusado (400) e a ficha ficaria presa na fila.
    if (
      parseAreaList(typeof formData.area === 'string' ? formData.area : String(formData.area || ''))
        .length === 0
    ) {
      toast({
        title: 'Selecione ao menos uma área',
        description:
          'Escolha uma ou várias áreas no cabeçalho "ÁREAS ATENDIDAS NESTA PLANILHA" antes de salvar ou enviar a planilha.',
        variant: 'destructive',
      })
      return
    }

    const isProvisional = isNew || isProvisionalId(formData.id)

    // Se quem está salvando é o Admin, gera e atualiza o admin_snapshot contendo
    // technician_name (texto puro), operator, poços PR configurados (com well e pump)
    // e o dicionário filled_fields com todos os campos estruturais preenchidos pelo Admin.
    const excludedKeys = new Set([
      'id',
      'status',
      'syncStatus',
      'lastModified',
      'extraction_data',
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

    let currentAdminSnapshot =
      parseAdminSnapshot(formData.admin_snapshot) ||
      parseAdminSnapshot(initialSheet.admin_snapshot) ||
      formData.admin_snapshot ||
      initialSheet.admin_snapshot
    if (isAdmin) {
      const wellsSnapshot = (formData.extraction_data || []).map((row) => ({
        well: String(row.well || '').trim(),
        pump: row.pump !== undefined && row.pump !== null ? String(row.pump).trim() : '',
      }))

      const effectiveOpName = (formData.operatorName || user?.name || '').trim()

      currentAdminSnapshot = {
        operator: formData.operator || user?.id || '',
        technician_name: effectiveOpName,
        wells: wellsSnapshot,
        filled_fields: filledFieldsMap,
        captured_at: nowIso,
      }
    }

    // Sanitização de relations locais caso formData contenha IDs provisórios
    const safeOperator =
      formData.operator &&
      !formData.operator.startsWith('user_') &&
      !formData.operator.startsWith('field_')
        ? formData.operator
        : user?.id && !user.id.startsWith('user_')
          ? user.id
          : formData.operator

    // Atribuição de técnicos: grava SEMPRE a lista (admin edita; técnico preserva o que veio do servidor)
    const assignedTechs =
      isAdmin && Array.isArray(selectedTechnicians)
        ? selectedTechnicians.filter(
            (id) => typeof id === 'string' && id.trim() !== '' && !isProvisionalId(id),
          )
        : Array.isArray(formData.assigned_technicians)
          ? formData.assigned_technicians
          : []

    const updatedItem = {
      ...formData,
      operator: safeOperator,
      assigned_technicians: assignedTechs,
      status: effectiveStatus,
      change_history: updatedHistory,
      // PARTE 1 — snapshot da configuração de área viaja como um campo a mais no payload
      // (o hook já grava/limpa a string em formData; aqui apenas garantimos o valor final).
      area_config_snapshot: areaConfigSnapshot
        ? (formData.area_config_snapshot ?? JSON.stringify(areaConfigSnapshot))
        : undefined,
      admin_snapshot:
        currentAdminSnapshot &&
        typeof currentAdminSnapshot === 'object' &&
        !Array.isArray(currentAdminSnapshot)
          ? currentAdminSnapshot
          : undefined,
      syncStatus: isProvisional ? 'pending_create' : 'pending_update',
      lastModified: Date.now(),
    }

    try {
      // CORREÇÃO 1 — Gravação direta ao servidor quando há internet e sessão válida.
      // Antes: o save ia SOMENTE para a fila offline (pending_create/pending_update) e
      // dependia de syncNow disparado por focus/visibility — se nada disparasse, a ficha
      // nunca chegava ao banco central.
      const directSaveResult: DirectSaveResult = await directSaveSheetToServer(updatedItem, {
        isNew: isProvisional,
        toast,
      })

      await offlineStorage.saveFieldSheet(updatedItem)
      setFormData(updatedItem)
      setHasUnsavedChanges(false)

      if (isAdmin && formData.projectId) {
        const structuralWells = (formData.extraction_data || []).map((row: any) => ({
          well: String(row.well || '').trim(),
          pump: row.pump !== undefined && row.pump !== null ? String(row.pump).trim() : '',
          autopump:
            row.autopump !== undefined && row.autopump !== null ? String(row.autopump).trim() : '',
        }))

        const baseSheetFieldPayload = {
          projectId: formData.projectId,
          projectName: formData.projectName || '',
          clientName: formData.clientName || '',
          contractCode: formData.contractCode || '',
          area: formData.area || '',
          operator: formData.operator || '',
          operatorName: formData.operatorName || '',
          technician_name: formData.operatorName || '',
          technicianName: formData.operatorName || '',
          date: formData.date || '',
          weather: formData.weather || '',
          pluviometer: formData.pluviometer ?? '',
          morning_time: formData.morning_time || '',
          afternoon_time: formData.afternoon_time || '',
          infiltration_morning_time: formData.infiltration_morning_time || '',
          infiltration_afternoon_time: formData.infiltration_afternoon_time || '',
          infiltration_data: formData.infiltration_data || {},
          nutrient_done: formData.nutrient_done || false,
          nutrient_map_kg: formData.nutrient_map_kg ?? '',
          nutrient_ureia_kg: formData.nutrient_ureia_kg ?? '',
          compressor_data: formData.compressor_data || {},
          oil_removal_data: formData.oil_removal_data || {},
          waste_liquid_qty: formData.waste_liquid_qty ?? '',
          waste_solid_qty: formData.waste_solid_qty ?? '',
          env_5s_check: formData.env_5s_check || false,
          env_checklist_monthly: formData.env_checklist_monthly || false,
          observations: formData.observations || '',
          wells: structuralWells,
          extraction_data: structuralWells,
          filled_fields: filledFieldsMap,
          published: true,
          published_at: new Date().toISOString(),
        }

        // Validação anti-downgrade e integridade estrutural no frontend:
        const requiredKeys = ['weather', 'infiltration_data', 'compressor_data', 'oil_removal_data']
        const missingKeys = requiredKeys.filter((k) => !(k in baseSheetFieldPayload))
        if (missingKeys.length > 0) {
          toast({
            title: 'Atenção: Versão desatualizada em cache detectada',
            description: `O formulário está com chaves ausentes (${missingKeys.join(', ')}). Recarregue a página com Ctrl+F5 para atualizar o aplicativo.`,
            variant: 'destructive',
          })
          return
        }

        try {
          const proj = await offlineStorage.getProject(formData.projectId)
          const nowIso = new Date().toISOString()
          if (proj) {
            await offlineStorage.saveProject({
              ...proj,
              base_sheet_field: baseSheetFieldPayload,
              base_sheet_published: true,
              base_sheet_updated_at: nowIso,
              lastModified: Date.now(),
              syncStatus: 'pending_update',
            })
          }
          if (navigator.onLine && pb.authStore.isValid) {
            await pb.collection('projects').update(formData.projectId, {
              base_sheet_field: baseSheetFieldPayload,
              base_sheet_published: true,
              base_sheet_updated_at: nowIso,
            })
          }
        } catch (e: any) {
          console.warn('Falha ao publicar ficha base (Planilha de Campo):', e)
          if (e?.message?.includes('servidor') || e?.message?.includes('recente')) {
            toast({
              title: 'Bloqueio de versão pelo servidor',
              description: e.message,
              variant: 'destructive',
            })
            return
          }
        }
      }

      if (isOnline) {
        await syncNow()
        // Após o sync online direto, recarrega a versão persistida atualizada com number e ID do servidor
        try {
          let syncedSheet = await offlineStorage.getFieldSheet(updatedItem.id)
          if (!syncedSheet && isProvisionalId(updatedItem.id)) {
            const allSheets = await offlineStorage.getAllFieldSheets()
            syncedSheet = allSheets.find(
              (s) =>
                s.lastModified === updatedItem.lastModified ||
                (s.date === updatedItem.date && s.projectId === updatedItem.projectId),
            )
          }
          if (syncedSheet) {
            setFormData(syncedSheet)
          }
        } catch {
          // ignore
        }
      }

      // CORREÇÃO 1: feedback fiel ao resultado real da gravação direta.
      const directDesc =
        targetStatus === 'submitted'
          ? isAdmin
            ? 'Planilha atribuída e liberada para preenchimento do Técnico.'
            : 'A planilha foi enviada para validação e aprovação do Administrador.'
          : directSaveResult === 'synced'
            ? 'Dados gravados e sincronizados com o servidor.'
            : directSaveResult === 'queued'
              ? 'Sem comunicação com o servidor: salvo no dispositivo e será reenviado automaticamente.'
              : 'Salvo no dispositivo (IndexedDB).'
      if (directSaveResult !== 'queued') {
        toast({
          title:
            targetStatus === 'submitted'
              ? isAdmin
                ? 'Planilha disponibilizada ao Técnico'
                : 'Planilha enviada para aprovação'
              : 'Planilha salva com sucesso',
          description: directDesc,
        })
      }
      onSaved()
    } catch (err) {
      console.error('Save sheet error:', err)
      toast({
        title: 'Não foi possível salvar a planilha',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Destaque ambar de campo solicitado na devolução corrente — usa a MESMA lista
  // validada (returnedFieldsList) que o servidor usa no guard.
  const isReturnedField = (fieldName: string) =>
    isReturnedCycle && isRecordFieldAuthorized('field_sheet', fieldName, returnedFieldsList)

  const clearReturnedField = (fieldName: string) => {
    if (formData.returned_fields?.includes(fieldName)) {
      setFormData((prev) => ({
        ...prev,
        returned_fields: prev.returned_fields?.filter((f) => f !== fieldName),
      }))
    }
  }

  // Admin Approval / Return
  const handleAdminStatusChange = async (nextStatus: 'approved' | 'returned') => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        description: 'Apenas Administradores podem aprovar ou devolver planilhas.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const nowIso = new Date().toISOString()
      let updatedHistory = formData.change_history ? [...formData.change_history] : []

      if (nextStatus === 'returned') {
        const snapshot = createFieldSheetSnapshot(formData)
        const requestedLabels = reviewReturnedFields.map((fId) => {
          const opt = FIELD_SHEET_RETURN_OPTIONS.find((o) => o.id === fId)
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

      const updatedItem: OfflineFieldSheetItem = {
        ...formData,
        status: nextStatus,
        reviewNotes: nextStatus === 'returned' ? reviewNotes : '',
        returned_fields:
          nextStatus === 'returned' ? reviewReturnedFields : formData.returned_fields,
        returnedByName: nextStatus === 'returned' ? user?.name : formData.returnedByName,
        returnedAt: nextStatus === 'returned' ? nowIso : formData.returnedAt,
        change_history: updatedHistory.length > 0 ? updatedHistory : formData.change_history,
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      await offlineStorage.saveFieldSheet(updatedItem)
      setFormData(updatedItem)
      setReviewOpen(false)
      setHasUnsavedChanges(false)

      if (isOnline) {
        try {
          await updateFieldStatus(
            formData.id,
            nextStatus,
            reviewNotes,
            nextStatus === 'returned' ? reviewReturnedFields : [],
            user?.name || 'Administrador',
            updatedHistory,
          )
        } catch {
          // ignore if mock
        }
        await syncNow()
      }

      toast({
        title:
          nextStatus === 'approved'
            ? 'Planilha aprovada com sucesso'
            : 'Planilha devolvida para correção',
        description:
          nextStatus === 'approved'
            ? 'A planilha foi bloqueada para novas edições.'
            : 'O técnico foi notificado para os ajustes.',
      })
      onSaved()
    } catch (err) {
      console.error('Admin status error:', err)
      toast({
        title: 'Erro ao processar',
        description: 'Não foi possível alterar o status da planilha.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const canExportExcel = isAdmin

  // Excel Export (Admin tem permissão exclusiva de exportar planilha)
  const handleExportExcel = async () => {
    if (!canExportExcel) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Exportação permitida exclusivamente para Administradores.',
        variant: 'destructive',
      })
      return
    }

    setIsExporting(true)
    try {
      if (isOnline) {
        const response = await fetch(exportUrl('field', formData.id), { headers: authHeaders() })
        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `Planilha-Campo-EPA-${formData.date}.xls`
          a.click()
          URL.revokeObjectURL(url)
          toast({ title: 'Excel gerado com sucesso', description: 'Download iniciado.' })
          return
        }
      }

      // Offline Excel export generation
      generateLocalExcelExport(formData)
      toast({
        title: 'Excel exportado localmente',
        description: 'Arquivo gerado a partir dos dados do dispositivo.',
      })
    } catch (err) {
      console.error('Excel export error:', err)
      toast({
        title: 'A exportação necessita de conexão com o servidor.',
        description: 'Não foi possível completar o download do Excel.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const parseNutrientValue = (val: unknown): number | null => {
    if (val === null || val === undefined || val === '') return null
    let s = String(val).trim()
    if (s === '' || s === '0') return null
    if (s.includes(',') && s.includes('.')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.')
      } else {
        s = s.replace(/,/g, '')
      }
    } else if (s.includes(',')) {
      s = s.replace(',', '.')
    }
    const n = parseFloat(s)
    return isNaN(n) ? null : n
  }

  const nutrientTotal = useMemo(() => {
    const mapVal = parseNutrientValue(formData.nutrient_map_kg)
    const ureiaVal = parseNutrientValue(formData.nutrient_ureia_kg)
    return (mapVal ?? 0) + (ureiaVal ?? 0)
  }, [formData.nutrient_map_kg, formData.nutrient_ureia_kg])

  return (
    <div className="space-y-6 pb-16">
      {/* Top sticky header */}
      <div className="sticky top-[72px] z-20 flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-md backdrop-blur md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900/95">
        <div>
          <button
            onClick={onBack}
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar às Planilhas de Campo
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">
              {typeof formData.number === 'number' && formData.number > 0
                ? `Planilha Nº ${formData.number}`
                : 'Planilha de Campo'}
              {formData.date ? ` · ${formData.date}` : ''}
            </h2>
            <StatusBadge status={formData.status} />
            <SheetSyncBadge
              syncStatus={formData.syncStatus}
              isGlobalSyncing={isOnline && formData.syncStatus === 'pending_update'}
              syncError={formData.syncError}
            />
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Arquivar / Desarquivar (Admin apenas, não visível para Técnico) */}
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
              {formData.archived ? 'Desarquivar Planilha' : 'Arquivar Planilha'}
            </Button>
          )}

          {/* Excluir (Admin apenas, se ainda não estiver excluído) */}
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

          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => printFieldSheet(formData)}
              className="min-h-[44px] text-xs font-semibold dark:border-slate-800 print:hidden"
              title="Imprimir ou Salvar como PDF formatado"
            >
              <Printer className="mr-1.5 h-4 w-4 text-slate-600 dark:text-slate-400" />
              Imprimir / PDF
            </Button>
          )}

          {canExportExcel && (
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="min-h-[44px] text-xs font-semibold dark:border-slate-800 print:hidden"
            >
              {isExporting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando Excel...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Exportar / Baixar Planilha
                </span>
              )}
            </Button>
          )}

          {!isLocked && !formData.archived && (
            <>
              <Button
                variant="outline"
                onClick={() => saveSheet('draft')}
                disabled={isSaving}
                className="min-h-[44px] text-xs font-semibold dark:border-slate-800"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Salvar Rascunho
              </Button>
              <Button
                onClick={() => saveSheet('submitted')}
                disabled={isSaving}
                className="min-h-[44px] bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-sm"
              >
                <Send className="mr-1.5 h-4 w-4" />
                {isAdmin ? 'Enviar para o Técnico' : 'Enviar para aprovação'}
              </Button>
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
                Aprovar Planilha
              </Button>
              <Button
                variant="outline"
                onClick={() => setReviewOpen(true)}
                disabled={isSaving}
                className="min-h-[44px] border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-semibold dark:border-amber-700 dark:text-amber-300"
              >
                <AlertCircle className="mr-1.5 h-4 w-4" />
                Devolver
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
                Planilha de Campo Excluída pelo Administrador
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                Excluída em:{' '}
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
                Planilha de Campo Arquivada
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Esta planilha está em modo de leitura nos arquivos.{' '}
                {!isTechnician && 'Você pode desarquivá-la a qualquer momento.'}
              </p>
            </div>
          </div>
          {!isTechnician && onToggleArchive && (
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

      {/* Caixa de Aviso de Devolução */}
      {formData.status === 'returned' && (
        <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-5 dark:border-amber-700 dark:bg-amber-950/40 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-200/80 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-amber-950 dark:text-amber-200 text-sm flex items-center gap-2">
                ⚠️ Correção solicitada pelo Administrador
              </h3>
              <p className="text-xs font-medium text-amber-900 dark:text-amber-300 mt-1.5 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-3 rounded-lg border border-amber-200/80 dark:border-amber-900/60">
                {formData.reviewNotes ||
                  'Por favor, revise os campos indicados e reenvie para aprovação.'}
              </p>
              {returnedFieldsList.length > 0 && (
                <div className="mt-2">
                  <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 block mb-1">
                    Campos solicitados para correção:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {returnedFieldsList.map((f) => {
                      const opt = (FIELD_SHEET_RETURN_OPTIONS as any[]).find(
                        (o) => o && (o.value ?? o.id ?? o.key) === f,
                      )
                      const label = (opt && (opt.label ?? opt.name)) || f
                      return (
                        <span
                          key={f}
                          className="inline-flex items-center rounded-md bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100"
                        >
                          🟨 {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
              {(formData.returnedByName || formData.returnedAt) && (
                <p className="text-[11px] text-amber-800/90 dark:text-amber-400 mt-2">
                  {formData.returnedByName && (
                    <>
                      Devolvido por: <b>{formData.returnedByName}</b>
                    </>
                  )}
                  {formData.returnedByName && formData.returnedAt && ' · '}
                  {formData.returnedAt && (
                    <>em {new Date(formData.returnedAt).toLocaleString('pt-BR')}</>
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico das Alterações após Devolução — exibido SOMENTE para o Admin (diffs do ciclo).
          O Técnico vê apenas o banner de solicitação de correção (campos + justificativa) acima. */}
      {isAdmin && formData.change_history && formData.change_history.length > 0 && (
        <CorrectionHistorySection
          cycles={formData.change_history}
          currentStatus={formData.status}
          isAdmin
          documentType="field_sheet"
        />
      )}

      {/* CABEÇALHO OFICIAL */}
      <section className="epa-card p-6 border-t-4 border-t-emerald-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logoEpa} alt="EPA" className="h-12 w-auto object-contain" />
          </div>
          <div className="text-left md:text-right">
            <h1 className="text-base md:text-lg font-extrabold tracking-wide text-slate-900 dark:text-white">
              Controle Operacional Diário de Remediação
            </h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="epa-label">TÉCNICO / RESPONSÁVEL</label>
            {(() => {
              // MELHORIA 3: o Técnico nunca edita "Técnico / Responsável" — o campo único
              // fica somente-leitura, mostrando os técnicos atribuídos (ele incluso).
              if (!isAdmin) {
                const operatorDisplay =
                  formData.operatorName || adminSnapshot?.technician_name || user?.name || ''
                return (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                    {selectedTechnicians.length === 0 ? (
                      <span>{operatorDisplay}</span>
                    ) : (
                      selectedTechnicians.map((id) => (
                        <span
                          key={id}
                          className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-600"
                        >
                          {techNameOf(id)}
                        </span>
                      ))
                    )}
                  </div>
                )
              }
              return (
                <div ref={techPickerRef} className="relative mt-1">
                  <div
                    className={cn(
                      'flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-lg border px-3 py-1.5',
                      isLocked ? 'cursor-not-allowed' : 'cursor-text',
                    )}
                    onClick={() => {
                      if (!isLocked) setTechPickerOpen((v) => !v)
                    }}
                  >
                    {selectedTechnicians.length === 0 && !techPickerOpen && (
                      <span className="text-sm text-slate-400">
                        Selecione um ou vários técnicos
                      </span>
                    )}
                    {selectedTechnicians.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800"
                      >
                        {techNameOf(id)}
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveTechnician(id)
                            }}
                            className="ml-0.5 text-emerald-600 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                            aria-label={`Remover ${techNameOf(id)}`}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    ))}
                    {!isLocked && <span className="ml-auto text-xs text-slate-400">▾</span>}
                  </div>
                  {techPickerOpen && !isLocked && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                      {technicians.length === 0 && (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          Nenhum técnico ativo cadastrado — cadastre em Gerenciamento de Usuários.
                        </p>
                      )}
                      {technicians.map((t) => {
                        const checked = selectedTechnicians.includes(t.id)
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleToggleTechnician(t.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 items-center justify-center rounded border',
                                checked
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-400 dark:border-slate-600',
                              )}
                            >
                              {checked && '✓'}
                            </span>
                            <span className="text-slate-900 dark:text-slate-100">{t.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {isAdmin && technicians.length === 0 && !techPickerOpen && (
                    <p className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      Nenhum técnico cadastrado — cadastre em Gerenciamento de Usuários.
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
          <div>
            <label className="epa-label">DATA</label>
            <Input
              value={formData.date}
              onChange={(e) => handleFieldChange('date', applyDateMask(e.target.value))}
              placeholder="DD/MM/AAAA"
              disabled={isLocked || isFieldLockedByAdmin('date') || isReturnBlocked('date')}
              readOnly={isFieldLockedByAdmin('date') || isReturnBlocked('date')}
              className={cn(
                'mt-1',
                (isFieldLockedByAdmin('date') || isReturnBlocked('date')) &&
                  'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 cursor-not-allowed select-none',
              )}
            />
          </div>
          <div>
            <label className="epa-label">CLIMA</label>
            {isFieldLockedByAdmin('weather') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                <span>{formData.weather || 'Ensolarado'}</span>
              </div>
            ) : (
              (() => {
                const fixedChoices = ['Ensolarado', 'Chuvoso', 'Instável']
                const rawWeather = formData.weather ?? 'Ensolarado'
                const isOtherText =
                  rawWeather === 'Outros' ||
                  (rawWeather !== '' && !fixedChoices.includes(rawWeather))

                if (isOtherText) {
                  const displayVal = rawWeather === 'Outros' ? '' : rawWeather
                  return (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Input
                        type="text"
                        value={displayVal}
                        onChange={(e) => {
                          handleFieldChange('weather', e.target.value)
                          clearReturnedField('weather')
                        }}
                        disabled={isLocked || isReturnBlocked('weather')}
                        placeholder="Descreva a condição do clima..."
                        className={cn(
                          'min-h-[42px] text-xs sm:text-sm flex-1',
                          isReturnedField('weather') &&
                            'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                        )}
                      />
                      {!isLocked && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleFieldChange('weather', 'Ensolarado')
                            clearReturnedField('weather')
                          }}
                          className="min-h-[42px] px-2.5 text-[11px] shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                          title="Voltar às opções de clima"
                        >
                          Opções
                        </Button>
                      )}
                    </div>
                  )
                }

                return (
                  <select
                    value={rawWeather}
                    onChange={(e) => {
                      const selected = e.target.value
                      handleFieldChange('weather', selected === 'Outros' ? 'Outros' : selected)
                      clearReturnedField('weather')
                    }}
                    disabled={isLocked || isReturnBlocked('weather')}
                    className={cn(
                      'epa-input mt-1 min-h-[42px]',
                      isReturnBlocked('weather') &&
                        'cursor-not-allowed opacity-60 bg-slate-100 dark:bg-slate-800',
                      isReturnedField('weather') &&
                        'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold',
                    )}
                  >
                    <option value="Ensolarado">Ensolarado</option>
                    <option value="Chuvoso">Chuvoso</option>
                    <option value="Instável">Instável</option>
                    <option value="Outros">Outros</option>
                  </select>
                )
              })()
            )}
          </div>
          <div>
            <label className="epa-label">PLUVIÔMETRO (mm)</label>
            {isFieldLockedByAdmin('pluviometer') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                <span>{`${formData.pluviometer === 0 || formData.pluviometer === '0' || formData.pluviometer === '' ? '—' : `${formData.pluviometer} mm`}`}</span>
              </div>
            ) : (
              <Input
                type="text"
                value={
                  formData.pluviometer === 0 || formData.pluviometer === '0'
                    ? ''
                    : (formData.pluviometer ?? '')
                }
                onChange={(e) => handleFieldChange('pluviometer', e.target.value)}
                disabled={isLocked || isReturnBlocked('pluviometer')}
                placeholder="Ex.: 0 ou 12.5"
                className="mt-1 font-mono text-xs sm:text-sm min-h-[42px]"
              />
            )}
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="epa-label">ÁREAS ATENDIDAS NESTA PLANILHA</label>
            {areaEditable ? (
              <div ref={areaPickerRef} className="relative mt-1">
                <div
                  className="flex min-h-[42px] w-full flex-wrap items-center gap-1.5 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
                  onClick={() => setAreaPickerOpen((v) => !v)}
                >
                  {selectedAreas.length === 0 && !areaPickerOpen && (
                    <span className="text-sm text-slate-400">Selecione uma ou várias áreas</span>
                  )}
                  {selectedAreas.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeArea(name)
                        }}
                        className="ml-0.5 text-emerald-600 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-100"
                        aria-label={`Remover área ${name}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-slate-400">▾</span>
                </div>
                {areaPickerOpen && (
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {availableAreas.length === 0 && (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        Nenhuma área cadastrada — solicite o cadastro ao Administrador.
                      </p>
                    )}
                    {availableAreas.map((a) => {
                      const checked = selectedAreas.includes(a.name)
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleArea(a.name)}
                          className="flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                              checked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-400 dark:border-slate-600',
                            )}
                          >
                            {checked && '✓'}
                          </span>
                          <span className="text-slate-900 dark:text-slate-100">{a.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {selectedAreas.length === 0 ? (
                  <span>—</span>
                ) : (
                  selectedAreas.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {name}
                    </span>
                  ))
                )}
              </div>
            )}
            {areaEditable && (
              <p className="mt-1 text-[11px] text-slate-400">
                Selecione apenas as áreas disponibilizadas pelo Administrador — o cadastro de áreas
                continua exclusivo do Administrador.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* 1. EXTRAÇÃO/VOLUME BOMBEADO */}
      <section className="epa-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              1. EXTRAÇÃO/VOLUME BOMBEADO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leituras dos poços de remediação, hidrômetros (manhã/tarde), altura da bomba e saídas
            </p>
          </div>
          {!isLocked && canAddExtractionWell && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddExtractionWell}
              className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[38px]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Poço (PR)
            </Button>
          )}
        </div>

        {/* Aviso de orientação para o Técnico sobre poços definidos pelo Administrador */}
        {isTechnician && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div className="leading-relaxed">
              <b>Poços definidos pelo Administrador.</b> Se o poço necessário não constar na lista,
              solicite o cadastro prévio ao Administrador.
            </div>
          </div>
        )}

        {/* Aviso destacado quando a lista de poços estiver vazia */}
        {isAdmin && (!formData.extraction_data || formData.extraction_data.length === 0) && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div>
              <p className="font-bold">Nenhum poço inserido nesta planilha</p>
              <p className="mt-0.5">
                Utilize o botão "Adicionar Poço (PR)" acima para cadastrar os poços de remediação
                desta ficha.
              </p>
            </div>
          </div>
        )}

        {/* Dica para o celular */}
        <p className="mt-2 text-[11px] text-slate-400 sm:hidden flex items-center gap-1">
          <span>
            👉 Deslize horizontalmente para visualizar e preencher todas as colunas da tabela
          </span>
        </p>

        <div className="mt-3 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-40">
                  Poço de Remediação
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[180px]">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>Hidrômetro (Manhã)</span>
                    {isReturnedField('hidrometro') && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase tracking-tight shadow-sm">
                        🟨 CORREÇÃO
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.morning_time || ''}
                      onChange={(e) => {
                        handleFieldChange('morning_time', e.target.value)
                        clearReturnedField('hidrometro')
                      }}
                      disabled={
                        isLocked ||
                        isFieldLockedByAdmin('morning_time') ||
                        isReturnBlocked('morning_time')
                      }
                      readOnly={isFieldLockedByAdmin('morning_time')}
                      className={cn(
                        'h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1',
                        isFieldLockedByAdmin('morning_time') &&
                          'bg-slate-200 text-slate-700 cursor-not-allowed',
                        isReturnedField('hidrometro') &&
                          'border-2 border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100 font-semibold',
                      )}
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[180px]">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>Hidrômetro (Tarde)</span>
                    {isReturnedField('hidrometro') && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase tracking-tight shadow-sm">
                        🟨 CORREÇÃO
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.afternoon_time || ''}
                      onChange={(e) => {
                        handleFieldChange('afternoon_time', e.target.value)
                        clearReturnedField('hidrometro')
                      }}
                      disabled={
                        isLocked ||
                        isFieldLockedByAdmin('afternoon_time') ||
                        isReturnBlocked('afternoon_time')
                      }
                      readOnly={isFieldLockedByAdmin('afternoon_time')}
                      className={cn(
                        'h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1',
                        isFieldLockedByAdmin('afternoon_time') &&
                          'bg-slate-200 text-slate-700 cursor-not-allowed',
                        isReturnedField('hidrometro') &&
                          'border-2 border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-100 font-semibold',
                      )}
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-36">
                  Altura da bomba (m)
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[210px]">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span>Saída Autopump (500mL)*</span>
                    {isReturnedField('autopump') && (
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold text-amber-950 uppercase tracking-tight shadow-sm">
                        🟨 CORREÇÃO
                      </span>
                    )}
                  </div>
                </th>
                {!isLocked && (isAdmin || isTechnician) && (
                  <th className="p-2.5 border border-emerald-800 w-12 text-center"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {formData.extraction_data?.map((row, index) => {
                const snapRow = snapshotWells?.[index]
                const persistedRow = initialSheet?.extraction_data?.[index]
                const lockedRow = snapRow || persistedRow

                const effectiveWell = (snapRow?.well || persistedRow?.well || '').trim()
                const hasLockedWell = isTechnician && Boolean(effectiveWell)

                const effectivePump =
                  snapRow?.pump !== undefined &&
                  snapRow?.pump !== null &&
                  String(snapRow.pump).trim() !== ''
                    ? snapRow.pump
                    : persistedRow?.pump !== undefined &&
                        persistedRow?.pump !== null &&
                        String(persistedRow.pump).trim() !== ''
                      ? persistedRow.pump
                      : undefined
                const hasLockedPump = isTechnician && effectivePump !== undefined

                return (
                  <tr key={index} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      {hasLockedWell ? (
                        <div className="flex items-center justify-center gap-1.5 py-2 px-2 font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 rounded min-h-[40px] cursor-not-allowed select-none">
                          <span>{effectiveWell}</span>
                        </div>
                      ) : (
                        <Input
                          value={row.well}
                          onChange={(e) =>
                            handleExtractionCellChange(index, 'well', e.target.value)
                          }
                          disabled={isLocked || !isExtractionCellEditable('extraction_data')}
                          placeholder="Ex.: PR-01"
                          className={cn(
                            'h-10 font-semibold text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700',
                            !isExtractionCellEditable('extraction_data') && returnBlockedClass,
                          )}
                        />
                      )}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      <Input
                        inputMode="decimal"
                        value={row.morning}
                        onChange={(e) => {
                          handleExtractionCellChange(index, 'morning', e.target.value)
                          clearReturnedField('hidrometro')
                        }}
                        disabled={isLocked || !isExtractionCellEditable('morning_time')}
                        placeholder="0,00"
                        className={cn(
                          'h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700',
                          !isExtractionCellEditable('morning_time') && returnBlockedClass,
                          isReturnedField('hidrometro') &&
                            'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                        )}
                      />
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      <Input
                        inputMode="decimal"
                        value={row.afternoon}
                        onChange={(e) => {
                          handleExtractionCellChange(index, 'afternoon', e.target.value)
                          clearReturnedField('hidrometro')
                        }}
                        disabled={isLocked || !isExtractionCellEditable('afternoon_time')}
                        placeholder="0,00"
                        className={cn(
                          'h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700',
                          !isExtractionCellEditable('afternoon_time') && returnBlockedClass,
                          isReturnedField('hidrometro') &&
                            'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                        )}
                      />
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      {hasLockedPump ? (
                        <div className="flex items-center justify-center px-2 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                          <span>{`${effectivePump} m`}</span>
                        </div>
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={row.pump}
                          onChange={(e) =>
                            handleExtractionCellChange(index, 'pump', e.target.value)
                          }
                          disabled={isLocked || !isExtractionCellEditable('extraction_data')}
                          placeholder="0,00"
                          className={cn(
                            'h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700',
                            !isExtractionCellEditable('extraction_data') && returnBlockedClass,
                          )}
                        />
                      )}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      {(() => {
                        const fixedChoices = ['Limpa', 'Turva', 'Oleosa']
                        const rawVal = row.autopump || row.autopump_condition || ''
                        const isOtherText =
                          rawVal === 'Outros' || (rawVal !== '' && !fixedChoices.includes(rawVal))

                        if (isOtherText) {
                          const displayVal =
                            rawVal === 'Outros' ? row.autopump_condition_other || '' : rawVal

                          return (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="text"
                                value={displayVal}
                                onChange={(e) => {
                                  const textVal = e.target.value
                                  const currentRow = formData.extraction_data?.[index]
                                  if (!currentRow) return
                                  const updated = [...(formData.extraction_data || [])]
                                  updated[index] = {
                                    ...updated[index],
                                    autopump: textVal,
                                    autopump_condition: textVal,
                                    autopump_condition_other: textVal,
                                  }
                                  handleFieldChange('extraction_data', updated)
                                  clearReturnedField('autopump')
                                }}
                                disabled={isLocked || !isExtractionCellEditable('autopump')}
                                placeholder="Descreva a saída..."
                                className={cn(
                                  'h-10 text-xs sm:text-sm flex-1',
                                  !isExtractionCellEditable('autopump') && returnBlockedClass,
                                  isReturnedField('autopump') &&
                                    'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                                )}
                              />
                              {!isLocked && isExtractionCellEditable('autopump') && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentRow = formData.extraction_data?.[index]
                                    if (!currentRow) return
                                    const updated = [...(formData.extraction_data || [])]
                                    updated[index] = {
                                      ...updated[index],
                                      autopump: '',
                                      autopump_condition: '',
                                      autopump_condition_other: '',
                                    }
                                    handleFieldChange('extraction_data', updated)
                                    clearReturnedField('autopump')
                                  }}
                                  className="h-10 px-2 text-[11px] shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                  title="Voltar às opções de saída do autopump"
                                >
                                  Opções
                                </Button>
                              )}
                            </div>
                          )
                        }

                        return (
                          <select
                            value={rawVal}
                            onChange={(e) => {
                              const selected = e.target.value
                              const currentRow = formData.extraction_data?.[index]
                              if (!currentRow) return
                              const updated = [...(formData.extraction_data || [])]
                              updated[index] = {
                                ...updated[index],
                                autopump: selected === 'Outros' ? '' : selected,
                                autopump_condition: selected,
                                autopump_condition_other:
                                  selected === 'Outros'
                                    ? ''
                                    : updated[index].autopump_condition_other,
                              }
                              handleFieldChange('extraction_data', updated)
                              clearReturnedField('autopump')
                            }}
                            disabled={isLocked || !isExtractionCellEditable('autopump')}
                            className={cn(
                              'epa-input h-10 w-full text-xs sm:text-sm',
                              !isExtractionCellEditable('autopump') && returnBlockedClass,
                              isReturnedField('autopump') &&
                                'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold',
                            )}
                          >
                            <option value="">Selecione...</option>
                            <option value="Limpa">Limpa</option>
                            <option value="Turva">Turva</option>
                            <option value="Oleosa">Oleosa</option>
                            <option value="Outros">Outros</option>
                          </select>
                        )
                      })()}
                    </td>
                    {!isLocked &&
                      isExtractionCellEditable('extraction_data') &&
                      (isAdmin || isExtractionRowEmpty(lockedRow || row)) && (
                        <td className="p-2 border border-slate-300 dark:border-slate-800 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveExtractionWell(index)}
                            className="h-9 w-9 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title={
                              isAdmin
                                ? 'Remover linha de poço (Admin)'
                                : 'Remover linha de poço vazia'
                            }
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
      </section>

      {/* 2. INFILTRAÇÃO/VOLUME INFILTRADO */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              2. INFILTRAÇÃO/VOLUME INFILTRADO
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Leitura de hidrômetros geral e saídas com horário de medição e pressões da bomba
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isReturnedField('infiltracao') && (
              <span className="rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 uppercase tracking-tight shadow-sm">
                🟨 CAMPO PARA CORREÇÃO
              </span>
            )}
            {!isLocked && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddInfiltrationExit}
                className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[36px]"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Adicionar Saída
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  Hidrômetro
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  <div>Manhã</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.infiltration_morning_time || ''}
                      onChange={(e) =>
                        handleFieldChange('infiltration_morning_time', e.target.value)
                      }
                      disabled={
                        isLocked ||
                        isFieldLockedByAdmin('infiltration_morning_time') ||
                        isReturnBlocked('infiltration_morning_time')
                      }
                      readOnly={isFieldLockedByAdmin('infiltration_morning_time')}
                      className={cn(
                        'h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1',
                        isFieldLockedByAdmin('infiltration_morning_time') &&
                          'bg-slate-200 text-slate-700 cursor-not-allowed',
                      )}
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/3">
                  <div>Tarde</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.infiltration_afternoon_time || ''}
                      onChange={(e) =>
                        handleFieldChange('infiltration_afternoon_time', e.target.value)
                      }
                      disabled={
                        isLocked ||
                        isFieldLockedByAdmin('infiltration_afternoon_time') ||
                        isReturnBlocked('infiltration_afternoon_time')
                      }
                      readOnly={isFieldLockedByAdmin('infiltration_afternoon_time')}
                      className={cn(
                        'h-7 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border border-slate-300 dark:border-0 py-0 px-1',
                        isFieldLockedByAdmin('infiltration_afternoon_time') &&
                          'bg-slate-200 text-slate-700 cursor-not-allowed',
                      )}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {[
                { label: 'Geral', mKey: 'geralMorning', aKey: 'geralAfternoon' },
                ...activeInfiltrationExitNumbers.map((num) => ({
                  label: `Saída ${String(num).padStart(2, '0')}`,
                  mKey: `out${num}Morning`,
                  aKey: `out${num}Afternoon`,
                })),
              ].map((row) => {
                const isMLocked = isSubFieldLockedByAdmin('infiltration_data', row.mKey)
                const isALocked = isSubFieldLockedByAdmin('infiltration_data', row.aKey)
                return (
                  <tr key={row.label} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-semibold text-slate-800 dark:text-slate-300">
                      {row.label}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      {isMLocked ? (
                        <div className="flex items-center justify-end px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                          <span>{formData.infiltration_data?.[row.mKey] || '—'}</span>
                        </div>
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={formData.infiltration_data?.[row.mKey] || ''}
                          onChange={(e) => {
                            handleFieldChange('infiltration_data', {
                              ...formData.infiltration_data,
                              [row.mKey]: e.target.value,
                            })
                            clearReturnedField('infiltracao')
                          }}
                          disabled={isLocked || isReturnBlocked('infiltration_data')}
                          placeholder="0,00"
                          className={cn(
                            'h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700',
                            isReturnBlocked('infiltration_data') && returnBlockedClass,
                            isReturnedField('infiltracao') &&
                              'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                          )}
                        />
                      )}
                    </td>
                    <td className="p-2 border border-slate-300 dark:border-slate-800">
                      {isALocked ? (
                        <div className="flex items-center justify-end px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                          <span>{formData.infiltration_data?.[row.aKey] || '—'}</span>
                        </div>
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={formData.infiltration_data?.[row.aKey] || ''}
                          onChange={(e) => {
                            handleFieldChange('infiltration_data', {
                              ...formData.infiltration_data,
                              [row.aKey]: e.target.value,
                            })
                            clearReturnedField('infiltracao')
                          }}
                          disabled={isLocked || isReturnBlocked('infiltration_data')}
                          placeholder="0,00"
                          className={cn(
                            'h-10 font-mono text-xs sm:text-sm text-right border-slate-300 dark:border-slate-700',
                            isReturnBlocked('infiltration_data') && returnBlockedClass,
                            isReturnedField('infiltracao') &&
                              'border-amber-500 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-950/40 font-semibold focus-visible:ring-amber-500',
                          )}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Linha: Pressão da Bomba (Infiltração) | Pressão da Bomba - Geral */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
          <div>
            <label className="epa-label">Pressão da Bomba (Infiltração)</label>
            {isSubFieldLockedByAdmin('infiltration_data', 'bombaInfiltracao') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                <span>{formData.infiltration_data?.bombaInfiltracao || '—'}</span>
              </div>
            ) : (
              <Input
                value={formData.infiltration_data?.bombaInfiltracao || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    bombaInfiltracao: e.target.value,
                  })
                }
                disabled={isLocked || isReturnBlocked('infiltration_data')}
                placeholder="Ex.: 3 bar / PSI"
                className={cn(
                  'mt-1 font-mono text-xs',
                  isReturnBlocked('infiltration_data') && returnBlockedClass,
                )}
              />
            )}
          </div>
          <div>
            <label className="epa-label">Pressão da Bomba - Geral</label>
            {isSubFieldLockedByAdmin('infiltration_data', 'bombaGeral') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                <span>{formData.infiltration_data?.bombaGeral || '—'}</span>
              </div>
            ) : (
              <Input
                value={formData.infiltration_data?.bombaGeral || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    bombaGeral: e.target.value,
                  })
                }
                disabled={isLocked || isReturnBlocked('infiltration_data')}
                placeholder="Ex.: 4 bar / PSI"
                className={cn(
                  'mt-1 font-mono text-xs',
                  isReturnBlocked('infiltration_data') && returnBlockedClass,
                )}
              />
            )}
          </div>
        </div>
      </section>

      {/* 3. DOSAGEM DE NUTRIENTES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            3. DOSAGEM DE NUTRIENTES
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Controle de realização da dosagem e pesagem de MAP e Ureia
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-3.5">
            <div>
              <p className="text-xs font-semibold">Realizada (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {formData.nutrient_done ? 'Sim (Realizada)' : 'Não'}
              </p>
            </div>
            <Switch
              checked={formData.nutrient_done || false}
              onCheckedChange={(c) => handleFieldChange('nutrient_done', c)}
              disabled={
                isLocked ||
                isFieldLockedByAdmin('nutrient_done') ||
                isReturnBlocked('nutrient_done')
              }
            />
          </div>
          <div>
            <label className="epa-label">Quantidade MAP (Kg)</label>
            <Input
              type="text"
              value={
                formData.nutrient_map_kg === 0 || formData.nutrient_map_kg === '0'
                  ? ''
                  : (formData.nutrient_map_kg ?? '')
              }
              onChange={(e) => handleFieldChange('nutrient_map_kg', e.target.value)}
              disabled={
                isLocked ||
                isFieldLockedByAdmin('nutrient_map_kg') ||
                isReturnBlocked('nutrient_map_kg')
              }
              readOnly={isFieldLockedByAdmin('nutrient_map_kg')}
              placeholder="Ex.: 10 ou 1.250,5"
              className={cn(
                'mt-1 font-mono text-xs sm:text-sm min-h-[42px]',
                isFieldLockedByAdmin('nutrient_map_kg') &&
                  'bg-slate-200 text-slate-700 cursor-not-allowed',
              )}
            />
          </div>
          <div>
            <label className="epa-label">Quantidade Ureia (Kg)</label>
            <Input
              type="text"
              value={
                formData.nutrient_ureia_kg === 0 || formData.nutrient_ureia_kg === '0'
                  ? ''
                  : (formData.nutrient_ureia_kg ?? '')
              }
              onChange={(e) => handleFieldChange('nutrient_ureia_kg', e.target.value)}
              disabled={
                isLocked ||
                isFieldLockedByAdmin('nutrient_ureia_kg') ||
                isReturnBlocked('nutrient_ureia_kg')
              }
              readOnly={isFieldLockedByAdmin('nutrient_ureia_kg')}
              placeholder="Ex.: 10 ou 1.250,5"
              className={cn(
                'mt-1 font-mono text-xs sm:text-sm min-h-[42px]',
                isFieldLockedByAdmin('nutrient_ureia_kg') &&
                  'bg-slate-200 text-slate-700 cursor-not-allowed',
              )}
            />
          </div>
        </div>
      </section>

      {/* 4. COMPRESSORES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              4. COMPRESSORES
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Parâmetros operacionais dos compressores e pressão da linha de ar
            </p>
          </div>
          {!isLocked && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCompressor}
              className="w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[36px]"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar Compressor
            </Button>
          )}
        </div>

        {/* Dica de rolagem horizontal quando houver vários compressores */}
        {activeCompressorIndices.length > 2 && (
          <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>
              👉 Deslize horizontalmente para visualizar e preencher todos os compressores
              adicionados
            </span>
          </p>
        )}

        {/* Tabela de Parâmetros dos Compressores */}
        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            style={{ minWidth: `${Math.max(500, 240 + activeCompressorIndices.length * 150)}px` }}
          >
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-60 min-w-[220px]">
                  PARÂMETROS
                </th>
                {activeCompressorIndices.map((c) => (
                  <th
                    key={c}
                    className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[140px]"
                  >
                    COMPRESSOR {String(c).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-800">
              {[
                { label: 'Horímetro (hr)', prefix: 'horimetro', ph: 'Ex.: 5448.81' },
                {
                  label: 'Pressão (bar)',
                  prefix: 'pressao',
                  fallbackPrefix: 'pressure',
                  ph: 'Ex.: 6 bar',
                },
                {
                  label: 'Drenagem de água (mL)',
                  prefix: 'drenagem',
                  ph: 'Ex.: 6 LTS',
                },
                {
                  label: 'Tempo Desligado',
                  prefix: 'tempoDesligado',
                  ph: 'Ex.: 0 min',
                },
                {
                  label: 'Troca do filtro de ar',
                  prefix: 'filtroAr',
                  ph: 'Ex.: OK / data',
                },
                { label: 'Nível de óleo', prefix: 'nivelOleo', ph: 'Ex.: OK' },
                {
                  label: 'Troca de óleo e filtro (a cada 1000hrs)',
                  prefix: 'trocaOleo',
                  ph: 'Ex.: 6000HR',
                },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-300">
                    {row.label}
                  </td>
                  {activeCompressorIndices.map((c) => {
                    const key = `${row.prefix}${c}`
                    const fallbackKey = row.fallbackPrefix ? `${row.fallbackPrefix}${c}` : null
                    const isLockedByAdmin =
                      isSubFieldLockedByAdmin('compressor_data', key) ||
                      (fallbackKey
                        ? isSubFieldLockedByAdmin('compressor_data', fallbackKey)
                        : false)
                    const currentVal =
                      formData.compressor_data?.[key] ||
                      (fallbackKey ? formData.compressor_data?.[fallbackKey] : '') ||
                      ''
                    return (
                      <td
                        key={c}
                        className="p-2 border border-slate-300 dark:border-slate-800 min-w-[140px]"
                      >
                        {isLockedByAdmin ? (
                          <div className="flex items-center justify-center px-2 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                            <span>{currentVal || '—'}</span>
                          </div>
                        ) : (
                          <Input
                            inputMode="decimal"
                            value={currentVal}
                            onChange={(e) =>
                              handleFieldChange('compressor_data', {
                                ...formData.compressor_data,
                                [key]: e.target.value,
                              })
                            }
                            disabled={isLocked || isReturnBlocked('compressor_data')}
                            placeholder={row.ph}
                            className={cn(
                              'h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700',
                              isReturnBlocked('compressor_data') && returnBlockedClass,
                            )}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Segunda tabela: LINHA DE AR (sincronizada automaticamente com compressores) */}
        <div className="mt-4 table-scroll-container rounded-xl border-2 border-slate-400 dark:border-slate-800 shadow-inner overflow-x-auto">
          <table
            className="w-full border-collapse text-left text-xs"
            style={{ minWidth: `${Math.max(500, 240 + activeCompressorIndices.length * 150)}px` }}
          >
            <thead>
              <tr className="bg-emerald-800 text-white dark:bg-emerald-900 text-[11px]">
                <th className="p-2.5 border border-emerald-700 font-semibold text-center w-60 min-w-[220px]">
                  LINHA DE AR
                </th>
                {activeCompressorIndices.map((c) => (
                  <th
                    key={c}
                    className="p-2.5 border border-emerald-700 font-semibold text-center min-w-[140px]"
                  >
                    COMPRESSOR {String(c).padStart(2, '0')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2.5 border border-slate-300 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-300">
                  Pressão da Linha de Ar (ex.: PSI)
                </td>
                {activeCompressorIndices.map((c) => {
                  const arKey = `linhaAr${c}`
                  const isArLocked = isSubFieldLockedByAdmin('compressor_data', arKey)
                  const currentArVal = formData.compressor_data?.[arKey] || ''
                  return (
                    <td
                      key={c}
                      className="p-2 border border-slate-300 dark:border-slate-800 min-w-[140px]"
                    >
                      {isArLocked ? (
                        <div className="flex items-center justify-center px-2 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                          <span>{currentArVal || '—'}</span>
                        </div>
                      ) : (
                        <Input
                          inputMode="decimal"
                          value={currentArVal}
                          onChange={(e) =>
                            handleFieldChange('compressor_data', {
                              ...formData.compressor_data,
                              [arKey]: e.target.value,
                            })
                          }
                          disabled={isLocked || isReturnBlocked('compressor_data')}
                          placeholder="Ex.: 85 PSI"
                          className={cn(
                            'h-10 font-mono text-xs sm:text-sm text-center border-slate-300 dark:border-slate-700',
                            isReturnBlocked('compressor_data') && returnBlockedClass,
                          )}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. REMOÇÃO DE ÓLEO */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            5. REMOÇÃO DE ÓLEO
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Caixas separadoras de água e óleo SAO 01 e SAO 02
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SAO 01 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400 border-b pb-2 dark:border-slate-800">
              Caixa Separadora (SAO 01)
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="epa-label">Volume de óleo removido (mL)</label>
                {isSubFieldLockedByAdmin('oil_removal_data', 'sao1Volume') ? (
                  <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                    <span>{formData.oil_removal_data?.sao1Volume || '—'}</span>
                  </div>
                ) : (
                  <Input
                    value={formData.oil_removal_data?.sao1Volume || ''}
                    onChange={(e) =>
                      handleFieldChange('oil_removal_data', {
                        ...formData.oil_removal_data,
                        sao1Volume: e.target.value,
                      })
                    }
                    disabled={isLocked || isReturnBlocked('oil_removal_data')}
                    placeholder="Ex.: 0"
                    className={cn(
                      'mt-1 font-mono text-xs',
                      isReturnBlocked('oil_removal_data') && returnBlockedClass,
                    )}
                  />
                )}
              </div>
              <div>
                <label className="epa-label">Data da última limpeza</label>
                {isSubFieldLockedByAdmin('oil_removal_data', 'sao1DataLimpeza') ? (
                  <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                    <span>{formData.oil_removal_data?.sao1DataLimpeza || '—'}</span>
                  </div>
                ) : (
                  <Input
                    value={formData.oil_removal_data?.sao1DataLimpeza || ''}
                    onChange={(e) =>
                      handleFieldChange('oil_removal_data', {
                        ...formData.oil_removal_data,
                        sao1DataLimpeza: applyDateMask(e.target.value),
                      })
                    }
                    disabled={isLocked || isReturnBlocked('oil_removal_data')}
                    placeholder="DD/MM/AAAA"
                    className={cn(
                      'mt-1 font-mono text-xs',
                      isReturnBlocked('oil_removal_data') && returnBlockedClass,
                    )}
                  />
                )}
              </div>
            </div>
          </div>

          {/* SAO 02 */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-400 border-b pb-2 dark:border-slate-800">
              Caixa Separadora (SAO 02)
            </h3>
            <div className="mt-3 space-y-3">
              <div>
                <label className="epa-label">Volume de óleo removido (mL)</label>
                {isSubFieldLockedByAdmin('oil_removal_data', 'sao2Volume') ? (
                  <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                    <span>{formData.oil_removal_data?.sao2Volume || '—'}</span>
                  </div>
                ) : (
                  <Input
                    value={formData.oil_removal_data?.sao2Volume || ''}
                    onChange={(e) =>
                      handleFieldChange('oil_removal_data', {
                        ...formData.oil_removal_data,
                        sao2Volume: e.target.value,
                      })
                    }
                    disabled={isLocked || isReturnBlocked('oil_removal_data')}
                    placeholder="Ex.: 0"
                    className={cn(
                      'mt-1 font-mono text-xs',
                      isReturnBlocked('oil_removal_data') && returnBlockedClass,
                    )}
                  />
                )}
              </div>
              <div>
                <label className="epa-label">Data da última limpeza</label>
                {isSubFieldLockedByAdmin('oil_removal_data', 'sao2DataLimpeza') ? (
                  <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[40px] cursor-not-allowed select-none">
                    <span>{formData.oil_removal_data?.sao2DataLimpeza || '—'}</span>
                  </div>
                ) : (
                  <Input
                    value={formData.oil_removal_data?.sao2DataLimpeza || ''}
                    onChange={(e) =>
                      handleFieldChange('oil_removal_data', {
                        ...formData.oil_removal_data,
                        sao2DataLimpeza: applyDateMask(e.target.value),
                      })
                    }
                    disabled={isLocked || isReturnBlocked('oil_removal_data')}
                    placeholder="DD/MM/AAAA"
                    className={cn(
                      'mt-1 font-mono text-xs',
                      isReturnBlocked('oil_removal_data') && returnBlockedClass,
                    )}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. RESÍDUOS SÓLIDOS E LÍQUIDOS */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            6. RESÍDUOS SÓLIDOS E LÍQUIDOS
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Contagem de tambores para retirada
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="epa-label">TAMBORES PARA RETIRADA (QNTD) - Líquido</label>
            {isFieldLockedByAdmin('waste_liquid_qty') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                <span>
                  {formData.waste_liquid_qty === 0 ||
                  formData.waste_liquid_qty === '0' ||
                  formData.waste_liquid_qty === ''
                    ? '—'
                    : formData.waste_liquid_qty}
                </span>
              </div>
            ) : (
              <Input
                type="text"
                value={
                  formData.waste_liquid_qty === 0 || formData.waste_liquid_qty === '0'
                    ? ''
                    : (formData.waste_liquid_qty ?? '')
                }
                onChange={(e) => handleFieldChange('waste_liquid_qty', e.target.value)}
                disabled={isLocked || isReturnBlocked('waste_liquid_qty')}
                placeholder="Ex.: 02 ou 2 tambores"
                className={cn(
                  'mt-1 font-mono text-xs sm:text-sm min-h-[42px]',
                  isReturnBlocked('waste_liquid_qty') && returnBlockedClass,
                )}
              />
            )}
          </div>
          <div>
            <label className="epa-label">TAMBORES PARA RETIRADA (QNTD) - Sólido</label>
            {isFieldLockedByAdmin('waste_solid_qty') ? (
              <div className="mt-1 flex items-center px-3 py-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[42px] cursor-not-allowed select-none">
                <span>
                  {formData.waste_solid_qty === 0 ||
                  formData.waste_solid_qty === '0' ||
                  formData.waste_solid_qty === ''
                    ? '—'
                    : formData.waste_solid_qty}
                </span>
              </div>
            ) : (
              <Input
                type="text"
                value={
                  formData.waste_solid_qty === 0 || formData.waste_solid_qty === '0'
                    ? ''
                    : (formData.waste_solid_qty ?? '')
                }
                onChange={(e) => handleFieldChange('waste_solid_qty', e.target.value)}
                disabled={isLocked || isReturnBlocked('waste_solid_qty')}
                placeholder="Ex.: 01 ou 1 bombona"
                className={cn(
                  'mt-1 font-mono text-xs sm:text-sm min-h-[42px]',
                  isReturnBlocked('waste_solid_qty') && returnBlockedClass,
                )}
              />
            )}
          </div>
        </div>
      </section>

      {/* 7. CONTROLES AMBIENTAIS E 5S */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            7. CONTROLES AMBIENTAIS E 5S
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Verificação do programa 5S e checklist mensal
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold">5S (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {formData.env_5s_check ? 'Sim (Conforme)' : 'Não'}
              </p>
            </div>
            {isFieldLockedByAdmin('env_5s_check') ? (
              <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
                <span>
                  {formData.env_5s_check ? 'Definido Sim (Admin)' : 'Definido Não (Admin)'}
                </span>
              </div>
            ) : (
              <Switch
                checked={formData.env_5s_check || false}
                onCheckedChange={(c) => handleFieldChange('env_5s_check', c)}
                disabled={isLocked || isReturnBlocked('env_5s_check')}
              />
            )}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold">CHECKLIST MENSAL (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {formData.env_checklist_monthly ? 'Sim (Conforme)' : 'Não'}
              </p>
            </div>
            {isFieldLockedByAdmin('env_checklist_monthly') ? (
              <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 cursor-not-allowed select-none">
                <span>
                  {formData.env_checklist_monthly ? 'Definido Sim (Admin)' : 'Definido Não (Admin)'}
                </span>
              </div>
            ) : (
              <Switch
                checked={formData.env_checklist_monthly || false}
                onCheckedChange={(c) => handleFieldChange('env_checklist_monthly', c)}
                disabled={isLocked || isReturnBlocked('env_checklist_monthly')}
              />
            )}
          </div>
        </div>
      </section>

      {/* 8. OBSERVAÇÕES E MANUTENÇÕES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            8. OBSERVAÇÕES E MANUTENÇÕES
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Registro livre de ocorrências, serviços de manutenção e anotações operacionais
          </p>
        </div>
        {isFieldLockedByAdmin('observations') ? (
          <div className="mt-4 p-4 rounded-xl bg-slate-100 text-slate-800 text-xs font-sans border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 min-h-[120px] cursor-not-allowed select-none whitespace-pre-wrap">
            {formData.observations || '—'}
          </div>
        ) : (
          <Textarea
            value={formData.observations || ''}
            onChange={(e) => handleFieldChange('observations', e.target.value)}
            disabled={isLocked || isReturnBlocked('observations')}
            placeholder="Ex.: * Foi realizado a manutenção do PR-49."
            className={cn(
              'mt-4 min-h-[120px]',
              isReturnBlocked('observations') && returnBlockedClass,
            )}
          />
        )}
      </section>

      {/* 9. BOTÕES FINAIS DE AÇÃO E VALIDAÇÃO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 epa-card p-6">
        <div>
          <p className="text-sm font-semibold">Finalização da Planilha</p>
          <p className="text-xs text-slate-500">
            {isLocked
              ? formData.status === 'submitted'
                ? 'Esta planilha foi enviada para aprovação e está bloqueada para edição. Aguarde a liberação do Administrador.'
                : 'Esta planilha já foi aprovada e está bloqueada para modificações.'
              : 'Verifique todos os dados antes de salvar ou enviar para aprovação.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onBack} className="min-h-[44px] flex-1 sm:flex-none">
            Voltar
          </Button>
          {!isLocked && !formData.archived && (
            <>
              <Button
                variant="outline"
                onClick={() => saveSheet('draft')}
                disabled={isSaving}
                className="min-h-[44px] flex-1 sm:flex-none"
              >
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Salvar Rascunho
              </Button>
              <Button
                onClick={() => saveSheet('submitted')}
                disabled={isSaving}
                className="min-h-[44px] bg-blue-600 text-white hover:bg-blue-700 flex-1 sm:flex-none text-xs font-semibold shadow-sm"
              >
                <Send className="mr-1.5 h-4 w-4" />
                {isAdmin ? 'Enviar para o Técnico' : 'Enviar para aprovação'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modal Devolução */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Devolver Planilha de Campo</h3>
              <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Informe os pontos ou medições que precisam de correção pelo técnico.
            </p>

            <div className="mt-4 space-y-2">
              <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                Campos com necessidade de correção:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {FIELD_SHEET_RETURN_OPTIONS.map((field) => {
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
                      <span>{field.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="mt-4 min-h-[110px] dark:border-slate-800 dark:bg-slate-950 text-xs"
              placeholder="Ex.: Conferir a medição de vazão da tarde no poço PB-128 e a condição do autopump."
            />
            <Button
              onClick={() => handleAdminStatusChange('returned')}
              disabled={!reviewNotes.trim() || isSaving}
              className="mt-4 w-full bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirmar Devolução
            </Button>
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

export function printFieldSheet(sheet: OfflineFieldSheetItem) {
  const win = window.open('', '_blank')
  if (!win) {
    window.print()
    return
  }

  const extData = sheet.extraction_data || []
  let fallbackMorning = ''
  let fallbackAfternoon = ''
  if (Array.isArray(extData)) {
    for (const r of extData) {
      if (!fallbackMorning && r.morning_time) fallbackMorning = r.morning_time
      if (!fallbackAfternoon && r.afternoon_time) fallbackAfternoon = r.afternoon_time
    }
  }

  const morningTime = sheet.morning_time || fallbackMorning || ''
  const afternoonTime = sheet.afternoon_time || fallbackAfternoon || ''
  const infMorningTime = sheet.infiltration_morning_time || ''
  const infAfternoonTime = sheet.infiltration_afternoon_time || ''

  let extractionRows = ''
  if (Array.isArray(extData) && extData.length > 0) {
    extData.forEach((r) => {
      let finalAutopump = r.autopump || ''
      if (!finalAutopump && r.autopump_condition) {
        finalAutopump =
          r.autopump_condition === 'Outros' && r.autopump_condition_other
            ? `Outros — ${r.autopump_condition_other}`
            : r.autopump_condition
      }

      extractionRows += `<tr>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${finalAutopump}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #777;padding:8px;text-align:center;color:#666;">Nenhum poço registrado</td></tr>`
  }

  const infData = sheet.infiltration_data || {}
  const compData = sheet.compressor_data || {}
  const oilData = sheet.oil_removal_data || {}

  const compressorIndices = getCompressorIndices(compData)
  const infiltrationExitNumbers = getInfiltrationExitNumbers(infData)

  let dynamicInfExitRows = ''
  for (const n of infiltrationExitNumbers) {
    const padStr = String(n).padStart(2, '0')
    const mVal = infData[`out${n}Morning`] || ''
    const aVal = infData[`out${n}Afternoon`] || ''
    dynamicInfExitRows += `<tr>
      <td class="label-col">Saída ${padStr}</td>
      <td colspan="2" style="text-align:right;">${mVal}</td>
      <td colspan="2" style="text-align:right;">${aVal}</td>
    </tr>`
  }

  let compHeaderCells = ''
  let linhaArHeaderCells = ''
  for (const c of compressorIndices) {
    const pad = String(c).padStart(2, '0')
    compHeaderCells += `<th style="text-align:center;">COMPRESSOR ${pad}</th>`
    linhaArHeaderCells += `<th style="text-align:center; background-color:#145a32;">COMPRESSOR ${pad}</th>`
  }

  const compParamSpecs = [
    { label: 'Horímetro (hr)', prefix: 'horimetro' },
    { label: 'Pressão (bar)', prefix: 'pressao', fallbackPrefix: 'pressure' },
    { label: 'Drenagem de água (mL)', prefix: 'drenagem' },
    { label: 'Tempo Desligado', prefix: 'tempoDesligado' },
    { label: 'Troca do filtro de ar', prefix: 'filtroAr' },
    { label: 'Nível de óleo', prefix: 'nivelOleo' },
    { label: 'Troca de óleo e filtro (a cada 1000hrs)', prefix: 'trocaOleo' },
  ]

  let compParamRows = ''
  for (const spec of compParamSpecs) {
    let cells = ''
    for (const c of compressorIndices) {
      const val =
        compData[`${spec.prefix}${c}`] ||
        (spec.fallbackPrefix ? compData[`${spec.fallbackPrefix}${c}`] : '') ||
        ''
      cells += `<td style="text-align:center;">${val}</td>`
    }
    compParamRows += `<tr>
      <td class="label-col">${spec.label}</td>
      ${cells}
    </tr>`
  }

  let linhaArCells = ''
  for (const c of compressorIndices) {
    const val = compData[`linhaAr${c}`] || ''
    linhaArCells += `<td style="text-align:center; font-weight:bold;">${val}</td>`
  }

  const tableColSpan = Math.max(5, 1 + compressorIndices.length)

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Planilha de Campo EPA — ${sheet.date}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    body { font-family: Calibri, Arial, sans-serif; font-size: 11px; margin: 0; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #000; }
    th { background-color: #0b5345; color: #ffffff; border: 1px solid #333; padding: 5px; font-weight: bold; text-align: center; }
    td { border: 1px solid #333; padding: 4px 6px; }
    .header-title { background-color: #0b5345; color: #ffffff; font-size: 14px; font-weight: bold; text-align: center; border: 1.5px solid #000; }
    .section-hdr { background-color: #d1e7dd; color: #0b5345; font-weight: bold; font-size: 11px; border: 1.5px solid #000; }
    .label-col { background-color: #f2f7f5; font-weight: bold; border: 1px solid #333; }
    .no-print-bar {
      background: #1e293b; color: #fff; padding: 10px 16px; display: flex;
      align-items: center; justify-content: space-between; font-size: 13px;
    }
    .no-print-bar button {
      background: #059669; color: #fff; border: none; padding: 8px 18px;
      font-size: 13px; font-weight: 600; border-radius: 6px; cursor: pointer;
    }
    .no-print-bar button:hover { background: #047857; }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Grupo EPA — Visualização e Impressão de Planilha de Campo</strong></div>
    <div><button onclick="window.print()">Imprimir / Salvar PDF</button></div>
  </div>

  <div style="padding: 10px;">
    <table>
      <tr>
        <td colspan="${tableColSpan}" class="header-title" style="padding: 10px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>
      <tr>
        <td class="label-col" style="width: 20%;">TÉCNICO / RESPONSÁVEL:</td>
        <td style="width: 25%; font-weight: bold;">${sheet.operatorName || ''}</td>
        <td class="label-col" style="width: 15%;">DATA:</td>
        <td colspan="${tableColSpan - 3}" style="width: 40%; font-weight: bold;">${sheet.date || ''}</td>
      </tr>
      <tr>
        <td class="label-col">ÁREA:</td>
        <td>${sheet.area || ''}</td>
        <td class="label-col">CLIMA:</td>
        <td colspan="${tableColSpan - 3}">${sheet.weather || 'Ensolarado'}</td>
      </tr>
      <tr>
        <td class="label-col">PLUVIÔMETRO:</td>
        <td colspan="${tableColSpan - 1}">${sheet.pluviometer || 0} mm</td>
      </tr>

      <!-- 1. EXTRAÇÃO/VOLUME BOMBEADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 20%;">Poço de Remediação</th>
        <th style="width: 20%;">Hidrômetro (Manhã) ${morningTime ? `(${morningTime})` : ''}</th>
        <th style="width: 20%;">Hidrômetro (Tarde) ${afternoonTime ? `(${afternoonTime})` : ''}</th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th colspan="${tableColSpan - 4}" style="width: 22%;">Saída Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">Manhã ${infMorningTime ? `(${infMorningTime})` : ''}</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Tarde ${infAfternoonTime ? `(${infAfternoonTime})` : ''}</th>
      </tr>
      <tr>
        <td class="label-col">Geral</td>
        <td colspan="2" style="text-align:right;">${infData.geralMorning || ''}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:right;">${infData.geralAfternoon || ''}</td>
      </tr>
      ${dynamicInfExitRows}
      <tr>
        <td class="label-col">Pressão da Bomba (Infiltração)</td>
        <td colspan="2" style="text-align:center;">${infData.bombaInfiltracao || ''}</td>
        <td class="label-col">Pressão da Bomba - Geral</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center;">${infData.bombaGeral || ''}</td>
      </tr>

      <!-- 3. DOSAGEM DE NUTRIENTES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${sheet.nutrient_done ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.nutrient_map_kg || 0}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.nutrient_ureia_kg || 0}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">4. COMPRESSORES</td>
      </tr>
      <tr>
        <th style="width: 35%;">PARÂMETROS</th>
        ${compHeaderCells}
      </tr>
      ${compParamRows}
      <tr>
        <th style="width: 35%; background-color:#145a32;">LINHA DE AR</th>
        ${linhaArHeaderCells}
      </tr>
      <tr>
        <td class="label-col">Pressão da Linha de Ar</td>
        ${linhaArCells}
      </tr>

      <!-- 5. REMOÇÃO DE ÓLEO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
      </tr>
      <tr>
        <td colspan="2" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Líquido</td>
        <td colspan="${tableColSpan - 2}" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Sólido</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_liquid_qty || '—'}</td>
        <td colspan="${tableColSpan - 2}" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_solid_qty || '—'}</td>
      </tr>

      <!-- 7. CONTROLES AMBIENTAIS E 5S -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${sheet.env_5s_check ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.env_checklist_monthly ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 6px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="padding: 8px; min-height: 40px;">${sheet.observations || '—'}</td>
      </tr>
    </table>
  </div>
</body>
</html>`

  win.document.open()
  win.document.write(printHtml)
  win.document.close()
}

/**
 * Generates local XML-Excel spreadsheet matching official EPA header and columns
 */
function generateLocalExcelExport(sheet: OfflineFieldSheetItem) {
  const morningTime =
    sheet.morning_time || sheet.extraction_data?.find((r) => r.morning_time)?.morning_time || ''
  const afternoonTime =
    sheet.afternoon_time ||
    sheet.extraction_data?.find((r) => r.afternoon_time)?.afternoon_time ||
    ''

  const infMorningTime = sheet.infiltration_morning_time || ''
  const infAfternoonTime = sheet.infiltration_afternoon_time || ''

  const infData = sheet.infiltration_data || {}
  const compData = sheet.compressor_data || {}
  const oilData = sheet.oil_removal_data || {}

  let extractionRows = ''
  if (sheet.extraction_data && sheet.extraction_data.length > 0) {
    sheet.extraction_data.forEach((r) => {
      let finalAutopump = r.autopump || ''
      if (!finalAutopump && r.autopump_condition) {
        finalAutopump =
          r.autopump_condition === 'Outros' && r.autopump_condition_other
            ? `Outros — ${r.autopump_condition_other}`
            : r.autopump_condition
      }

      extractionRows += `<tr>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${finalAutopump}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #777;padding:8px;text-align:center;color:#666;">Nenhum poço registrado</td></tr>`
  }

  // Determinação dinâmica de compressores e saídas de infiltração
  const compressorIndices = getCompressorIndices(compData)
  const infiltrationExitNumbers = getInfiltrationExitNumbers(infData)

  let dynamicInfExitRows = ''
  for (const n of infiltrationExitNumbers) {
    const padStr = String(n).padStart(2, '0')
    const mVal = infData[`out${n}Morning`] || ''
    const aVal = infData[`out${n}Afternoon`] || ''
    dynamicInfExitRows += `<tr>
      <td class="label-col">Saída ${padStr}</td>
      <td colspan="2" style="text-align:right;">${mVal}</td>
      <td colspan="2" style="text-align:right;">${aVal}</td>
    </tr>`
  }

  let compHeaderCells = ''
  let linhaArHeaderCells = ''
  for (const c of compressorIndices) {
    const pad = String(c).padStart(2, '0')
    compHeaderCells += `<th style="text-align:center;">COMPRESSOR ${pad}</th>`
    linhaArHeaderCells += `<th style="text-align:center; background-color:#145a32;">COMPRESSOR ${pad}</th>`
  }

  const compParamSpecs = [
    { label: 'Horímetro (hr)', prefix: 'horimetro' },
    { label: 'Pressão (bar)', prefix: 'pressao', fallbackPrefix: 'pressure' },
    { label: 'Drenagem de água (mL)', prefix: 'drenagem' },
    { label: 'Tempo Desligado', prefix: 'tempoDesligado' },
    { label: 'Troca do filtro de ar', prefix: 'filtroAr' },
    { label: 'Nível de óleo', prefix: 'nivelOleo' },
    { label: 'Troca de óleo e filtro (a cada 1000hrs)', prefix: 'trocaOleo' },
  ]

  let compParamRows = ''
  for (const spec of compParamSpecs) {
    let cells = ''
    for (const c of compressorIndices) {
      const val =
        compData[`${spec.prefix}${c}`] ||
        (spec.fallbackPrefix ? compData[`${spec.fallbackPrefix}${c}`] : '') ||
        ''
      cells += `<td style="text-align:center;">${val}</td>`
    }
    compParamRows += `<tr>
      <td class="label-col">${spec.label}</td>
      ${cells}
    </tr>`
  }

  let linhaArCells = ''
  for (const c of compressorIndices) {
    const val = compData[`linhaAr${c}`] || ''
    linhaArCells += `<td style="text-align:center; font-weight:bold;">${val}</td>`
  }

  const tableColSpan = Math.max(5, 1 + compressorIndices.length)

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <style>
      table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11px; }
      th { background-color: #0b5345; color: #ffffff; border: 1px solid #555; padding: 6px; font-weight: bold; }
      td { border: 1px solid #777; padding: 5px 6px; }
      .header-title { background-color: #0b5345; color: #ffffff; font-size: 13px; font-weight: bold; text-align: center; }
      .section-hdr { background-color: #d1e7dd; color: #0b5345; font-weight: bold; font-size: 11px; border: 1px solid #777; }
      .label-col { background-color: #f2f7f5; font-weight: bold; border: 1px solid #777; }
    </style>
  </head>
  <body>
    <table style="width:100%;">
      <!-- CABEÇALHO OFICIAL -->
      <tr>
        <td colspan="${tableColSpan}" class="header-title" style="padding: 12px; font-size: 14px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>

      <!-- CABEÇALHO DE METADADOS -->
      <tr>
        <td class="label-col" style="width: 20%;">TÉCNICO / RESPONSÁVEL:</td>
        <td style="width: 25%; font-weight: bold;">${sheet.operatorName || ''}</td>
        <td class="label-col" style="width: 15%;">DATA:</td>
        <td colspan="${tableColSpan - 3}" style="width: 40%; font-weight: bold;">${sheet.date || ''}</td>
      </tr>
      <tr>
        <td class="label-col">ÁREA:</td>
        <td>${sheet.area || ''}</td>
        <td class="label-col">CLIMA:</td>
        <td colspan="${tableColSpan - 3}">${sheet.weather || 'Ensolarado'}</td>
      </tr>
      <tr>
        <td class="label-col">PLUVIÔMETRO:</td>
        <td colspan="${tableColSpan - 1}">${sheet.pluviometer || 0} mm</td>
      </tr>

      <!-- 1. EXTRAÇÃO/VOLUME BOMBEADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 20%;">Poço de Remediação</th>
        <th style="width: 20%;">
          Hidrômetro (Manhã)<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${morningTime || '—'}</span>
        </th>
        <th style="width: 20%;">
          Hidrômetro (Tarde)<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${afternoonTime || '—'}</span>
        </th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th colspan="${tableColSpan - 4}" style="width: 22%;">Saída Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">
          Manhã<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${infMorningTime || '—'}</span>
        </th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">
          Tarde<br>
          <span style="font-size: 9px; font-weight: normal; color: #111827;">Hora: ${infAfternoonTime || '—'}</span>
        </th>
      </tr>
      <tr>
        <td class="label-col">Geral</td>
        <td colspan="2" style="text-align:right;">${infData.geralMorning || ''}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:right;">${infData.geralAfternoon || ''}</td>
      </tr>
      ${dynamicInfExitRows}
      <tr>
        <td class="label-col">Pressão da Bomba (Infiltração)</td>
        <td colspan="2" style="text-align:center;">${infData.bombaInfiltracao || ''}</td>
        <td class="label-col">Pressão da Bomba - Geral</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center;">${infData.bombaGeral || ''}</td>
      </tr>

      <!-- 3. DOSAGEM DE NUTRIENTES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="${tableColSpan - 3}" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${sheet.nutrient_done ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.nutrient_map_kg || 0}</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.nutrient_ureia_kg || 0}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">4. COMPRESSORES</td>
      </tr>
      <tr>
        <th style="width: 35%;">PARÂMETROS</th>
        ${compHeaderCells}
      </tr>
      ${compParamRows}
      <tr>
        <th style="width: 35%; background-color:#145a32;">LINHA DE AR</th>
        ${linhaArHeaderCells}
      </tr>
      <tr>
        <td class="label-col">Pressão da Linha de Ar</td>
        ${linhaArCells}
      </tr>

      <!-- 5. REMOÇÃO DE ÓLEO -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td colspan="${Math.max(1, tableColSpan - 4)}" style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
      </tr>
      <tr>
        <td colspan="2" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Líquido</td>
        <td colspan="${tableColSpan - 2}" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Sólido</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_liquid_qty || '—'}</td>
        <td colspan="${tableColSpan - 2}" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_solid_qty || '—'}</td>
      </tr>

      <!-- 7. CONTROLES AMBIENTAIS E 5S -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${sheet.env_5s_check ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="${tableColSpan - 3}" style="text-align:center; font-weight:bold;">${sheet.env_checklist_monthly ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="${tableColSpan}" class="section-hdr" style="padding: 7px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="${tableColSpan}" style="padding: 10px; min-height: 50px;">${sheet.observations || '—'}</td>
      </tr>
    </table>
  </body>
  </html>`

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Planilha-Campo-EPA-${sheet.date}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
