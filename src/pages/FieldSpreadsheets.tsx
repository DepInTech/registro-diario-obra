import { useMemo, useState, useEffect } from 'react'
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
  X,
  RotateCcw,
} from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { offlineStorage, OfflineFieldSheetItem } from '@/services/offlineStorage'
import { authHeaders, exportUrl, updateFieldStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { fieldSheets as mockFieldSheets, type Status } from '@/data/epa'

export function FieldSpreadsheets({ query }: { query: string }) {
  const [editing, setEditing] = useState<OfflineFieldSheetItem | null>(null)
  const [items, setItems] = useState<OfflineFieldSheetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
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
            expand: 'project,operator',
          })

          for (const rec of records) {
            const existing = localSheets.find((l) => l.id === rec.id)
            if (!existing || existing.syncStatus === 'synced') {
              const proj = rec.expand?.project as any
              const op = rec.expand?.operator as any

              const item: OfflineFieldSheetItem = {
                id: rec.id,
                projectId: rec.project,
                projectName: proj?.name || 'Recuperação Ambiental Lote A',
                date: rec.date ? rec.date.slice(0, 10) : '2025-05-28',
                area: rec.area || 'Lote A — Setor Leste',
                operator: rec.operator,
                operatorName: op?.name || 'Carlos Oliveira',
                weather: rec.weather || 'Sol',
                pluviometer: rec.pluviometer || 0,
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
            date: '2025-05-28',
            area: m.area,
            operator: user?.id || 'cfpekk93zx4j1pr',
            operatorName: m.operator,
            weather: 'Sol',
            pluviometer: 0,
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
  }, [])

  const filtered = items.filter(
    (s) =>
      (filter === 'all' || s.status === filter) &&
      `${s.projectName} ${s.area} ${s.date}`.toLowerCase().includes(query.toLowerCase()),
  )

  const openNew = () => {
    const newSheet: OfflineFieldSheetItem = {
      id: 'field_' + Date.now(),
      projectId: '6699p05pm2uv1x2',
      projectName: 'Recuperação Ambiental Lote A',
      date: new Date().toISOString().slice(0, 10),
      area: 'Lote A — Setor Leste',
      operator: user?.id || 'cfpekk93zx4j1pr',
      operatorName: user?.name || 'Carlos Oliveira',
      weather: 'Sol',
      pluviometer: 0,
      extraction_data: [{ well: 'PB-127', morning: '0', afternoon: '0', pump: '0', autopump: '0' }],
      infiltration_data: {
        geralMorning: '0',
        geralAfternoon: '0',
        out1Morning: '0',
        out1Afternoon: '0',
      },
      nutrient_done: false,
      nutrient_map_kg: 0,
      nutrient_ureia_kg: 0,
      compressor_data: { pressure1: '7.0 bar', pressure2: '7.0 bar' },
      oil_removal_data: { sao1Volume: '0', sao2Volume: '0' },
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
      />
    )
  }

  return (
    <div className="space-y-6">
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
                <button
                  onClick={() => {
                    setEditing(sheet)
                    setIsNew(false)
                  }}
                  key={sheet.id}
                  className="group rounded-2xl border border-slate-200/80 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
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
                      Abrir Planilha →
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

function FieldFullEditor({
  sheet: initialSheet,
  isNew,
  onBack,
  onSaved,
}: {
  sheet: OfflineFieldSheetItem
  isNew: boolean
  onBack: () => void
  onSaved: () => void
}) {
  const [formData, setFormData] = useState<OfflineFieldSheetItem>({ ...initialSheet })
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(initialSheet.reviewNotes || '')

  const { user, setHasUnsavedChanges } = useAuth()
  const { isOnline, syncNow } = useSync()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isLocked = formData.status === 'approved' && !isAdmin

  const handleFieldChange = (field: keyof OfflineFieldSheetItem, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasUnsavedChanges(true)
  }

  // Extraction wells handlers
  const handleAddExtractionWell = () => {
    const nextNum = (formData.extraction_data?.length || 0) + 127
    const newRow = {
      well: `PB-${nextNum}`,
      morning: '0',
      afternoon: '0',
      pump: '0',
      autopump: '0',
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
        description: isOnline
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

  const isTechnician = user?.role === 'technician'
  const canExportExcel = isAdmin || isTechnician

  // Excel Export (Admin e Técnico têm permissão de exportar/visualizar planilha)
  const handleExportExcel = async () => {
    if (!canExportExcel) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Exportação permitida para Administradores e Técnicos.',
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {!isLocked && (
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
                Enviar para Aprovação
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

      {/* 1. IDENTIFICAÇÃO DA OPERAÇÃO */}
      <section className="epa-card p-6">
        <SectionHeader
          icon={FileSpreadsheet}
          title="1. Identificação da Operação em Campo"
          subtitle="Projeto, setor, responsável e parâmetros meteorológicos"
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="epa-label">Projeto</label>
            <Input
              value={formData.projectName}
              onChange={(e) => handleFieldChange('projectName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Data</label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Área / Setor</label>
            <Input
              value={formData.area}
              onChange={(e) => handleFieldChange('area', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Operador Responsável</label>
            <Input
              value={formData.operatorName || ''}
              onChange={(e) => handleFieldChange('operatorName', e.target.value)}
              disabled={isLocked}
              className="mt-1.5"
            />
          </div>
          <div>
            <label className="epa-label">Clima</label>
            <select
              value={formData.weather || 'Sol'}
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
            <label className="epa-label">Pluviômetro (mm)</label>
            <Input
              type="number"
              value={formData.pluviometer || 0}
              onChange={(e) => handleFieldChange('pluviometer', Number(e.target.value))}
              disabled={isLocked}
              className="mt-1.5 font-mono"
            />
          </div>
        </div>
      </section>

      {/* 2. EXTRAÇÃO E INFILTRAÇÃO */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="epa-card p-6">
          <div className="flex items-center justify-between">
            <SectionHeader
              icon={Droplets}
              title="2. Extração / Volume Bombeado"
              subtitle="Leituras de hidrômetros e bombas"
            />
            {!isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddExtractionWell}
                className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 min-h-[38px]"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Poço
              </Button>
            )}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="p-2.5">Poço</th>
                  <th className="p-2.5">Hidrômetro Manhã</th>
                  <th className="p-2.5">Hidrômetro Tarde</th>
                  <th className="p-2.5">Bomba</th>
                  <th className="p-2.5">Auto Bomba</th>
                  {!isLocked && <th className="p-2.5 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {formData.extraction_data?.map((row, index) => (
                  <tr key={index}>
                    <td className="p-1.5">
                      <Input
                        value={row.well}
                        onChange={(e) => handleExtractionCellChange(index, 'well', e.target.value)}
                        disabled={isLocked}
                        className="h-8 font-semibold text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={row.morning}
                        onChange={(e) =>
                          handleExtractionCellChange(index, 'morning', e.target.value)
                        }
                        disabled={isLocked}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={row.afternoon}
                        onChange={(e) =>
                          handleExtractionCellChange(index, 'afternoon', e.target.value)
                        }
                        disabled={isLocked}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={row.pump}
                        onChange={(e) => handleExtractionCellChange(index, 'pump', e.target.value)}
                        disabled={isLocked}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <Input
                        value={row.autopump}
                        onChange={(e) =>
                          handleExtractionCellChange(index, 'autopump', e.target.value)
                        }
                        disabled={isLocked}
                        className="h-8 font-mono text-xs"
                      />
                    </td>
                    {!isLocked && (
                      <td className="p-1.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveExtractionWell(index)}
                          className="h-7 w-7 text-red-500"
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

        <section className="epa-card p-6">
          <SectionHeader
            icon={Gauge}
            title="3. Infiltração Geral e Saídas"
            subtitle="Medições de vazão de infiltração na área"
          />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="epa-label">Geral — Manhã</label>
              <Input
                value={formData.infiltration_data?.geralMorning || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    geralMorning: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Geral — Tarde</label>
              <Input
                value={formData.infiltration_data?.geralAfternoon || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    geralAfternoon: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Saída 01 — Manhã</label>
              <Input
                value={formData.infiltration_data?.out1Morning || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    out1Morning: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Saída 01 — Tarde</label>
              <Input
                value={formData.infiltration_data?.out1Afternoon || ''}
                onChange={(e) =>
                  handleFieldChange('infiltration_data', {
                    ...formData.infiltration_data,
                    out1Afternoon: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-emerald-50/60 p-4 border border-emerald-200 dark:border-emerald-800 dark:bg-emerald-950/30">
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Controle Operacional de Infiltração
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Manter o registro diário regular conforme diretrizes da licença ambiental.
            </p>
          </div>
        </section>
      </div>

      {/* 3. DOSAGEM DE NUTRIENTES, COMPRESSORES E ÓLEO */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Nutrientes */}
        <section className="epa-card p-6">
          <SectionHeader icon={TestTubes} title="Dosagem de Nutrientes" />
          <div className="mt-5 flex items-center justify-between rounded-xl bg-emerald-50 p-3.5 border border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900">
            <div>
              <p className="text-xs font-semibold">Aplicação Realizada</p>
              <p className="text-[10px] text-slate-500">MAP e Ureia</p>
            </div>
            <Switch
              checked={formData.nutrient_done || false}
              onCheckedChange={(c) => handleFieldChange('nutrient_done', c)}
              disabled={isLocked}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="epa-label">MAP (kg)</label>
              <Input
                type="number"
                value={formData.nutrient_map_kg || 0}
                onChange={(e) => handleFieldChange('nutrient_map_kg', Number(e.target.value))}
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Ureia (kg)</label>
              <Input
                type="number"
                value={formData.nutrient_ureia_kg || 0}
                onChange={(e) => handleFieldChange('nutrient_ureia_kg', Number(e.target.value))}
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-4 dark:border-slate-800">
            <span className="text-xs text-slate-500">Total Aplicado</span>
            <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400">
              {nutrientTotal} kg
            </span>
          </div>
        </section>

        {/* Compressores */}
        <section className="epa-card p-6">
          <SectionHeader icon={Settings2} title="Compressores" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className="epa-label">Pressão 01</label>
              <Input
                value={formData.compressor_data?.pressure1 || '7,2 bar'}
                onChange={(e) =>
                  handleFieldChange('compressor_data', {
                    ...formData.compressor_data,
                    pressure1: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Pressão 02</label>
              <Input
                value={formData.compressor_data?.pressure2 || '7,0 bar'}
                onChange={(e) =>
                  handleFieldChange('compressor_data', {
                    ...formData.compressor_data,
                    pressure2: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> Óleo 01 OK
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-3 w-3" /> Óleo 02 OK
            </span>
          </div>
        </section>

        {/* Remoção de Óleo */}
        <section className="epa-card p-6">
          <SectionHeader icon={Recycle} title="Remoção de Óleo / SAO" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <label className="epa-label">SAO 01 (L)</label>
              <Input
                value={formData.oil_removal_data?.sao1Volume || '2,5'}
                onChange={(e) =>
                  handleFieldChange('oil_removal_data', {
                    ...formData.oil_removal_data,
                    sao1Volume: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">SAO 02 (L)</label>
              <Input
                value={formData.oil_removal_data?.sao2Volume || '1,2'}
                onChange={(e) =>
                  handleFieldChange('oil_removal_data', {
                    ...formData.oil_removal_data,
                    sao2Volume: e.target.value,
                  })
                }
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
          </div>
        </section>
      </div>

      {/* 4. RESÍDUOS E CONTROLE AMBIENTAL */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="epa-card p-6">
          <SectionHeader icon={Recycle} title="Resíduos Gerados" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div>
              <label className="epa-label">Resíduos Líquidos (L)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.waste_liquid_qty || 0}
                onChange={(e) => handleFieldChange('waste_liquid_qty', Number(e.target.value))}
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <label className="epa-label">Resíduos Sólidos (kg)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.waste_solid_qty || 0}
                onChange={(e) => handleFieldChange('waste_solid_qty', Number(e.target.value))}
                disabled={isLocked}
                className="mt-1 font-mono"
              />
            </div>
          </div>
        </section>

        <section className="epa-card p-6">
          <SectionHeader icon={Leaf} title="Controles Ambientais" />
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold">Verificação 5S da Área</p>
                <p className="text-[10px] text-slate-500">
                  Organização, limpeza e sinalização da planta
                </p>
              </div>
              <Switch
                checked={formData.env_5s_check || false}
                onCheckedChange={(c) => handleFieldChange('env_5s_check', c)}
                disabled={isLocked}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold">Checklist Ambiental Mensal</p>
                <p className="text-[10px] text-slate-500">Conformidade documental e operacional</p>
              </div>
              <Switch
                checked={formData.env_checklist_monthly || false}
                onCheckedChange={(c) => handleFieldChange('env_checklist_monthly', c)}
                disabled={isLocked}
              />
            </div>
          </div>
        </section>
      </div>

      {/* 5. OBSERVAÇÕES */}
      <section className="epa-card p-6">
        <SectionHeader icon={Eye} title="Observações Gerais da Planilha" />
        <Textarea
          value={formData.observations || ''}
          onChange={(e) => handleFieldChange('observations', e.target.value)}
          disabled={isLocked}
          placeholder="Registre ocorrências técnicas, inspeções preventivas e observações pertinentes..."
          className="mt-4 min-h-[100px]"
        />
      </section>

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
  let extractionRows = ''
  if (sheet.extraction_data && sheet.extraction_data.length > 0) {
    sheet.extraction_data.forEach((r) => {
      extractionRows += `<tr>
        <td style="border:1px solid #999;padding:6px;">${r.well || '—'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.morning || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.afternoon || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.pump || '0'}</td>
        <td style="border:1px solid #999;padding:6px;">${r.autopump || '0'}</td>
      </tr>`
    })
  }

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
      th { background-color: #086B63; color: #ffffff; border: 1px solid #999; padding: 7px; }
      td { border: 1px solid #999; padding: 6px; }
      .header-title { background-color: #086B63; color: #ffffff; font-size: 14px; font-weight: bold; text-align: center; }
      .section-hdr { background-color: #e6f5f3; color: #086B63; font-weight: bold; }
      .label-col { background-color: #f0fdfa; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td colspan="5" style="background-color: #044741; color: #ffffff; padding: 14px; text-align: center;">
          <div style="font-size: 16px; font-weight: bold; letter-spacing: 1px;">GRUPO EPA</div>
          <div style="font-size: 11px; margin-top: 4px; color: #a7f3d0;">SISTEMA INTEGRADO DE GESTÃO AMBIENTAL</div>
        </td>
      </tr>
      <tr>
        <td colspan="5" class="header-title" style="padding: 10px;">PLANILHA DE CAMPO & CONTROLE OPERACIONAL</td>
      </tr>
      <tr>
        <td class="label-col">Projeto</td>
        <td colspan="2">${sheet.projectName}</td>
        <td class="label-col">Data</td>
        <td>${sheet.date}</td>
      </tr>
      <tr>
        <td class="label-col">Área</td>
        <td colspan="2">${sheet.area}</td>
        <td class="label-col">Operador</td>
        <td>${sheet.operatorName || 'Carlos Oliveira'}</td>
      </tr>
      <tr>
        <td class="label-col">Clima</td>
        <td colspan="2">${sheet.weather || 'Sol'}</td>
        <td class="label-col">Pluviômetro</td>
        <td>${sheet.pluviometer || 0} mm</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">EXTRAÇÃO / VOLUME BOMBEADO</td>
      </tr>
      <tr>
        <th>Poço</th>
        <th>Hidrômetro Manhã</th>
        <th>Hidrômetro Tarde</th>
        <th>Bomba</th>
        <th>Auto Bomba</th>
      </tr>
      ${extractionRows}
      <tr>
        <td colspan="5" class="section-hdr">INFILTRAÇÃO</td>
      </tr>
      <tr>
        <td class="label-col">Geral Manhã</td>
        <td>${sheet.infiltration_data?.geralMorning || '—'}</td>
        <td class="label-col">Geral Tarde</td>
        <td colspan="2">${sheet.infiltration_data?.geralAfternoon || '—'}</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">DOSAGEM DE NUTRIENTES</td>
      </tr>
      <tr>
        <td class="label-col">MAP (kg)</td>
        <td>${sheet.nutrient_map_kg || 0}</td>
        <td class="label-col">Ureia (kg)</td>
        <td>${sheet.nutrient_ureia_kg || 0}</td>
        <td><b>Total: ${(sheet.nutrient_map_kg || 0) + (sheet.nutrient_ureia_kg || 0)} kg</b></td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">COMPRESSORES & SAO</td>
      </tr>
      <tr>
        <td class="label-col">Pressão 01</td>
        <td>${sheet.compressor_data?.pressure1 || '7,2 bar'}</td>
        <td class="label-col">Pressão 02</td>
        <td colspan="2">${sheet.compressor_data?.pressure2 || '7,0 bar'}</td>
      </tr>
      <tr>
        <td class="label-col">SAO 01 (L)</td>
        <td>${sheet.oil_removal_data?.sao1Volume || '2,5'}</td>
        <td class="label-col">SAO 02 (L)</td>
        <td colspan="2">${sheet.oil_removal_data?.sao2Volume || '1,2'}</td>
      </tr>
      <tr>
        <td colspan="5" class="section-hdr">CONTROLE AMBIENTAL & OBSERVAÇÕES</td>
      </tr>
      <tr>
        <td class="label-col">5S</td>
        <td>${sheet.env_5s_check ? 'Conforme' : 'Pendente'}</td>
        <td class="label-col">Checklist</td>
        <td colspan="2">${sheet.env_checklist_monthly ? 'Conforme' : 'Pendente'}</td>
      </tr>
      <tr>
        <td class="label-col">Observações</td>
        <td colspan="4">${sheet.observations || '—'}</td>
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
