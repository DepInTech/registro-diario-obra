import { useState, useEffect, useRef } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { offlineStorage, OfflineRdoItem } from '@/services/offlineStorage'
import { authHeaders, exportUrl, updateRdoStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { rdos as mockRdos, type Status } from '@/data/epa'
import { EPA_LOGO_BASE64 } from '@/components/epaLogoBase64'

export function RdosPage({ query }: { query: string }) {
  const [editing, setEditing] = useState<OfflineRdoItem | null>(null)
  const [items, setItems] = useState<OfflineRdoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tabFilter, setTabFilter] = useState<'active' | 'archived'>('active')
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
  const [deleteModalRdo, setDeleteModalRdo] = useState<OfflineRdoItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const { user } = useAuth()
  const { toast } = useToast()

  const loadRdos = async () => {
    setLoading(true)
    try {
      // 1. Load from IndexedDB
      // RBAC check: Only Admin and Operator can access RDOs
      if (user && user.role !== 'admin' && user.role !== 'operator') {
        toast({
          title: 'Você não possui permissão para esta função.',
          description: 'Acesso restrito ao perfil Operador e Administrador.',
          variant: 'destructive',
        })
        setItems([])
        setLoading(false)
        return
      }

      let localRdos = await offlineStorage.getAllRdos()

      // 2. If online and PocketBase available, fetch latest and sync cache
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const records = await pb.collection('reports_rdo').getFullList({
            sort: '-number',
            expand:
              'project,project.client,project.contract,project.company,performed_by,supervised_by',
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

              const item: OfflineRdoItem = {
                id: rec.id,
                number: rec.number,
                projectId: rec.project,
                projectName: proj?.name || 'Recuperação Ambiental Lote A',
                clientName: client?.name || 'Petrobras — Refinaria Sul',
                contractCode: contract?.code || 'CT-EPA-2025-017',
                companyName: company?.name || 'EPA Gestão Ambiental',
                location: proj?.location || 'Refinaria Sul — Área Industrial',
                reportDate: rec.report_date ? rec.report_date.slice(0, 10) : '2025-05-28',
                weather: rec.weather || 'Sol',
                performedBy: rec.performed_by,
                performedByName: performer?.name || 'Carlos Oliveira',
                supervisedBy: rec.supervised_by,
                supervisedByName: supervisor?.name || 'Marina Santos',
                activityTitle: rec.activity_title || '',
                activityDescription: rec.activity_description || '',
                timeDisplacement: rec.time_displacement || '',
                timeWaiting: rec.time_waiting || '',
                interferences: rec.interferences || '',
                planChanges: rec.plan_changes || '',
                accidents: rec.accidents || '',
                status: rec.status,
                reviewNotes: rec.review_notes || '',
                wells: wells.map((w) => ({
                  id: w.id,
                  well_id: w.well_id,
                  depth: w.depth,
                  completion_date: w.completion_date ? w.completion_date.slice(0, 10) : undefined,
                  diameter: w.diameter,
                })),
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
              }
              await offlineStorage.saveRdo(item)
            }
          }
          localRdos = await offlineStorage.getAllRdos()
        } catch (err) {
          console.warn('Could not refresh RDOs from server:', err)
        }
      }

      // If still empty (first run offline), seed from mock
      if (localRdos.length === 0) {
        for (const m of mockRdos) {
          const item: OfflineRdoItem = {
            id: m.id,
            number: m.number,
            projectId: m.projectId,
            projectName: m.project,
            clientName: 'Petrobras — Refinaria Sul',
            contractCode: 'CT-EPA-2025-017',
            companyName: 'EPA Gestão Ambiental',
            location: 'Refinaria Sul — Área Industrial',
            reportDate: '2025-05-28',
            weather: m.weather,
            performedBy: user?.id || 'cfpekk93zx4j1pr',
            performedByName: m.operator,
            supervisedBy: '2n6he1v3guzt3yt',
            supervisedByName: m.technician,
            activityTitle: m.activity,
            activityDescription: m.description,
            timeDisplacement: '01h20',
            timeWaiting: 'Sem ocorrências',
            interferences: 'Não houve',
            planChanges: 'Não houve',
            accidents: 'Não houve',
            status: m.status,
            reviewNotes: m.reviewNotes || '',
            wells: [
              { well_id: 'PZ-01', depth: 8.5, completion_date: '2025-05-28', diameter: '4 pol.' },
              { well_id: 'PZ-02', depth: 10.2, completion_date: '2025-05-28', diameter: '4 pol.' },
            ],
            photos: [
              {
                id: 'p1',
                caption: 'Leitura inicial do hidrômetro PZ-01',
                order: 0,
                image: 'https://img.usecurling.com/p/640/420?q=monitoring%20well',
                category: 'general',
              },
              {
                id: 'p2',
                caption: 'Condição da bomba pneumática',
                order: 1,
                image: 'https://img.usecurling.com/p/640/420?q=water%20pump',
                category: 'general',
              },
            ],
            fieldPhoto: {
              id: 'p_field_mock',
              caption: 'Figura 01 – Mapa de localização da área de interesse.',
              image: 'https://img.usecurling.com/p/640/420?q=field%20site',
            },
            syncStatus: 'synced',
            lastModified: Date.now(),
            archived: false,
          }
          await offlineStorage.saveRdo(item)
        }
        localRdos = await offlineStorage.getAllRdos()
      }

      // Sort by number descending
      localRdos.sort((a, b) => b.number - a.number)
      setItems(localRdos)
    } catch (err) {
      console.error('Error loading RDOs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRdos()
  }, [])

  const filtered = items.filter((r) => {
    const matchesTab = tabFilter === 'archived' ? Boolean(r.archived) : !r.archived
    const matchesStatus = filter === 'all' || r.status === filter
    const matchesQuery = `${r.number} ${r.projectName} ${r.activityTitle}`
      .toLowerCase()
      .includes(query.toLowerCase())
    return matchesTab && matchesStatus && matchesQuery
  })

  const openNew = () => {
    const nextNum = items.length > 0 ? Math.max(...items.map((i) => i.number)) + 1 : 1
    const newReport: OfflineRdoItem = {
      id: 'rdo_' + Date.now(),
      number: nextNum,
      projectId: '',
      projectName: '',
      clientName: '',
      contractCode: '',
      companyName: '',
      location: '',
      reportDate: new Date().toISOString().slice(0, 10),
      weather: 'Sol',
      performedBy: user?.id || '',
      performedByName: user?.name || '',
      supervisedBy: '',
      supervisedByName: '',
      activityTitle: '',
      activityDescription: '',
      timeDisplacement: '',
      timeWaiting: '',
      interferences: '',
      planChanges: '',
      accidents: '',
      status: 'draft',
      wells: [],
      photos: [],
      fieldPhoto: undefined,
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

  const activeCount = items.filter((r) => !r.archived).length
  const archivedCount = items.filter((r) => Boolean(r.archived)).length

  const confirmDeleteRdo = async () => {
    if (!deleteModalRdo) return
    if (user?.role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta ação.',
        description: 'Apenas Administradores podem excluir relatórios.',
        variant: 'destructive',
      })
      setDeleteModalRdo(null)
      return
    }

    const rdoToDelete = deleteModalRdo
    setIsDeleting(true)
    try {
      // 1. Backend deletion if online: remove child records (wells and photos) first to avoid orphans
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const wells = await pb.collection('report_wells').getFullList({
            filter: `report = "${rdoToDelete.id}"`,
          })
          for (const w of wells) {
            try {
              await pb.collection('report_wells').delete(w.id)
            } catch (errWell) {
              console.warn('Error deleting child well:', errWell)
            }
          }

          const photos = await pb.collection('report_photos').getFullList({
            filter: `report = "${rdoToDelete.id}"`,
          })
          for (const p of photos) {
            try {
              await pb.collection('report_photos').delete(p.id)
            } catch (errPhoto) {
              console.warn('Error deleting child photo:', errPhoto)
            }
          }

          await pb.collection('reports_rdo').delete(rdoToDelete.id)
        } catch (pbErr: any) {
          console.warn('Backend delete error (will delete locally):', pbErr)
        }
      }

      // 2. Local deletion (IndexedDB)
      await offlineStorage.deleteRdo(rdoToDelete.id)
      setItems((prev) => prev.filter((i) => i.id !== rdoToDelete.id))
      if (editing?.id === rdoToDelete.id) {
        setEditing(null)
      }

      toast({
        title: 'RDO excluído com sucesso',
        description: `O RDO #${String(rdoToDelete.number).padStart(3, '0')} e seus registros vinculados foram removidos.`,
      })
      setDeleteModalRdo(null)
    } catch (err: any) {
      console.error('Delete RDO error:', err)
      toast({
        title: 'Erro ao excluir RDO',
        description: err.message || 'Ocorreu um erro ao excluir o relatório.',
        variant: 'destructive',
      })
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

      toast({
        title: nextArchived ? 'RDO arquivado' : 'RDO desarquivado',
        description: nextArchived
          ? `O RDO #${String(rdo.number).padStart(3, '0')} foi movido para os arquivados.`
          : `O RDO #${String(rdo.number).padStart(3, '0')} foi restaurado para a listagem ativa.`,
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
    tabFilter === 'archived' ? Boolean(r.archived) : !r.archived,
  )

  const counts = {
    draft: baseItems.filter((r) => r.status === 'draft').length,
    submitted: baseItems.filter((r) => r.status === 'submitted').length,
    approved: baseItems.filter((r) => r.status === 'approved').length,
    returned: baseItems.filter((r) => r.status === 'returned').length,
  }

  return (
    <div className="space-y-6">
      {/* Abas Ativos vs Arquivados */}
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
          <div className="overflow-x-auto">
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
                      <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        RDO #{String(report.number).padStart(3, '0')}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {report.reportDate} · {report.weather}
                      </p>
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
                      <p className="text-xs font-medium">{report.performedByName || 'Operador'}</p>
                      <p className="text-[10px] text-slate-400">
                        {report.supervisedByName || 'Técnico'}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={report.status} />
                        {report.syncStatus === 'pending_create' && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Offline (Novo)
                          </span>
                        )}
                        {report.syncStatus === 'pending_update' && (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Offline (Editado)
                          </span>
                        )}
                      </div>
                      {report.reviewNotes && (
                        <p className="mt-1 max-w-40 truncate text-[10px] text-amber-700 dark:text-amber-400">
                          {report.reviewNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
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
                        {user?.role === 'admin' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteModalRdo(report)
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                            title="Excluir RDO (apenas Admin)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(report)
                            setIsNew(false)
                          }}
                          className="text-xs hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-800 min-h-[36px]"
                        >
                          <Eye className="mr-1.5 h-4 w-4" />
                          {report.archived ? 'Visualizar' : 'Abrir / Editar'}
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

      {/* Modal de confirmação de exclusão do RDO */}
      {deleteModalRdo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 dark:bg-red-950/50">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Excluir RDO #{String(deleteModalRdo.number).padStart(3, '0')}
              </h3>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Tem certeza que deseja excluir o relatório{' '}
              <b className="text-slate-900 dark:text-white">
                RDO #{String(deleteModalRdo.number).padStart(3, '0')} — {deleteModalRdo.projectName}
              </b>
              ?
            </p>
            <div className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️ <b>Esta ação não pode ser desfeita.</b> Todos os poços cadastrados e registros
              fotográficos vinculados a este RDO também serão excluídos definitivamente.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDeleteModalRdo(null)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={confirmDeleteRdo}
                className="bg-red-600 hover:bg-red-700 text-white min-w-[100px]"
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fieldPhotoInputRef = useRef<HTMLInputElement>(null)

  const { user, setHasUnsavedChanges } = useAuth()
  const { isOnline, syncNow } = useSync()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isLocked = formData.status === 'approved' && !isAdmin

  const handleFieldChange = (field: keyof OfflineRdoItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  // Wells Handlers
  const handleAddWell = () => {
    const nextIndex = (formData.wells?.length || 0) + 1
    const newWell = {
      well_id: `PZ-${String(nextIndex).padStart(2, '0')}`,
      depth: 8.0,
      completion_date: formData.reportDate || new Date().toISOString().slice(0, 10),
      diameter: '4 pol.',
    }
    const updated = [...(formData.wells || []), newWell]
    handleFieldChange('wells', updated)
    toast({ title: 'Poço adicionado', description: `Linha ${newWell.well_id} inserida na tabela.` })
  }

  const handleRemoveWell = (index: number) => {
    const updated = [...(formData.wells || [])]
    updated.splice(index, 1)
    handleFieldChange('wells', updated)
    toast({ title: 'Poço removido', description: 'Linha excluída da tabela.' })
  }

  const handleWellFieldChange = (index: number, field: string, value: any) => {
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
    if (fileInputRef.current) fileInputRef.current.value = ''
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
    if (fieldPhotoInputRef.current) fieldPhotoInputRef.current.value = ''
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
    setIsSaving(true)
    const statusToSave = targetStatus || formData.status
    const updatedItem: OfflineRdoItem = {
      ...formData,
      status: statusToSave,
      syncStatus: isOnline ? 'pending_update' : isNew ? 'pending_create' : 'pending_update',
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
          targetStatus === 'submitted' ? 'RDO enviado para aprovação' : 'RDO salvo com sucesso',
        description: isOnline
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
      const updatedItem: OfflineRdoItem = {
        ...formData,
        status: nextStatus,
        reviewNotes: nextStatus === 'returned' ? reviewNotes : '',
        syncStatus: 'pending_update',
        lastModified: Date.now(),
      }

      await offlineStorage.saveRdo(updatedItem)
      setFormData(updatedItem)
      setReviewOpen(false)
      setHasUnsavedChanges(false)

      if (isOnline) {
        try {
          await updateRdoStatus(formData.id, nextStatus, reviewNotes)
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
            : 'O operador/técnico foi notificado para os ajustes.',
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

  const isOperator = user?.role === 'operator'
  const canExportPdf = isAdmin || isOperator

  // PDF Export (Admin e Operador têm permissão de visualizar/exportar PDF do RDO)
  const handleExportPdf = async () => {
    if (!canExportPdf) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Exportação permitida para Administradores e Operadores.',
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
              RDO #{String(formData.number).padStart(3, '0')}
            </h2>
            <StatusBadge status={formData.status} />
            {isLocked && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Bloqueado após aprovação
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Arquivar / Desarquivar */}
          {onToggleArchive && (
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

          {/* Excluir (Admin apenas) */}
          {isAdmin && onDelete && (
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

      {formData.archived && (
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
            </div>
          </div>
        </div>
      )}

      {/* 1. CABEÇALHO DO RELATÓRIO */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={FileText}
          title="1. Cabeçalho do Relatório"
          subtitle="Identificação da obra, dados contratuais e condições operacionais"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="epa-label">Cliente</label>
            <Input
              placeholder="Ex.: VALE S.A."
              value={formData.clientName ?? ''}
              onChange={(e) => handleFieldChange('clientName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Contrato</label>
            <Input
              placeholder="Ex.: 5900117667"
              value={formData.contractCode ?? ''}
              onChange={(e) => handleFieldChange('contractCode', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Local</label>
            <Input
              placeholder="Ex.: Açailândia - MA"
              value={formData.location ?? ''}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Projeto EPA</label>
            <Input
              placeholder="Ex.: 24-0234"
              value={formData.projectName ?? ''}
              onChange={(e) => handleFieldChange('projectName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Empresa Executora</label>
            <Input
              placeholder="Ex.: EPA Engenharia de Proteção Ambiental"
              value={formData.companyName ?? ''}
              onChange={(e) => handleFieldChange('companyName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Data do Relatório</label>
            <Input
              type="date"
              value={formData.reportDate ?? ''}
              onChange={(e) => handleFieldChange('reportDate', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Clima</label>
            <select
              value={formData.weather ?? 'Sol'}
              onChange={(e) => handleFieldChange('weather', e.target.value)}
              disabled={isLocked}
              className="epa-input"
            >
              <option value="Sol">Sol</option>
              <option value="Nublado">Nublado</option>
              <option value="Chuva">Chuva</option>
              <option value="Instável">Instável</option>
            </select>
          </div>
          <div>
            <label className="epa-label">Número do RDO</label>
            <Input
              type="number"
              value={formData.number ?? ''}
              onChange={(e) => handleFieldChange('number', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1.5 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Realizado por (Operador/Executor)</label>
            <Input
              placeholder="Nome do operador ou executor"
              value={formData.performedByName ?? ''}
              onChange={(e) => handleFieldChange('performedByName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Supervisionado por (Técnico/Responsável)</label>
            <Input
              placeholder="Nome do responsável técnico ou supervisor"
              value={formData.supervisedByName ?? ''}
              onChange={(e) => handleFieldChange('supervisedByName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
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
          <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-2 text-center border-b border-slate-300 dark:border-slate-700">
              <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                ATIVIDADE
              </h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900">
              <Input
                placeholder="Ex.: Tamponamento de poços de monitoramento ou Operação de Extração"
                value={formData.activityTitle ?? ''}
                onChange={(e) => handleFieldChange('activityTitle', e.target.value)}
                disabled={isLocked}
                className="font-medium text-sm border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>

          {/* FAIXA: DESCRIÇÃO DA ATIVIDADE */}
          <div className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-2 text-center border-b border-slate-300 dark:border-slate-700">
              <h3 className="text-xs font-bold tracking-wider text-slate-800 dark:text-slate-100 uppercase">
                DESCRIÇÃO DA ATIVIDADE
              </h3>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 space-y-6">
              <div>
                <Textarea
                  placeholder="Descreva minuciosamente os serviços executados, procedimentos e informações de campo..."
                  value={formData.activityDescription ?? ''}
                  onChange={(e) => handleFieldChange('activityDescription', e.target.value)}
                  disabled={isLocked}
                  className="epa-textarea min-h-[120px] text-xs sm:text-sm"
                />
              </div>

              {/* FOTO DO CAMPO / LOCAL DA INSPEÇÃO (CENTRALIZADA COM LEGENDA ACIMA) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                        Foto do Campo / Local da Inspeção (Modelo Oficial)
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Exibida sob a descrição da atividade com legenda centralizada no topo da
                      imagem.
                    </p>
                  </div>

                  {!isLocked && (
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fieldPhotoInputRef}
                        onChange={handleSelectFieldPhoto}
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fieldPhotoInputRef.current?.click()}
                        className="w-full sm:w-fit text-xs border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 active:scale-[0.98] transition shadow-sm dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 min-h-[38px]"
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" />
                        {formData.fieldPhoto ? 'Substituir Foto do Campo' : 'Inserir Foto do Campo'}
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
                        <div className="absolute right-2 top-2 flex items-center gap-1.5 bg-slate-950/70 backdrop-blur p-1 rounded-md shadow">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fieldPhotoInputRef.current?.click()}
                            className="h-7 px-2 text-[11px] text-white hover:bg-white/20"
                          >
                            <Upload className="mr-1 h-3 w-3" />
                            Trocar
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
                  <div
                    onClick={() => !isLocked && fieldPhotoInputRef.current?.click()}
                    className={cn(
                      'mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white/70 p-6 text-center transition dark:border-slate-700 dark:bg-slate-900/50',
                      !isLocked &&
                        'cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/70 hover:shadow-sm',
                    )}
                  >
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Camera className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                      Nenhuma foto do local/campo inserida
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                      Clique aqui para adicionar a fotografia da área de interesse (câmera ou
                      galeria). Conforme o modelo oficial, ela será exibida centralizada sob a
                      descrição.
                    </p>
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
          <SectionHeader
            icon={Layers}
            title="3. Tabela de Poços"
            subtitle="Identificação, profundidade, data de conclusão e diâmetro dos poços trabalhados"
          />
          {!isLocked && (
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

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="p-3">ID do Poço</th>
                <th className="p-3">Profundidade (m)</th>
                <th className="p-3">Data Conclusão</th>
                <th className="p-3">Diâmetro</th>
                {!isLocked && <th className="p-3 w-12 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-800">
              {formData.wells?.length === 0 ? (
                <tr>
                  <td colSpan={isLocked ? 4 : 5} className="p-6 text-center text-slate-400">
                    Nenhum poço adicionado. Clique no botão "Adicionar Poço" acima.
                  </td>
                </tr>
              ) : (
                formData.wells?.map((well, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td className="p-2">
                      <Input
                        value={well.well_id ?? ''}
                        onChange={(e) => handleWellFieldChange(index, 'well_id', e.target.value)}
                        disabled={isLocked}
                        placeholder="PZ-01"
                        className="h-9 text-xs font-semibold"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={well.depth ?? ''}
                        onChange={(e) => handleWellFieldChange(index, 'depth', e.target.value)}
                        disabled={isLocked}
                        placeholder="8.5"
                        className="h-9 text-xs font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="date"
                        value={well.completion_date ?? ''}
                        onChange={(e) =>
                          handleWellFieldChange(index, 'completion_date', e.target.value)
                        }
                        disabled={isLocked}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={well.diameter ?? ''}
                        onChange={(e) => handleWellFieldChange(index, 'diameter', e.target.value)}
                        disabled={isLocked}
                        placeholder="4 pol."
                        className="h-9 text-xs"
                      />
                    </td>
                    {!isLocked && (
                      <td className="p-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveWell(index)}
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50"
                          title="Remover poço"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. REGISTRO FOTOGRÁFICO */}
      <section className="epa-card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeader
            icon={Camera}
            title="4. Registro Fotográfico"
            subtitle="Fotos de campo com legendas (aparecem fielmente distribuídas no PDF do RDO)"
          />
          {!isLocked && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleAddPhotoFiles}
                multiple
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-fit text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[40px]"
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Adicionar Fotos
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
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
            )
          })}

          {!isLocked && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-slate-500 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-700 transition dark:border-slate-800 dark:hover:bg-slate-900/50"
            >
              <Camera className="h-8 w-8 mb-2 text-slate-400" />
              <span className="text-xs font-semibold">Adicionar nova fotografia</span>
              <span className="text-[10px] text-slate-400 mt-1">
                Formatos JPG, PNG (Câmera ou Arquivo)
              </span>
            </button>
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
            <label className="epa-label">Acidentes / Incidentes</label>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.accidents ?? ''}
              onChange={(e) => handleFieldChange('accidents', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Interferências / Dificuldades</label>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.interferences ?? ''}
              onChange={(e) => handleFieldChange('interferences', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Mudanças no Plano de Trabalho</label>
            <Input
              placeholder="Ex.: Não houve"
              value={formData.planChanges ?? ''}
              onChange={(e) => handleFieldChange('planChanges', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Tempo de Espera</label>
            <Input
              placeholder="Ex.: Sem ocorrências ou 00h30"
              value={formData.timeWaiting ?? ''}
              onChange={(e) => handleFieldChange('timeWaiting', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Tempo de Deslocamento</label>
            <Input
              placeholder="Ex.: 00h00 ou 01h20"
              value={formData.timeDisplacement ?? ''}
              onChange={(e) => handleFieldChange('timeDisplacement', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
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
              ? 'Este RDO já foi aprovado e está bloqueado para modificações.'
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
                Salvar e Enviar RDO
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Devolução modal */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">Devolver RDO para Correção</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Descreva as correções necessárias que o técnico/operador deve realizar.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="mt-4 min-h-[120px] dark:border-slate-800 dark:bg-slate-950"
              placeholder="Ex.: Favor conferir a profundidade do PZ-02 e anexar a foto da leitura final do hidrômetro."
            />
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

  // Lista de poços: cadastrados no relatório ou modelo oficial
  const wellsList =
    report.wells && report.wells.length > 0
      ? report.wells
      : [
          { id: '1', well_id: 'AS-26', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '2', well_id: 'AS-27', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '3', well_id: 'AS-28', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '4', well_id: 'AS-29', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '5', well_id: 'AS-30', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '6', well_id: 'AS-31', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '7', well_id: 'AS-32', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '8', well_id: 'AS-33', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '9', well_id: 'AS-34', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '10', well_id: 'AS-35', depth: '', completion_date: '', diameter: '1/2"' },
          { id: '11', well_id: 'PB-127', depth: '', completion_date: '', diameter: '4"' },
          { id: '12', well_id: 'PB-128', depth: '', completion_date: '', diameter: '4"' },
          { id: '13', well_id: 'PB-129', depth: '', completion_date: '', diameter: '4"' },
          { id: '14', well_id: 'PB-130', depth: '', completion_date: '', diameter: '4"' },
          { id: '15', well_id: 'PB-131', depth: '', completion_date: '', diameter: '4"' },
          { id: '16', well_id: 'PB-132', depth: '', completion_date: '', diameter: '4"' },
          { id: '17', well_id: 'PB-134', depth: '', completion_date: '', diameter: '4"' },
          { id: '18', well_id: 'PB-136', depth: '', completion_date: '', diameter: '4"' },
          { id: '19', well_id: 'PB-137', depth: '', completion_date: '', diameter: '4"' },
          { id: '20', well_id: 'PB-138', depth: '', completion_date: '', diameter: '4"' },
          { id: '21', well_id: 'PB-140', depth: '', completion_date: '', diameter: '4"' },
          { id: '22', well_id: 'PB-141', depth: '', completion_date: '', diameter: '4"' },
          { id: '23', well_id: 'PB-25', depth: '', completion_date: '', diameter: '4"' },
          { id: '24', well_id: 'PB-26', depth: '', completion_date: '', diameter: '4"' },
          { id: '25', well_id: 'PB-27', depth: '', completion_date: '', diameter: '4"' },
          { id: '26', well_id: 'PB-28', depth: '', completion_date: '', diameter: '4"' },
          { id: '27', well_id: 'PB-29', depth: '', completion_date: '', diameter: '2"' },
          { id: '28', well_id: 'PB-30', depth: '', completion_date: '', diameter: '4"' },
          { id: '29', well_id: 'PB-31', depth: '', completion_date: '', diameter: '4"' },
          { id: '30', well_id: 'PB-33', depth: '', completion_date: '', diameter: '4"' },
          { id: '31', well_id: 'PB-34', depth: '', completion_date: '', diameter: '4"' },
          { id: '32', well_id: 'PB-35', depth: '', completion_date: '', diameter: '4"' },
          { id: '33', well_id: 'PB-36', depth: '', completion_date: '', diameter: '4"' },
          {
            id: '34',
            well_id: 'PB-37',
            depth: '28,00',
            completion_date: '27/05/2026',
            diameter: '4"',
          },
          {
            id: '35',
            well_id: 'PB-38',
            depth: '28,01',
            completion_date: '27/05/2026',
            diameter: '4"',
          },
          {
            id: '36',
            well_id: 'PB-39',
            depth: '28,00',
            completion_date: '27/05/2026',
            diameter: '4"',
          },
          {
            id: '37',
            well_id: 'PB-40',
            depth: '28,03',
            completion_date: '27/05/2026',
            diameter: '4"',
          },
          { id: '38', well_id: 'PB-41', depth: '', completion_date: '', diameter: '4"' },
          {
            id: '39',
            well_id: 'PB-42',
            depth: '28,06',
            completion_date: '26/05/2026',
            diameter: '4"',
          },
          { id: '40', well_id: 'PM-18', depth: '', completion_date: '', diameter: '2"' },
          { id: '41', well_id: 'PM-19', depth: '', completion_date: '', diameter: '2"' },
          { id: '42', well_id: 'PM-20', depth: '', completion_date: '', diameter: '2"' },
          { id: '43', well_id: 'PM-21', depth: '', completion_date: '', diameter: '2"' },
          { id: '44', well_id: 'PM-37', depth: '', completion_date: '', diameter: '2"' },
          { id: '45', well_id: 'PM-38', depth: '', completion_date: '', diameter: '2"' },
          { id: '46', well_id: 'PM-48', depth: '', completion_date: '', diameter: '2"' },
          { id: '47', well_id: 'PM-49', depth: '', completion_date: '', diameter: '2"' },
          { id: '48', well_id: 'PM-51', depth: '', completion_date: '', diameter: '2"' },
          { id: '49', well_id: 'PM-52', depth: '', completion_date: '', diameter: '2"' },
          { id: '50', well_id: 'PM-53', depth: '', completion_date: '', diameter: '2"' },
        ]

  // Divide poços em 2 páginas de tabela (como no modelo oficial, ~25 por folha)
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

    <!-- PÁGINA 2: TABELA DE POÇOS PARTE 1 -->
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
    <!-- PÁGINA 3: TABELA DE POÇOS PARTE 2 -->
    <div class="rdo-page">
      ${renderPageHeader()}
      <div class="rdo-page-content">
        ${renderWellsTable(wellsPage2)}
      </div>
      ${renderPageFooter()}
    </div>
    `
        : ''
    }

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
