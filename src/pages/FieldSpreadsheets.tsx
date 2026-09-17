import { useMemo, useState, useEffect } from 'react'
import {
  isValidDeletionJustification,
  INVALID_JUSTIFICATION_MESSAGE,
} from '@/lib/justificationValidator'
import {
  AlertCircle,
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useSync, SYNC_BROADCAST_EVENT } from '@/context/SyncContext'
import {
  offlineStorage,
  OfflineFieldSheetItem,
  OfflineProjectItem,
} from '@/services/offlineStorage'
import { authHeaders, exportUrl, updateFieldStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { fieldSheets as mockFieldSheets, type Status } from '@/data/epa'

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

  const loadSheets = async () => {
    setLoading(true)
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

      let localSheets = await offlineStorage.getAllFieldSheets()

      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const records = await pb.collection('field_spreadsheets').getFullList({
            sort: '-date',
            expand: 'project,operator,deleted_by',
          })

          for (const rec of records) {
            const existing = localSheets.find((l) => l.id === rec.id)
            if (!existing || existing.syncStatus === 'synced') {
              const proj = rec.expand?.project as any
              const op = rec.expand?.operator as any

              const rawExt = ((rec.extraction_data as any) || []) as any[]
              const fallbackMorning = rawExt.find((r) => r.morning_time)?.morning_time || ''
              const fallbackAfternoon = rawExt.find((r) => r.afternoon_time)?.afternoon_time || ''

              const item: OfflineFieldSheetItem = {
                id: rec.id,
                projectId: rec.project,
                projectName: proj?.name || 'Recuperação Ambiental Lote A',
                clientName: proj?.client || undefined,
                contractCode: proj?.contract || proj?.code || undefined,
                date: rec.date ? rec.date.slice(0, 10) : '2025-05-28',
                area: rec.area || 'Oficina Central',
                operator: rec.operator,
                operatorName: op?.name || 'Carlos Oliveira',
                weather: rec.weather || 'Sol',
                pluviometer: rec.pluviometer || 0,
                morning_time: rec.morning_time || fallbackMorning,
                afternoon_time: rec.afternoon_time || fallbackAfternoon,
                infiltration_morning_time: (rec as any).infiltration_morning_time || '',
                infiltration_afternoon_time: (rec as any).infiltration_afternoon_time || '',
                extraction_data: (rec.extraction_data as any) || [],
                infiltration_data: (rec.infiltration_data as any) || {},
                nutrient_done: rec.nutrient_done || false,
                nutrient_map_kg: rec.nutrient_map_kg || 0,
                nutrient_ureia_kg: rec.nutrient_ureia_kg || 0,
                compressor_data: (rec.compressor_data as any) || {},
                oil_removal_data: (rec.oil_removal_data as any) || {},
                waste_liquid_qty: rec.waste_liquid_qty || 0,
                waste_solid_qty: rec.waste_solid_qty || 0,
                env_5s_check: rec.env_5s_check || false,
                env_checklist_monthly: rec.env_checklist_monthly || false,
                observations: rec.observations || '',
                status: rec.status,
                reviewNotes: rec.review_notes || '',
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
      }

      if (localSheets.length === 0) {
        for (const m of mockFieldSheets) {
          const item: OfflineFieldSheetItem = {
            id: m.id,
            projectId: m.projectId,
            projectName: m.project,
            clientName:
              m.projectId === 'u6c77idn7hfi13c'
                ? 'Saneamento Industrial do Maranhão'
                : 'Petrobras — Refinaria Sul',
            contractCode: m.projectId === 'u6c77idn7hfi13c' ? 'CT-2025-003' : 'CT-EPA-2025-017',
            date: '2025-05-28',
            area: m.area,
            operator: user?.id || 'cfpekk93zx4j1pr',
            operatorName: m.operator,
            weather: 'Sol',
            pluviometer: 0,
            morning_time: '',
            afternoon_time: '',
            extraction_data: [
              { well: 'PB-127', morning: '12540', afternoon: '12612', pump: '18', autopump: '72' },
              { well: 'PB-128', morning: '9860', afternoon: '9918', pump: '20', autopump: '58' },
            ],
            infiltration_data: {
              geralMorning: '830',
              geralAfternoon: '910',
              out1Morning: '210',
              out1Afternoon: '235',
            },
            nutrient_done: true,
            nutrient_map_kg: m.map,
            nutrient_ureia_kg: m.urea,
            compressor_data: {
              hydro1: '2.481',
              pressure1: '7,2 bar',
              hydro2: '1.938',
              pressure2: '7,0 bar',
              oil1: 'OK',
              oil2: 'OK',
            },
            oil_removal_data: {
              sao1Volume: '2,5',
              sao1Date: '2025-05-28',
              sao2Volume: '1,2',
              sao2Date: '2025-05-28',
            },
            waste_liquid_qty: m.liquidWaste,
            waste_solid_qty: 1.0,
            env_5s_check: m.environment,
            env_checklist_monthly: m.environment,
            observations: 'Operação dentro dos parâmetros previstos.',
            status: m.status,
            syncStatus: 'synced',
            lastModified: Date.now(),
            archived: false,
          }
          await offlineStorage.saveFieldSheet(item)
        }
        localSheets = await offlineStorage.getAllFieldSheets()
      }

      localSheets.sort((a, b) => b.date.localeCompare(a.date))
      setItems(localSheets)
    } catch (err) {
      console.error('Error loading field sheets:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSheets()

    const handleSyncComplete = () => {
      loadSheets()
    }
    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
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
    const matchesQuery = `${s.projectName} ${s.area} ${s.date} ${s.deletedReason || ''}`
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

      // Save soft delete locally
      await offlineStorage.saveFieldSheet(updatedItem)

      // Sync to PocketBase backend if online
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          await pb.collection('field_spreadsheets').update(sheetToDelete.id, {
            deleted: true,
            deleted_reason: trimmedReason,
            deleted_by: user?.id || null,
            deleted_at: nowIso,
          })
          updatedItem.syncStatus = 'synced'
          await offlineStorage.saveFieldSheet(updatedItem)
        } catch (pbErr: any) {
          console.warn('Backend soft delete error (saved locally for sync):', pbErr)
        }
      }

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
        title: 'Erro ao excluir planilha',
        description: err.message || 'Ocorreu um erro ao excluir a planilha.',
        variant: 'destructive',
      })
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

    try {
      const localProjects = await offlineStorage.getAllProjects()
      const activeProj =
        localProjects.find((p) => !p.deleted && !p.archived && p.status === 'active') ||
        localProjects[0]
      if (activeProj) {
        initialProjectId = activeProj.id
        initialProjectName = activeProj.name
        initialClientName = activeProj.client || ''
        initialContractCode = activeProj.contract || activeProj.code || ''
      }
    } catch (e) {
      console.warn('Could not read cached projects for new field spreadsheet:', e)
    }

    const newSheet: OfflineFieldSheetItem = {
      id: 'field_' + Date.now(),
      projectId: initialProjectId,
      projectName: initialProjectName,
      clientName: initialClientName,
      contractCode: initialContractCode,
      date: new Date().toISOString().slice(0, 10),
      area: 'Oficina Central',
      operator: user?.id || 'cfpekk93zx4j1pr',
      operatorName: user?.name || 'Carlos Oliveira',
      weather: 'Sol',
      pluviometer: 0,
      morning_time: '',
      afternoon_time: '',
      infiltration_morning_time: '',
      infiltration_afternoon_time: '',
      extraction_data: [
        { well: 'PR-01', morning: '', afternoon: '', pump: '', autopump: '' },
        { well: 'PR-09', morning: '', afternoon: '', pump: '', autopump: '' },
        { well: 'PR-10', morning: '', afternoon: '', pump: '', autopump: '' },
      ],
      infiltration_data: {
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
      },
      nutrient_done: false,
      nutrient_map_kg: 0,
      nutrient_ureia_kg: 0,
      compressor_data: {
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
      },
      oil_removal_data: {
        sao1Volume: '',
        sao1DataLimpeza: '',
        sao2Volume: '',
        sao2DataLimpeza: '',
      },
      waste_liquid_qty: 0,
      waste_solid_qty: 0,
      env_5s_check: false,
      env_checklist_monthly: false,
      observations: '',
      status: 'draft',
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
              const totalNutrients = (sheet.nutrient_map_kg || 0) + (sheet.nutrient_ureia_kg || 0)
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
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={sheet.status} />
                      {sheet.syncStatus === 'pending_create' && (
                        <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Offline
                        </span>
                      )}
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
                  <p className="mt-4 text-sm font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {sheet.projectName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {sheet.area} · {sheet.date}
                  </p>
                  <div className="mt-4 grid grid-cols-3 divide-x border-y py-3 text-center dark:divide-slate-800 dark:border-slate-800">
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {sheet.extraction_data?.length || 0}
                      </p>
                      <p className="text-[9px] text-slate-400">Poços</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{totalNutrients} kg</p>
                      <p className="text-[9px] text-slate-400">Nutrientes</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">
                        {sheet.waste_liquid_qty || 0} L
                      </p>
                      <p className="text-[9px] text-slate-400">Resíduos</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Por {sheet.operatorName || 'Operador'}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {sheet.deleted
                        ? 'Ver Arquivada →'
                        : sheet.archived
                          ? 'Visualizar arquivada →'
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
                  Excluir Planilha de Campo
                </h3>
                <p className="text-xs text-slate-500">
                  Exclusão com método de segurança e auditoria
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Você está prestes a excluir a planilha de{' '}
              <b className="text-slate-900 dark:text-white">
                {deleteModalSheet.date} — {deleteModalSheet.projectName} ({deleteModalSheet.area})
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
                disabled={isDeleting || !deleteReason.trim()}
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
  const [availableWells, setAvailableWells] = useState<
    Array<{ id: string; identification: string }>
  >([])
  const [loadingWells, setLoadingWells] = useState(false)
  const [projectList, setProjectList] = useState<OfflineProjectItem[]>([])

  const { user, setHasUnsavedChanges } = useAuth()
  const { isOnline, syncNow } = useSync()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isTechnician = user?.role === 'technician'
  const isDeleted = Boolean(formData.deleted)
  const isLocked = (formData.status === 'approved' && !isAdmin) || isDeleted

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

  // Load project wells from PocketBase (or fallback cache)
  useEffect(() => {
    let isMounted = true
    const fetchWells = async () => {
      setLoadingWells(true)
      try {
        let list: Array<{ id: string; identification: string }> = []
        if (formData.projectId) {
          try {
            const records = await pb.collection('wells').getFullList({
              filter: `project = "${formData.projectId}" && active = true`,
              sort: 'identification',
            })
            list = records.map((w: any) => ({ id: w.id, identification: w.identification }))
          } catch (pbErr) {
            console.warn('Could not fetch wells with project filter, trying general list:', pbErr)
            try {
              const records = await pb.collection('wells').getFullList({
                filter: 'active = true',
                sort: 'identification',
              })
              list = records.map((w: any) => ({ id: w.id, identification: w.identification }))
            } catch (fallbackErr) {
              console.warn('Fallback wells fetch failed:', fallbackErr)
            }
          }
        }
        if (isMounted) {
          setAvailableWells(list)
        }
      } catch (e) {
        console.error('Error fetching wells:', e)
      } finally {
        if (isMounted) {
          setLoadingWells(false)
        }
      }
    }

    fetchWells()
    return () => {
      isMounted = false
    }
  }, [formData.projectId])

  const handleFieldChange = (field: keyof OfflineFieldSheetItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  // Extraction wells handlers
  const handleAddExtractionWell = () => {
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

  const handleRemoveExtractionWell = (index: number) => {
    const updated = [...(formData.extraction_data || [])]
    updated.splice(index, 1)
    handleFieldChange('extraction_data', updated)
    toast({ title: 'Poço removido', description: 'Linha excluída da extração.' })
  }

  const handleExtractionCellChange = (index: number, col: string, val: string) => {
    const updated = [...(formData.extraction_data || [])]
    updated[index] = { ...updated[index], [col]: val }
    handleFieldChange('extraction_data', updated)
  }

  // Save logic
  const saveSheet = async (targetStatus?: Status) => {
    setIsSaving(true)
    const statusToSave = targetStatus || formData.status
    const updatedItem: OfflineFieldSheetItem = {
      ...formData,
      status: statusToSave,
      syncStatus: isOnline ? 'pending_update' : isNew ? 'pending_create' : 'pending_update',
      lastModified: Date.now(),
    }

    try {
      await offlineStorage.saveFieldSheet(updatedItem)
      setFormData(updatedItem)
      setHasUnsavedChanges(false)

      if (isOnline) {
        await syncNow()
      }

      toast({
        title:
          targetStatus === 'submitted'
            ? 'Planilha enviada para aprovação'
            : 'Planilha salva com sucesso',
        description:
          targetStatus === 'submitted'
            ? 'A planilha foi enviada para validação e aprovação do Administrador.'
            : isOnline
              ? 'Dados sincronizados com o servidor.'
              : 'Salvo localmente no dispositivo (IndexedDB).',
      })
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
      const updatedItem: OfflineFieldSheetItem = {
        ...formData,
        status: nextStatus,
        reviewNotes: nextStatus === 'returned' ? reviewNotes : '',
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      await offlineStorage.saveFieldSheet(updatedItem)
      setFormData(updatedItem)
      setReviewOpen(false)
      setHasUnsavedChanges(false)

      if (isOnline) {
        try {
          await updateFieldStatus(formData.id, nextStatus, reviewNotes)
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
            : 'O operador foi notificado para os ajustes.',
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

  const nutrientTotal = useMemo(
    () => Number(formData.nutrient_map_kg || 0) + Number(formData.nutrient_ureia_kg || 0),
    [formData.nutrient_map_kg, formData.nutrient_ureia_kg],
  )

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
              Planilha de Campo · {formData.date}
            </h2>
            <StatusBadge status={formData.status} />
            {isDeleted && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950 dark:text-red-300">
                Item Excluído (Arquivado para auditoria)
              </span>
            )}
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

          {canExportExcel && (
            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="min-h-[44px] text-xs font-semibold dark:border-slate-800"
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
                Enviar para aprovação
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

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="epa-label">OPERADOR</label>
            <Input
              value={formData.operatorName || ''}
              onChange={(e) => handleFieldChange('operatorName', e.target.value)}
              disabled={isLocked}
              placeholder="Ex.: Julio Cesar"
              className="mt-1"
            />
          </div>
          <div>
            <label className="epa-label">DATA</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              disabled={isLocked}
              className="mt-1"
            />
          </div>
          <div>
            <label className="epa-label">ÁREA</label>
            <Input
              value={formData.area}
              onChange={(e) => handleFieldChange('area', e.target.value)}
              disabled={isLocked}
              placeholder="Ex.: OFICINA CENTRAL"
              className="mt-1"
            />
          </div>
          <div>
            <label className="epa-label">CLIMA</label>
            <select
              value={formData.weather || 'Sol'}
              onChange={(e) => handleFieldChange('weather', e.target.value)}
              disabled={isLocked}
              className="epa-input mt-1"
            >
              <option value="Sol">Sol</option>
              <option value="Nublado">Nublado</option>
              <option value="Chuva">Chuva</option>
              <option value="Instável">Instável</option>
            </select>
          </div>
          <div>
            <label className="epa-label">PLUVIÔMETRO</label>
            <Input
              type="number"
              value={formData.pluviometer || 0}
              onChange={(e) => handleFieldChange('pluviometer', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1 font-mono"
            />
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
          {!isLocked && isAdmin && (
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
        {isAdmin && availableWells.length === 0 && !loadingWells && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
            <div>
              <p className="font-bold">Nenhum poço cadastrado para este projeto</p>
              <p className="mt-0.5">
                Utilize o botão "Adicionar Poço (PR)" ou cadastre novos poços na tela de Projetos.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-44">
                  Poço de Remediação
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[170px]">
                  <div>Hidrômetro (Manhã)</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.morning_time || ''}
                      onChange={(e) => handleFieldChange('morning_time', e.target.value)}
                      disabled={isLocked}
                      className="h-6 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-0 py-0 px-1"
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[170px]">
                  <div>Hidrômetro (Tarde)</div>
                  <div className="mt-1 flex items-center justify-center gap-1.5 font-normal text-[10px] text-emerald-100">
                    <span>Hora:</span>
                    <Input
                      type="time"
                      value={formData.afternoon_time || ''}
                      onChange={(e) => handleFieldChange('afternoon_time', e.target.value)}
                      disabled={isLocked}
                      className="h-6 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-0 py-0 px-1"
                    />
                  </div>
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-40">
                  Altura da bomba (m)
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[180px]">
                  Saída de Cada Autopump (500mL)*
                </th>
                {!isLocked && isAdmin && (
                  <th className="p-2.5 border border-emerald-800 w-12 text-center"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {formData.extraction_data?.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    {isTechnician ? (
                      <div className="flex items-center justify-center gap-1.5 py-1 px-2 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded">
                        <span>{row.well || '—'}</span>
                      </div>
                    ) : (
                      <Input
                        value={row.well}
                        onChange={(e) => handleExtractionCellChange(index, 'well', e.target.value)}
                        disabled={isLocked}
                        placeholder="Ex.: PR-01"
                        className="h-8 font-semibold text-xs text-center"
                      />
                    )}
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={row.morning}
                      onChange={(e) => handleExtractionCellChange(index, 'morning', e.target.value)}
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={row.afternoon}
                      onChange={(e) =>
                        handleExtractionCellChange(index, 'afternoon', e.target.value)
                      }
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={row.pump}
                      onChange={(e) => handleExtractionCellChange(index, 'pump', e.target.value)}
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-center"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={row.autopump}
                      onChange={(e) =>
                        handleExtractionCellChange(index, 'autopump', e.target.value)
                      }
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-center"
                    />
                  </td>
                  {!isLocked && isAdmin && (
                    <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveExtractionWell(index)}
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="Remover linha de poço (Admin)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. INFILTRAÇÃO/VOLUME INFILTRADO */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            2. INFILTRAÇÃO/VOLUME INFILTRADO
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Leitura de hidrômetros geral e saídas 01 a 03 com horário de medição e pressões da bomba
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
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
                      disabled={isLocked}
                      className="h-6 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-0 py-0 px-1"
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
                      disabled={isLocked}
                      className="h-6 w-24 text-[10px] font-mono bg-white text-slate-900 dark:bg-slate-900 dark:text-white border-0 py-0 px-1"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {[
                { label: 'Geral', mKey: 'geralMorning', aKey: 'geralAfternoon' },
                { label: 'Saída 01', mKey: 'out1Morning', aKey: 'out1Afternoon' },
                { label: 'Saída 02', mKey: 'out2Morning', aKey: 'out2Afternoon' },
                { label: 'Saída 03', mKey: 'out3Morning', aKey: 'out3Afternoon' },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2 border border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {row.label}
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={formData.infiltration_data?.[row.mKey] || ''}
                      onChange={(e) =>
                        handleFieldChange('infiltration_data', {
                          ...formData.infiltration_data,
                          [row.mKey]: e.target.value,
                        })
                      }
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-right"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={formData.infiltration_data?.[row.aKey] || ''}
                      onChange={(e) =>
                        handleFieldChange('infiltration_data', {
                          ...formData.infiltration_data,
                          [row.aKey]: e.target.value,
                        })
                      }
                      disabled={isLocked}
                      placeholder="0,00"
                      className="h-8 font-mono text-xs text-right"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Linha: Pressão da Bomba (Infiltração) | Pressão da Bomba - Geral */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
          <div>
            <label className="epa-label">Pressão da Bomba (Infiltração)</label>
            <Input
              value={formData.infiltration_data?.bombaInfiltracao || ''}
              onChange={(e) =>
                handleFieldChange('infiltration_data', {
                  ...formData.infiltration_data,
                  bombaInfiltracao: e.target.value,
                })
              }
              disabled={isLocked}
              placeholder="Ex.: 3 bar / PSI"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="epa-label">Pressão da Bomba - Geral</label>
            <Input
              value={formData.infiltration_data?.bombaGeral || ''}
              onChange={(e) =>
                handleFieldChange('infiltration_data', {
                  ...formData.infiltration_data,
                  bombaGeral: e.target.value,
                })
              }
              disabled={isLocked}
              placeholder="Ex.: 4 bar / PSI"
              className="mt-1 font-mono text-xs"
            />
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
              disabled={isLocked}
            />
          </div>
          <div>
            <label className="epa-label">Quantidade MAP (Kg)</label>
            <Input
              type="number"
              value={formData.nutrient_map_kg || 0}
              onChange={(e) => handleFieldChange('nutrient_map_kg', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="epa-label">Quantidade Ureia (Kg)</label>
            <Input
              type="number"
              value={formData.nutrient_ureia_kg || 0}
              onChange={(e) => handleFieldChange('nutrient_ureia_kg', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1 font-mono text-xs"
            />
          </div>
        </div>
      </section>

      {/* 4. COMPRESSORES */}
      <section className="epa-card p-6">
        <div className="border-b pb-4 dark:border-slate-800">
          <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
            4. COMPRESSORES
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Parâmetros operacionais dos compressores 01 e 02 e pressão da linha de ar
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/2">
                  PARÂMETROS
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/4">
                  COMPRESSOR 01
                </th>
                <th className="p-2.5 border border-emerald-800 font-semibold text-center w-1/4">
                  COMPRESSOR 02
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {[
                { label: 'Horímetro (hr)', k1: 'horimetro1', k2: 'horimetro2', ph: 'Ex.: 5448.81' },
                { label: 'Pressão (bar)', k1: 'pressao1', k2: 'pressao2', ph: 'Ex.: 6 bar' },
                {
                  label: 'Drenagem de água (mL)',
                  k1: 'drenagem1',
                  k2: 'drenagem2',
                  ph: 'Ex.: 6 LTS',
                },
                {
                  label: 'Tempo Desligado',
                  k1: 'tempoDesligado1',
                  k2: 'tempoDesligado2',
                  ph: 'Ex.: 0 min',
                },
                {
                  label: 'Troca do filtro de ar',
                  k1: 'filtroAr1',
                  k2: 'filtroAr2',
                  ph: 'Ex.: OK / data',
                },
                { label: 'Nível de óleo', k1: 'nivelOleo1', k2: 'nivelOleo2', ph: 'Ex.: OK' },
                {
                  label: 'Troca de óleo e filtro (a cada 1000hrs)',
                  k1: 'trocaOleo1',
                  k2: 'trocaOleo2',
                  ph: 'Ex.: 6000HR',
                },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-2 border border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {row.label}
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={formData.compressor_data?.[row.k1] || ''}
                      onChange={(e) =>
                        handleFieldChange('compressor_data', {
                          ...formData.compressor_data,
                          [row.k1]: e.target.value,
                        })
                      }
                      disabled={isLocked}
                      placeholder={row.ph}
                      className="h-8 font-mono text-xs text-center"
                    />
                  </td>
                  <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                    <Input
                      value={formData.compressor_data?.[row.k2] || ''}
                      onChange={(e) =>
                        handleFieldChange('compressor_data', {
                          ...formData.compressor_data,
                          [row.k2]: e.target.value,
                        })
                      }
                      disabled={isLocked}
                      placeholder={row.ph}
                      className="h-8 font-mono text-xs text-center"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Segunda tabela: LINHA DE AR */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-emerald-800 text-white dark:bg-emerald-900 text-[11px]">
                <th className="p-2.5 border border-emerald-700 font-semibold text-center w-1/2">
                  LINHA DE AR
                </th>
                <th className="p-2.5 border border-emerald-700 font-semibold text-center w-1/4">
                  COMPRESSOR 01
                </th>
                <th className="p-2.5 border border-emerald-700 font-semibold text-center w-1/4">
                  COMPRESSOR 02
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-slate-200 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  Pressão da Linha de Ar (ex.: PSI)
                </td>
                <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                  <Input
                    value={formData.compressor_data?.linhaAr1 || ''}
                    onChange={(e) =>
                      handleFieldChange('compressor_data', {
                        ...formData.compressor_data,
                        linhaAr1: e.target.value,
                      })
                    }
                    disabled={isLocked}
                    placeholder="Ex.: 85 PSI"
                    className="h-8 font-mono text-xs text-center"
                  />
                </td>
                <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                  <Input
                    value={formData.compressor_data?.linhaAr2 || ''}
                    onChange={(e) =>
                      handleFieldChange('compressor_data', {
                        ...formData.compressor_data,
                        linhaAr2: e.target.value,
                      })
                    }
                    disabled={isLocked}
                    placeholder="Ex.: 85 PSI"
                    className="h-8 font-mono text-xs text-center"
                  />
                </td>
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
                <Input
                  value={formData.oil_removal_data?.sao1Volume || ''}
                  onChange={(e) =>
                    handleFieldChange('oil_removal_data', {
                      ...formData.oil_removal_data,
                      sao1Volume: e.target.value,
                    })
                  }
                  disabled={isLocked}
                  placeholder="Ex.: 0"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="epa-label">Data da última limpeza</label>
                <Input
                  value={formData.oil_removal_data?.sao1DataLimpeza || ''}
                  onChange={(e) =>
                    handleFieldChange('oil_removal_data', {
                      ...formData.oil_removal_data,
                      sao1DataLimpeza: e.target.value,
                    })
                  }
                  disabled={isLocked}
                  placeholder="Ex.: 24/04/26 ou DD/MM/AAAA"
                  className="mt-1 font-mono text-xs"
                />
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
                <Input
                  value={formData.oil_removal_data?.sao2Volume || ''}
                  onChange={(e) =>
                    handleFieldChange('oil_removal_data', {
                      ...formData.oil_removal_data,
                      sao2Volume: e.target.value,
                    })
                  }
                  disabled={isLocked}
                  placeholder="Ex.: 0"
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="epa-label">Data da última limpeza</label>
                <Input
                  value={formData.oil_removal_data?.sao2DataLimpeza || ''}
                  onChange={(e) =>
                    handleFieldChange('oil_removal_data', {
                      ...formData.oil_removal_data,
                      sao2DataLimpeza: e.target.value,
                    })
                  }
                  disabled={isLocked}
                  placeholder="Ex.: 24/04/26 ou DD/MM/AAAA"
                  className="mt-1 font-mono text-xs"
                />
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
            <Input
              type="number"
              value={formData.waste_liquid_qty || 0}
              onChange={(e) => handleFieldChange('waste_liquid_qty', Number(e.target.value))}
              disabled={isLocked}
              placeholder="Ex.: 02"
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div>
            <label className="epa-label">TAMBORES PARA RETIRADA (QNTD) - Sólido</label>
            <Input
              type="number"
              value={formData.waste_solid_qty || 0}
              onChange={(e) => handleFieldChange('waste_solid_qty', Number(e.target.value))}
              disabled={isLocked}
              placeholder="Ex.: 01"
              className="mt-1 font-mono text-xs"
            />
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
            <Switch
              checked={formData.env_5s_check || false}
              onCheckedChange={(c) => handleFieldChange('env_5s_check', c)}
              disabled={isLocked}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 p-4">
            <div>
              <p className="text-xs font-semibold">CHECKLIST MENSAL (S/N)</p>
              <p className="text-[10px] text-slate-500">
                {formData.env_checklist_monthly ? 'Sim (Conforme)' : 'Não'}
              </p>
            </div>
            <Switch
              checked={formData.env_checklist_monthly || false}
              onCheckedChange={(c) => handleFieldChange('env_checklist_monthly', c)}
              disabled={isLocked}
            />
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
        <Textarea
          value={formData.observations || ''}
          onChange={(e) => handleFieldChange('observations', e.target.value)}
          disabled={isLocked}
          placeholder="Ex.: * Foi realizado a manutenção do PR-49."
          className="mt-4 min-h-[120px]"
        />
      </section>

      {/* 9. BOTÕES FINAIS DE AÇÃO E VALIDAÇÃO */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 epa-card p-6">
        <div>
          <p className="text-sm font-semibold">Finalização da Planilha</p>
          <p className="text-xs text-slate-500">
            {isLocked
              ? 'Esta planilha já foi aprovada e está bloqueada para modificações.'
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
                Enviar para aprovação
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modal Devolução */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Devolver Planilha de Campo</h3>
              <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Informe os pontos ou medições que precisam de correção pelo operador.
            </p>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="mt-4 min-h-[120px] dark:border-slate-800 dark:bg-slate-950"
              placeholder="Ex.: Conferir a medição de vazão da tarde no poço PB-128."
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
      extractionRows += `<tr>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;font-weight:bold;">${r.well || '—'}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.morning || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:right;">${r.afternoon || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.pump || ''}</td>
        <td style="border:1px solid #777;padding:5px 8px;text-align:center;">${r.autopump || ''}</td>
      </tr>`
    })
  } else {
    extractionRows = `<tr><td colspan="5" style="border:1px solid #777;padding:8px;text-align:center;color:#666;">Nenhum poço registrado</td></tr>`
  }

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
        <td colspan="5" class="header-title" style="padding: 12px; font-size: 14px;">
          Controle Operacional Diário de Remediação
        </td>
      </tr>

      <!-- CABEÇALHO DE METADADOS -->
      <tr>
        <td class="label-col" style="width: 20%;">OPERADOR:</td>
        <td style="width: 25%; font-weight: bold;">${sheet.operatorName || ''}</td>
        <td class="label-col" style="width: 15%;">DATA:</td>
        <td colspan="2" style="width: 40%; font-weight: bold;">${sheet.date || ''}</td>
      </tr>
      <tr>
        <td class="label-col">ÁREA:</td>
        <td>${sheet.area || ''}</td>
        <td class="label-col">CLIMA:</td>
        <td colspan="2">${sheet.weather || 'Sol'}</td>
      </tr>
      <tr>
        <td class="label-col">PLUVIÔMETRO:</td>
        <td colspan="4">${sheet.pluviometer || 0} mm</td>
      </tr>

      <!-- 1. EXTRAÇÃO/VOLUME BOMBEADO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">1. EXTRAÇÃO/VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th style="width: 22%;">Poço de Remediação</th>
        <th style="width: 20%;">
          Hidrômetro (Manhã)<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${morningTime || '—'}</span>
        </th>
        <th style="width: 20%;">
          Hidrômetro (Tarde)<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${afternoonTime || '—'}</span>
        </th>
        <th style="width: 18%;">Altura da bomba (m)</th>
        <th style="width: 20%;">Saída de Cada Autopump (500mL)*</th>
      </tr>
      ${extractionRows}

      <!-- 2. INFILTRAÇÃO/VOLUME INFILTRADO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">2. INFILTRAÇÃO/VOLUME INFILTRADO</td>
      </tr>
      <tr>
        <th style="width: 30%;">Hidrômetro</th>
        <th colspan="2" style="width: 35%;">
          Manhã<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${infMorningTime || '—'}</span>
        </th>
        <th colspan="2" style="width: 35%;">
          Tarde<br>
          <span style="font-size: 9px; font-weight: normal; color: #d1fae5;">Hora: ${infAfternoonTime || '—'}</span>
        </th>
      </tr>
      <tr>
        <td class="label-col">Geral</td>
        <td colspan="2" style="text-align:right;">${infData.geralMorning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.geralAfternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 01</td>
        <td colspan="2" style="text-align:right;">${infData.out1Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out1Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 02</td>
        <td colspan="2" style="text-align:right;">${infData.out2Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out2Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Saída 03</td>
        <td colspan="2" style="text-align:right;">${infData.out3Morning || ''}</td>
        <td colspan="2" style="text-align:right;">${infData.out3Afternoon || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Pressão da Bomba (Infiltração)</td>
        <td colspan="2" style="text-align:center;">${infData.bombaInfiltracao || ''}</td>
        <td class="label-col">Pressão da Bomba - Geral</td>
        <td style="text-align:center;">${infData.bombaGeral || ''}</td>
      </tr>

      <!-- 3. DOSAGEM DE NUTRIENTES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">3. DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <th style="width: 30%;">Realizada (S/N)</th>
        <th colspan="2" style="width: 35%;">Quantidade MAP (Kg)</th>
        <th colspan="2" style="width: 35%;">Quantidade Ureia (Kg)</th>
      </tr>
      <tr>
        <td style="text-align:center; font-weight:bold;">${sheet.nutrient_done ? 'Sim' : 'Não'}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.nutrient_map_kg || 0}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.nutrient_ureia_kg || 0}</td>
      </tr>

      <!-- 4. COMPRESSORES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">4. COMPRESSORES</td>
      </tr>
      <tr>
        <th style="width: 40%;">PARÂMETROS</th>
        <th colspan="2" style="width: 30%;">COMPRESSOR 01</th>
        <th colspan="2" style="width: 30%;">COMPRESSOR 02</th>
      </tr>
      <tr>
        <td class="label-col">Horímetro (hr)</td>
        <td colspan="2" style="text-align:center;">${compData.horimetro1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.horimetro2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Pressão (bar)</td>
        <td colspan="2" style="text-align:center;">${compData.pressao1 || compData.pressure1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.pressao2 || compData.pressure2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Drenagem de água (mL)</td>
        <td colspan="2" style="text-align:center;">${compData.drenagem1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.drenagem2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Tempo Desligado</td>
        <td colspan="2" style="text-align:center;">${compData.tempoDesligado1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.tempoDesligado2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Troca do filtro de ar</td>
        <td colspan="2" style="text-align:center;">${compData.filtroAr1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.filtroAr2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Nível de óleo</td>
        <td colspan="2" style="text-align:center;">${compData.nivelOleo1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.nivelOleo2 || ''}</td>
      </tr>
      <tr>
        <td class="label-col">Troca de óleo e filtro (a cada 1000hrs)</td>
        <td colspan="2" style="text-align:center;">${compData.trocaOleo1 || ''}</td>
        <td colspan="2" style="text-align:center;">${compData.trocaOleo2 || ''}</td>
      </tr>
      <tr>
        <th style="width: 40%; background-color:#145a32;">LINHA DE AR</th>
        <th colspan="2" style="width: 30%; background-color:#145a32;">COMPRESSOR 01</th>
        <th colspan="2" style="width: 30%; background-color:#145a32;">COMPRESSOR 02</th>
      </tr>
      <tr>
        <td class="label-col">Pressão da Linha de Ar</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${compData.linhaAr1 || ''}</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${compData.linhaAr2 || ''}</td>
      </tr>

      <!-- 5. REMOÇÃO DE ÓLEO -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">5. REMOÇÃO DE ÓLEO</td>
      </tr>
      <tr>
        <td colspan="5" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 01)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao1Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td style="text-align:center; font-weight:bold;">${oilData.sao1DataLimpeza || oilData.sao1Date || ''}</td>
      </tr>
      <tr>
        <td colspan="5" style="background-color:#f9fbf9; font-weight:bold; border:1px solid #777;">Caixa Separadora (SAO 02)</td>
      </tr>
      <tr>
        <td class="label-col">Volume de óleo removido (mL):</td>
        <td colspan="2" style="text-align:center;">${oilData.sao2Volume || ''}</td>
        <td class="label-col">Data da última limpeza:</td>
        <td style="text-align:center; font-weight:bold;">${oilData.sao2DataLimpeza || oilData.sao2Date || ''}</td>
      </tr>

      <!-- 6. RESÍDUOS SÓLIDOS E LÍQUIDOS -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">6. RESÍDUOS SÓLIDOS E LÍQUIDOS</td>
      </tr>
      <tr>
        <td colspan="2" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Líquido</td>
        <td colspan="3" class="label-col" style="text-align:center;">TAMBORES PARA RETIRADA (QNTD) - Sólido</td>
      </tr>
      <tr>
        <td colspan="2" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_liquid_qty ?? 0}</td>
        <td colspan="3" style="text-align:center; font-size: 13px; font-weight:bold;">${sheet.waste_solid_qty ?? 0}</td>
      </tr>

      <!-- 7. CONTROLES AMBIENTAIS E 5S -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">7. CONTROLES AMBIENTAIS E 5S</td>
      </tr>
      <tr>
        <td class="label-col">5S (S/N):</td>
        <td style="text-align:center; font-weight:bold;">${sheet.env_5s_check ? 'Sim' : 'Não'}</td>
        <td class="label-col">CHECKLIST MENSAL (S/N):</td>
        <td colspan="2" style="text-align:center; font-weight:bold;">${sheet.env_checklist_monthly ? 'Sim' : 'Não'}</td>
      </tr>

      <!-- 8. OBSERVAÇÕES E MANUTENÇÕES -->
      <tr>
        <td colspan="5" class="section-hdr" style="padding: 7px;">8. OBSERVAÇÕES E MANUTENÇÕES</td>
      </tr>
      <tr>
        <td colspan="5" style="padding: 10px; min-height: 50px;">${sheet.observations || '—'}</td>
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
