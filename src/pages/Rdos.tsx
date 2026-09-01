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

export function RdosPage({ query }: { query: string }) {
  const [editing, setEditing] = useState<OfflineRdoItem | null>(null)
  const [items, setItems] = useState<OfflineRdoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  const loadRdos = async () => {
    setLoading(true)
    try {
      // 1. Load from IndexedDB
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
                photos: photos.map((p) => ({
                  id: p.id,
                  image: p.image,
                  caption: p.caption,
                  order: p.order,
                })),
                syncStatus: 'synced',
                lastModified: new Date(rec.updated).getTime(),
                serverUpdatedAt: rec.updated,
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
              },
              {
                id: 'p2',
                caption: 'Condição da bomba pneumática',
                order: 1,
                image: 'https://img.usecurling.com/p/640/420?q=water%20pump',
              },
            ],
            syncStatus: 'synced',
            lastModified: Date.now(),
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

  const filtered = items.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      `${r.number} ${r.projectName} ${r.activityTitle}`.toLowerCase().includes(query.toLowerCase()),
  )

  const openNew = () => {
    const nextNum = items.length > 0 ? Math.max(...items.map((i) => i.number)) + 1 : 1
    const newReport: OfflineRdoItem = {
      id: 'rdo_' + Date.now(),
      number: nextNum,
      projectId: '6699p05pm2uv1x2',
      projectName: 'Recuperação Ambiental Lote A',
      clientName: 'Petrobras — Refinaria Sul',
      contractCode: 'CT-EPA-2025-017',
      companyName: 'EPA Gestão Ambiental',
      location: 'Refinaria Sul — Área Industrial',
      reportDate: new Date().toISOString().slice(0, 10),
      weather: 'Sol',
      performedBy: user?.id || '',
      performedByName: user?.name || 'Carlos Oliveira',
      supervisedBy: '2n6he1v3guzt3yt',
      supervisedByName: 'Marina Santos',
      activityTitle: '',
      activityDescription: '',
      timeDisplacement: '00h00',
      timeWaiting: 'Sem ocorrências',
      interferences: 'Não houve',
      planChanges: 'Não houve',
      accidents: 'Não houve',
      status: 'draft',
      wells: [
        {
          well_id: 'PZ-01',
          depth: 8.5,
          completion_date: new Date().toISOString().slice(0, 10),
          diameter: '4 pol.',
        },
      ],
      photos: [],
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
      />
    )
  }

  const counts = {
    draft: items.filter((r) => r.status === 'draft').length,
    submitted: items.filter((r) => r.status === 'submitted').length,
    approved: items.filter((r) => r.status === 'approved').length,
    returned: items.filter((r) => r.status === 'returned').length,
  }

  return (
    <div className="space-y-6">
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
                        Abrir / Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
}: {
  report: OfflineRdoItem
  isNew: boolean
  onBack: () => void
  onSaved: () => void
}) {
  const [formData, setFormData] = useState<OfflineRdoItem>({ ...initialReport })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(initialReport.reviewNotes || '')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // PDF Export
  const handleExportPdf = async () => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        description: 'Exportação de PDF oficial é exclusiva para Administradores.',
        variant: 'destructive',
      })
      return
    }

    setIsExporting(true)
    try {
      if (isOnline) {
        const res = await fetch(exportUrl('rdo', formData.id), { headers: authHeaders() })
        if (res.ok) {
          const html = await res.text()
          const popup = window.open('', '_blank')
          if (popup) {
            popup.document.write(html)
            popup.document.close()
            setTimeout(() => popup.print(), 400)
            toast({ title: 'PDF gerado com sucesso', description: 'Janela de impressão aberta.' })
            return
          }
        }
      }

      // Offline client-side HTML print generation matching official model
      generateLocalPdfPrint(formData)
      toast({
        title: 'PDF gerado localmente',
        description: 'Documento oficial gerado via IndexedDB.',
      })
    } catch (err) {
      console.error('PDF error:', err)
      toast({
        title: 'Não foi possível gerar o PDF',
        description: isOnline
          ? 'Erro de comunicação com o servidor.'
          : 'A exportação necessita de conexão com o servidor.',
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
          {isAdmin && (
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
                  Exportar PDF (Admin)
                </span>
              )}
            </Button>
          )}

          {!isLocked && (
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

          {isAdmin && formData.status === 'submitted' && (
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
              value={formData.clientName || 'Petrobras — Refinaria Sul'}
              onChange={(e) => handleFieldChange('clientName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Contrato</label>
            <Input
              value={formData.contractCode || 'CT-EPA-2025-017'}
              onChange={(e) => handleFieldChange('contractCode', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Local</label>
            <Input
              value={formData.location || 'Refinaria Sul — Área Industrial'}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Projeto EPA</label>
            <Input
              value={formData.projectName || 'Recuperação Ambiental Lote A'}
              onChange={(e) => handleFieldChange('projectName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Empresa Executora</label>
            <Input
              value={formData.companyName || 'EPA Gestão Ambiental'}
              onChange={(e) => handleFieldChange('companyName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Data do Relatório</label>
            <Input
              type="date"
              value={formData.reportDate}
              onChange={(e) => handleFieldChange('reportDate', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Clima</label>
            <select
              value={formData.weather}
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
              value={formData.number}
              onChange={(e) => handleFieldChange('number', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1.5 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Realizado por (Operador/Executor)</label>
            <Input
              value={formData.performedByName || ''}
              onChange={(e) => handleFieldChange('performedByName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Supervisionado por (Técnico/Responsável)</label>
            <Input
              value={formData.supervisedByName || ''}
              onChange={(e) => handleFieldChange('supervisedByName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
        </div>
      </section>

      {/* 2. ATIVIDADE E DESCRIÇÃO */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={Wrench}
          title="2. Atividade e Descrição dos Serviços"
          subtitle="Resumo e detalhamento técnico das tarefas realizadas em campo"
        />
        <div className="mt-5 space-y-4">
          <div>
            <label className="epa-label">Título da Atividade *</label>
            <Input
              placeholder="Ex.: Tamponamento de poços de monitoramento ou Operação de Extração"
              value={formData.activityTitle}
              onChange={(e) => handleFieldChange('activityTitle', e.target.value)}
              disabled={isLocked}
              className="mt-1.5 font-medium"
            />
          </div>
          <div>
            <label className="epa-label">Descrição da Atividade</label>
            <Textarea
              placeholder="Descreva minuciosamente os serviços executados, maquinário, equipe, horários e procedimentos adotados..."
              value={formData.activityDescription}
              onChange={(e) => handleFieldChange('activityDescription', e.target.value)}
              disabled={isLocked}
              className="epa-textarea min-h-[140px]"
            />
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
                        value={well.well_id}
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
                        value={well.depth || ''}
                        onChange={(e) => handleWellFieldChange(index, 'depth', e.target.value)}
                        disabled={isLocked}
                        placeholder="8.5"
                        className="h-9 text-xs font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="date"
                        value={well.completion_date || ''}
                        onChange={(e) =>
                          handleWellFieldChange(index, 'completion_date', e.target.value)
                        }
                        disabled={isLocked}
                        className="h-9 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={well.diameter || ''}
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
                    value={photo.caption}
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
              value={formData.accidents || 'Não houve'}
              onChange={(e) => handleFieldChange('accidents', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Interferências / Dificuldades</label>
            <Input
              value={formData.interferences || 'Não houve'}
              onChange={(e) => handleFieldChange('interferences', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Mudanças no Plano de Trabalho</label>
            <Input
              value={formData.planChanges || 'Não houve'}
              onChange={(e) => handleFieldChange('planChanges', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Tempo de Espera</label>
            <Input
              value={formData.timeWaiting || 'Sem ocorrências'}
              onChange={(e) => handleFieldChange('timeWaiting', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="epa-label">Tempo de Deslocamento</label>
            <Input
              value={formData.timeDisplacement || '01h20'}
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

  const logoUrl =
    'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/9fd27c13-4b57-4495-a17d-d514629fc46c/logo-epa-f4060.png'

  let wellsRows = ''
  if (report.wells && report.wells.length > 0) {
    report.wells.forEach((w) => {
      wellsRows += `<tr>
        <td style="border:1px solid #9ca3af;padding:6px;font-weight:600;">${w.well_id || '—'}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.depth ? w.depth + ' m' : '—'}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.completion_date || '—'}</td>
        <td style="border:1px solid #9ca3af;padding:6px;">${w.diameter || '—'}</td>
      </tr>`
    })
  } else {
    wellsRows = `<tr><td colspan="4" style="border:1px solid #9ca3af;padding:8px;text-align:center;">Nenhum poço registrado.</td></tr>`
  }

  let photoCards = ''
  if (report.photos && report.photos.length > 0) {
    report.photos.forEach((p, idx) => {
      const src =
        p.dataUrl ||
        (p.image?.startsWith('http')
          ? p.image
          : p.image
            ? `${pb.baseUrl}/api/files/report_photos/${p.id}/${p.image}`
            : 'https://img.usecurling.com/p/640/420?q=monitoring%20well')
      photoCards += `<figure style="border:1px solid #9ca3af;padding:6px;margin:0;break-inside:avoid;page-break-inside:avoid;">
        <img src="${src}" style="width:100%;height:180px;object-fit:cover;display:block;" />
        <figcaption style="padding:6px;text-align:center;font-size:10px;font-weight:500;">
          <b>Foto ${idx + 1}:</b> ${p.caption || 'Registro fotográfico de campo'}
        </figcaption>
      </figure>`
    })
  } else {
    photoCards = `<p style="border:1px solid #9ca3af;padding:12px;text-align:center;font-size:11px;grid-column:1/-1;">Sem registros fotográficos adicionados.</p>`
  }

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>RDO Nº ${report.number} — EPA Gestão</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 26mm 14mm 16mm 14mm;
        @top-center {
          content: element(pageHeader);
        }
      }
      * { box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        font-size: 11px;
        color: #1f2937;
        margin: 0;
        padding: 0;
      }
      .page-header {
        position: fixed;
        top: -22mm;
        left: 0;
        right: 0;
        height: 18mm;
        border-bottom: 2px solid #064e3b;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .page-header img {
        height: 42px;
        width: auto;
      }
      .page-header .doc-id {
        text-align: right;
        font-size: 9px;
        color: #064e3b;
        font-weight: bold;
      }
      .main-title {
        background: #064e3b;
        color: #ffffff;
        text-align: center;
        padding: 8px;
        font-size: 14px;
        font-weight: bold;
        letter-spacing: 0.5px;
        margin: 0 0 8px 0;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .grid-cell {
        border: 1px solid #9ca3af;
        padding: 6px;
        min-height: 32px;
      }
      .grid-cell b {
        display: block;
        font-size: 8px;
        text-transform: uppercase;
        color: #064e3b;
        margin-bottom: 2px;
      }
      .section-block {
        margin-top: 8px;
        break-inside: avoid;
      }
      .section-block h3 {
        margin: 0;
        background: #e6f4ea;
        color: #064e3b;
        border: 1px solid #8cb8b3;
        padding: 5px 8px;
        font-size: 10px;
        text-transform: uppercase;
      }
      .text-box {
        border: 1px solid #9ca3af;
        border-top: none;
        padding: 8px;
        min-height: 44px;
        white-space: pre-wrap;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th {
        background: #e6f4ea;
        color: #064e3b;
        border: 1px solid #9ca3af;
        padding: 6px;
        font-size: 9px;
        text-transform: uppercase;
      }
      .photos-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        border: 1px solid #9ca3af;
        border-top: none;
        padding: 8px;
      }
      .signatures {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        margin-top: 30px;
        break-inside: avoid;
      }
      .sign-box {
        text-align: center;
        border-top: 1px solid #374151;
        padding-top: 6px;
        font-size: 10px;
      }
    </style>
  </head>
  <body>
    <div class="page-header">
      <img src="${logoUrl}" alt="EPA Logo" />
      <div class="doc-id">
        RELATÓRIO DIÁRIO DE OBRA<br />
        RDO Nº ${String(report.number).padStart(3, '0')}
      </div>
    </div>

    <h1 class="main-title">RELATÓRIO DIÁRIO DE ACOMPANHAMENTO DE OBRAS</h1>

    <div class="grid-2">
      <div class="grid-cell"><b>Cliente</b>${report.clientName || 'Petrobras — Refinaria Sul'}</div>
      <div class="grid-cell"><b>Contrato</b>${report.contractCode || 'CT-EPA-2025-017'}</div>
      <div class="grid-cell"><b>Local</b>${report.location || 'Refinaria Sul — Área Industrial'}</div>
      <div class="grid-cell"><b>Projeto EPA</b>${report.projectName || 'Recuperação Ambiental Lote A'}</div>
      <div class="grid-cell"><b>Empresa Executora</b>${report.companyName || 'EPA Gestão Ambiental'}</div>
      <div class="grid-cell"><b>Data / Clima</b>${report.reportDate} · ${report.weather}</div>
      <div class="grid-cell"><b>Realizado por</b>${report.performedByName || 'Carlos Oliveira'}</div>
      <div class="grid-cell"><b>Supervisionado por</b>${report.supervisedByName || 'Marina Santos'}</div>
    </div>

    <div class="section-block">
      <h3>Atividade</h3>
      <div class="text-box">${report.activityTitle || '—'}</div>
    </div>

    <div class="section-block">
      <h3>Descrição da Atividade</h3>
      <div class="text-box">${report.activityDescription || '—'}</div>
    </div>

    <div class="section-block">
      <h3>Tabela de Poços</h3>
      <table>
        <thead>
          <tr>
            <th>ID do Poço</th>
            <th>Profundidade</th>
            <th>Data Conclusão</th>
            <th>Diâmetro</th>
          </tr>
        </thead>
        <tbody>
          ${wellsRows}
        </tbody>
      </table>
    </div>

    <div class="section-block">
      <h3>Registro Fotográfico</h3>
      <div class="photos-grid">
        ${photoCards}
      </div>
    </div>

    <div class="section-block">
      <h3>Observações Técnicas & Controle</h3>
      <table>
        <tr>
          <th style="width:35%;">Acidentes / Incidentes</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${report.accidents || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Interferências / Dificuldades</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${report.interferences || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Mudanças no Plano de Trabalho</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${report.planChanges || 'Não houve'}</td>
        </tr>
        <tr>
          <th>Tempo de Espera / Deslocamento</th>
          <td style="border:1px solid #9ca3af;padding:6px;">${report.timeWaiting || 'Sem ocorrências'} · ${report.timeDisplacement || '01h20'}</td>
        </tr>
      </table>
    </div>

    <div class="signatures">
      <div class="sign-box">
        <b>${report.performedByName || 'Responsável pela Execução'}</b><br />
        Execução em Campo
      </div>
      <div class="sign-box">
        <b>${report.supervisedByName || 'Supervisão / Aprovação'}</b><br />
        Supervisão Técnica
      </div>
    </div>
  </body>
  </html>`

  popup.document.write(html)
  popup.document.close()
  setTimeout(() => popup.print(), 400)
}
