import { useState, useEffect, useMemo } from 'react'
import {
  Waves,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Send,
  FileDown,
  Settings,
  ShieldCheck,
  Layers,
  MapPin,
  Edit3,
  ArrowUp,
  ArrowDown,
  ListOrdered,
} from 'lucide-react'
import { printNaSheet, chunkInto4Columns, get4ColumnRows } from '@/services/naSheetExport'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { applyDateMask, isValidBrDate } from '@/lib/dateMask'
import { naConfigService, naSheetService } from '@/services/inSituAndNaService'
import type { NaAreaConfig, NaSheet, NaWellReadingRow } from '@/types/inSituAndNa'

const FIXED_WEATHER_CHOICES = ['Ensolarado', 'Chuvoso', 'Instável']

export function NaMonitoringPage({ query = '' }: { query?: string }) {
  const { user } = useAuth()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isTechnician = user?.role === 'technician'

  const [activeTab, setActiveTab] = useState<'sheets' | 'configs'>('sheets')
  const [sheets, setSheets] = useState<NaSheet[]>([])
  const [configs, setConfigs] = useState<NaAreaConfig[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Preenchimento de Planilha de NA
  const [selectedSheet, setSelectedSheet] = useState<NaSheet | null>(null)
  const [isEditingSheet, setIsEditingSheet] = useState(false)
  const [isCustomArea, setIsCustomArea] = useState(false)
  const [sheetFormData, setSheetFormData] = useState<Partial<NaSheet>>({
    contract_number: '',
    area_name: '',
    date: '',
    weather: 'Ensolarado',
    responsible_name: '',
    status: 'draft',
    notes: '',
    readings: [],
  })

  // Configuração de Área pelo Admin
  const [selectedConfig, setSelectedConfig] = useState<NaAreaConfig | null>(null)
  const [isEditingConfig, setIsEditingConfig] = useState(false)
  const [configFormData, setConfigFormData] = useState<Partial<NaAreaConfig>>({
    area_name: '',
    contract_number: '',
    description: '',
    wells: [],
    active: true,
  })

  const [newWellCodeInput, setNewWellCodeInput] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'sheet' | 'config'
    id: string
  } | null>(null)

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [allSheets, allConfigs] = await Promise.all([
        naSheetService.listSheets(),
        naConfigService.listConfigs(),
      ])
      setSheets(allSheets)
      setConfigs(allConfigs)
    } catch (err) {
      console.error('Erro ao carregar dados de NA:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as planilhas ou configurações de NA.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Filtragem
  const filteredSheets = useMemo(() => {
    if (!query) return sheets
    const q = query.toLowerCase()
    return sheets.filter(
      (s) =>
        s.area_name?.toLowerCase().includes(q) ||
        s.responsible_name?.toLowerCase().includes(q) ||
        s.date?.toLowerCase().includes(q),
    )
  }, [sheets, query])

  const filteredConfigs = useMemo(() => {
    if (!query) return configs
    const q = query.toLowerCase()
    return configs.filter(
      (c) =>
        c.area_name?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.wells?.some((w) => w.code.toLowerCase().includes(q)),
    )
  }, [configs, query])

  // ==========================================
  // FLUXO DO USUÁRIO / OPERADOR: NOVA PLANILHA
  // ==========================================
  const handleStartNewSheet = () => {
    if (configs.length === 0) {
      toast({
        title: 'Nenhuma área configurada',
        description:
          'O Administrador precisa cadastrar uma Área com sua lista de poços antes de iniciar a medição.',
        variant: 'destructive',
      })
      return
    }

    const today = new Date()
    const dStr = today.toLocaleDateString('pt-BR')
    const firstConfig = configs[0]

    // Popula poços da área selecionada com colunas em branco: NA (m), NO (m), Observação
    const initialReadings: NaWellReadingRow[] = (firstConfig.wells || []).map((w, idx) => ({
      id: `init_${idx}_${w.code}_${Date.now()}`,
      well_code: w.code,
      na_m: '',
      no_m: '',
      observation: '',
    }))

    setIsCustomArea(false)
    setSheetFormData({
      contract_number: firstConfig.contract_number || '',
      area_name: firstConfig.area_name,
      date: dStr,
      weather: 'Ensolarado',
      responsible_name: user?.name || '',
      status: 'draft',
      notes: '',
      readings: initialReadings,
    })
    setSelectedSheet(null)
    setIsEditingSheet(true)
  }

  const handleOpenSheet = (sheet: NaSheet) => {
    setSelectedSheet(sheet)
    const areaMatchesConfig = configs.some((c) => c.area_name === sheet.area_name)
    setIsCustomArea(!areaMatchesConfig && Boolean(sheet.area_name))
    setSheetFormData({
      contract_number: sheet.contract_number || '',
      area_name: sheet.area_name || '',
      date: sheet.date || '',
      weather: sheet.weather || 'Ensolarado',
      responsible_name: sheet.responsible_name || '',
      status: sheet.status || 'draft',
      notes: sheet.notes || '',
      readings: (sheet.readings || []).map((r, idx) => ({
        ...r,
        id: r.id || `row_${idx}_${r.well_code}_${Date.now()}`,
      })),
      id: sheet.id,
      client_token: sheet.client_token,
      archived: sheet.archived,
    })
    setIsEditingSheet(true)
  }

  // Quando o usuário seleciona uma área no preenchimento, carrega automaticamente os poços cadastrados pelo Admin como base inicial
  const handleAreaChangeInSheet = (newAreaName: string) => {
    const configFound = configs.find((c) => c.area_name === newAreaName)
    const newReadings: NaWellReadingRow[] = configFound
      ? (configFound.wells || []).map((w, idx) => {
          // Preserva leitura anterior se mesmo poço
          const prevReading = sheetFormData.readings?.find((r) => r.well_code === w.code)
          return {
            id: `base_${idx}_${w.code}_${Date.now()}`,
            well_code: w.code,
            na_m: prevReading?.na_m || '',
            no_m: prevReading?.no_m || '',
            observation: prevReading?.observation || '',
          }
        })
      : []

    setSheetFormData((prev) => ({
      ...prev,
      contract_number: configFound?.contract_number || prev.contract_number || '',
      area_name: newAreaName,
      readings: newReadings,
    }))
  }

  const handleUpdateReadingCell = (index: number, field: keyof NaWellReadingRow, value: string) => {
    setSheetFormData((prev) => {
      const updated = [...(prev.readings || [])]
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          [field]: value,
        }
      }
      return {
        ...prev,
        readings: updated,
      }
    })
  }

  // Ações dinâmicas de poços na planilha de NA
  const handleAddNewWellReading = () => {
    setSheetFormData((prev) => {
      const currentReadings = prev.readings || []
      // Sugere próximo número sequencial (ex: se tem PM-01 a PM-04, sugere PM-05)
      let nextWellCode = `PM-${String(currentReadings.length + 1).padStart(2, '0')}`
      let counter = currentReadings.length + 1
      while (
        currentReadings.some((r) => r.well_code.trim().toUpperCase() === nextWellCode.toUpperCase())
      ) {
        counter++
        nextWellCode = `PM-${String(counter).padStart(2, '0')}`
      }

      const newRow: NaWellReadingRow = {
        id: `well_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        well_code: nextWellCode,
        na_m: '',
        no_m: '',
        observation: '',
      }

      return {
        ...prev,
        readings: [...currentReadings, newRow],
      }
    })
  }

  const handleRemoveWellReading = (index: number) => {
    setSheetFormData((prev) => {
      const current = [...(prev.readings || [])]
      current.splice(index, 1)
      return {
        ...prev,
        readings: current,
      }
    })
  }

  const handleMoveWellReading = (index: number, direction: 'up' | 'down') => {
    setSheetFormData((prev) => {
      const current = [...(prev.readings || [])]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) return prev
      const temp = current[index]
      current[index] = current[targetIndex]
      current[targetIndex] = temp
      return {
        ...prev,
        readings: current,
      }
    })
  }

  const handleSaveSheet = async (newStatus?: 'draft' | 'submitted' | 'approved') => {
    if (!sheetFormData.area_name) {
      toast({
        title: 'Área obrigatória',
        description: 'Selecione a Área de monitoramento.',
        variant: 'destructive',
      })
      return
    }

    if (sheetFormData.date && !isValidBrDate(sheetFormData.date)) {
      toast({
        title: 'Data inválida',
        description: 'Informe a data no formato brasileiro DD/MM/AAAA.',
        variant: 'destructive',
      })
      return
    }

    try {
      const payload: Partial<NaSheet> = {
        ...sheetFormData,
        id: selectedSheet?.id,
        status: newStatus || sheetFormData.status || 'draft',
      }
      const saved = await naSheetService.saveSheet(payload)
      setSelectedSheet(saved)
      setSheetFormData(saved)
      toast({
        title: 'Planilha de NA salva!',
        description:
          newStatus === 'submitted'
            ? 'Planilha enviada com sucesso.'
            : 'As leituras de NA/NO foram registradas.',
      })
      loadAll()
    } catch (err) {
      console.error('Erro ao salvar planilha de NA:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a planilha de NA.',
        variant: 'destructive',
      })
    }
  }

  // ==========================================
  // FLUXO DO ADMIN: CONFIGURAÇÃO DE ÁREAS E POÇOS
  // ==========================================
  const handleStartNewConfig = () => {
    setConfigFormData({
      area_name: '',
      contract_number: '',
      description: '',
      wells: [],
      active: true,
    })
    setSelectedConfig(null)
    setIsEditingConfig(true)
    setNewWellCodeInput('')
  }

  const handleOpenConfig = (config: NaAreaConfig) => {
    setSelectedConfig(config)
    setConfigFormData({
      ...config,
      wells: config.wells || [],
    })
    setIsEditingConfig(true)
    setNewWellCodeInput('')
  }

  const handleAddWellToConfig = () => {
    const trimmed = newWellCodeInput.trim().toUpperCase()
    if (!trimmed) return

    // Evita poço duplicado na mesma área
    if (configFormData.wells?.some((w) => w.code.toUpperCase() === trimmed)) {
      toast({
        title: 'Poço já cadastrado',
        description: `O poço ${trimmed} já faz parte desta área.`,
        variant: 'destructive',
      })
      return
    }

    setConfigFormData((prev) => ({
      ...prev,
      wells: [...(prev.wells || []), { code: trimmed }],
    }))
    setNewWellCodeInput('')
  }

  const handleRemoveWellFromConfig = (code: string) => {
    setConfigFormData((prev) => ({
      ...prev,
      wells: (prev.wells || []).filter((w) => w.code !== code),
    }))
  }

  const handleSaveConfig = async () => {
    if (!configFormData.area_name?.trim()) {
      toast({
        title: 'Nome da área obrigatório',
        description: 'Informe o nome da Área.',
        variant: 'destructive',
      })
      return
    }
    if (!configFormData.wells || configFormData.wells.length === 0) {
      toast({
        title: 'Poços obrigatórios',
        description: 'Adicione pelo menos um poço à lista da área.',
        variant: 'destructive',
      })
      return
    }

    try {
      const payload: Partial<NaAreaConfig> = {
        ...configFormData,
        id: selectedConfig?.id,
      }
      const saved = await naConfigService.saveConfig(payload)
      setSelectedConfig(saved)
      setConfigFormData(saved)
      toast({
        title: 'Configuração de Área salva!',
        description: `Área "${saved.area_name}" configurada com ${saved.wells.length} poço(s).`,
      })
      loadAll()
      setIsEditingConfig(false)
    } catch (err) {
      console.error('Erro ao salvar configuração de área:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a configuração de área.',
        variant: 'destructive',
      })
    }
  }

  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return
    try {
      if (deleteConfirm.type === 'sheet') {
        await naSheetService.deleteSheet(deleteConfirm.id)
        toast({ title: 'Planilha de NA excluída.' })
        if (selectedSheet?.id === deleteConfirm.id) {
          setIsEditingSheet(false)
          setSelectedSheet(null)
        }
      } else {
        await naConfigService.deleteConfig(deleteConfirm.id)
        toast({ title: 'Configuração de Área excluída.' })
        if (selectedConfig?.id === deleteConfirm.id) {
          setIsEditingConfig(false)
          setSelectedConfig(null)
        }
      }
      loadAll()
    } catch (err) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        variant: 'destructive',
      })
    } finally {
      setDeleteConfirm(null)
    }
  }

  // ==========================================
  // RENDER: EDIÇÃO / PREENCHIMENTO DE PLANILHA
  // ==========================================
  if (isEditingSheet) {
    const rawWeather = sheetFormData.weather ?? 'Ensolarado'
    const isOtherWeather =
      rawWeather === 'Outros' || (rawWeather !== '' && !FIXED_WEATHER_CHOICES.includes(rawWeather))
    const displayWeather = rawWeather === 'Outros' ? '' : rawWeather

    // Monta matriz de 4 colunas para renderização lado a lado exatamente como no Excel
    const matrixRows = get4ColumnRows(sheetFormData.readings || [])
    const minRowsToDisplay = Math.max(matrixRows.length, 25) // Garante grade visível como no Excel

    // Mapeamento preciso de cada célula da coluna para seu índice real em sheetFormData.readings
    const cols = chunkInto4Columns(sheetFormData.readings || [])
    const displayMatrix: Array<{
      key: number
      blocks: Array<{
        blockIdx: number
        item: NaWellReadingRow | null
        originalIdx: number
      }>
    }> = []

    for (let r = 0; r < minRowsToDisplay; r++) {
      const blocks = [0, 1, 2, 3].map((bIdx) => {
        const item = cols[bIdx] && cols[bIdx][r] ? cols[bIdx][r] : null
        let originalIdx = -1
        if (item) {
          if (item.id) {
            originalIdx = (sheetFormData.readings || []).findIndex((rd) => rd.id === item.id)
          }
          if (originalIdx === -1) {
            // fallback para busca por índice ou código
            originalIdx = (sheetFormData.readings || []).indexOf(item)
          }
        }
        return {
          blockIdx: bIdx,
          item,
          originalIdx,
        }
      })

      displayMatrix.push({
        key: r,
        blocks,
      })
    }

    return (
      <div className="space-y-4">
        {/* Barra superior de ações */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditingSheet(false)
                loadAll()
              }}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl flex items-center gap-2">
                <span>Planilha de Monitoramento de NA</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] uppercase font-bold',
                    sheetFormData.status === 'approved'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : sheetFormData.status === 'submitted'
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-slate-300 bg-slate-50 text-slate-700',
                  )}
                >
                  {sheetFormData.status === 'approved'
                    ? 'Aprovado'
                    : sheetFormData.status === 'submitted'
                      ? 'Enviado'
                      : 'Rascunho'}
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Digitalização fiel da planilha física · Todos os campos e poços 100% editáveis · 4
                blocos lado a lado
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleAddNewWellReading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs min-h-[38px] shadow-sm font-semibold"
              title="Adiciona um novo poço à planilha dentro da estrutura de blocos"
            >
              <Plus className="mr-1.5 h-4 w-4" />＋ Adicionar Poço
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => printNaSheet(sheetFormData as NaSheet)}
              className="text-xs min-h-[38px] border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 font-semibold"
              title="Exporta o PDF ou abre visualização para impressão fiel ao modelo oficial"
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Exportar PDF / Imprimir
            </Button>

            {isAdmin && selectedSheet?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm({ type: 'sheet', id: selectedSheet.id })}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 min-h-[38px]"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveSheet('draft')}
              className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 min-h-[38px]"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Salvar Rascunho
            </Button>

            <Button
              size="sm"
              onClick={() => handleSaveSheet('submitted')}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs min-h-[38px] shadow-sm font-semibold"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Enviar / Salvar
            </Button>
          </div>
        </div>

        {/* Barra Informativa e de Controle de Poços */}
        <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                Carregar Base da Área:
              </span>
              <select
                value={isCustomArea ? '__custom__' : sheetFormData.area_name || ''}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomArea(true)
                  } else {
                    setIsCustomArea(false)
                    handleAreaChangeInSheet(e.target.value)
                  }
                }}
                className="h-8 rounded border border-slate-300 bg-white px-2.5 font-semibold text-emerald-950 dark:border-slate-700 dark:bg-slate-950 dark:text-emerald-300"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.area_name}>
                    {c.area_name} ({c.wells?.length || 0} poços na base)
                  </option>
                ))}
                <option value="__custom__">Outra localidade / Personalizada...</option>
              </select>
              {isCustomArea && (
                <Input
                  value={sheetFormData.area_name || ''}
                  onChange={(e) => setSheetFormData((p) => ({ ...p, area_name: e.target.value }))}
                  placeholder="Digite o nome da área / localidade..."
                  className="h-8 w-60 text-xs font-semibold"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleAddNewWellReading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 shadow-sm font-semibold"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />＋ Adicionar Poço
              </Button>
              <span className="text-slate-500 font-medium">
                Total: <b>{sheetFormData.readings?.length || 0}</b> poço(s)
              </span>
            </div>
          </div>

          {/* Gerenciamento Rápido de Ordem e Poços */}
          {(sheetFormData.readings || []).length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
                <ListOrdered className="h-3 w-3 text-emerald-600" />
                Ordem dos poços:
              </span>
              {(sheetFormData.readings || []).map((r, idx) => (
                <div
                  key={r.id || `badge_${idx}_${r.well_code}`}
                  className="inline-flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono shadow-xs"
                >
                  <span className="font-bold text-emerald-900 dark:text-emerald-300">
                    {r.well_code || `P-${idx + 1}`}
                  </span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveWellReading(idx, 'up')}
                      title="Mover poço para a esquerda/anterior"
                      className="text-slate-400 hover:text-emerald-600 disabled:opacity-20 p-0.5"
                    >
                      <ArrowUp className="h-2.5 w-2.5 rotate-[-90deg]" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === (sheetFormData.readings || []).length - 1}
                      onClick={() => handleMoveWellReading(idx, 'down')}
                      title="Mover poço para a direita/seguinte"
                      className="text-slate-400 hover:text-emerald-600 disabled:opacity-20 p-0.5"
                    >
                      <ArrowDown className="h-2.5 w-2.5 rotate-[-90deg]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveWellReading(idx)}
                      title={`Remover ${r.well_code}`}
                      className="text-slate-400 hover:text-rose-600 p-0.5 ml-0.5"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* DIGITALIZAÇÃO DA PLANILHA FÍSICA (LAYOUT OFICIAL DO EXCEL)     */}
        {/* 16 Colunas: 4 blocos de [Poço | NA (m) | NO (m) | Obs.]        */}
        {/* ============================================================== */}
        <div className="rounded-lg border-2 border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          {/* Container com scroll horizontal em telas menores para NUNCA quebrar a estrutura em cards */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-xs table-fixed">
              <colgroup>
                {/* Bloco 1 (4 colunas) */}
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
                {/* Bloco 2 (4 colunas) */}
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
                {/* Bloco 3 (4 colunas) */}
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
                {/* Bloco 4 (4 colunas) */}
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[5%]" />
              </colgroup>
              <tbody>
                {/* LINHA 1: CONTRATO */}
                <tr className="border-b border-slate-300 dark:border-slate-800">
                  <td
                    colSpan={16}
                    className="px-3 py-1.5 font-bold uppercase text-[12px] tracking-wide text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900/80 border-r border-slate-300 dark:border-slate-800"
                  >
                    CONTRATO
                  </td>
                </tr>

                {/* LINHA 2: NÚMERO DO CONTRATO (ex: CT 5900089378) */}
                <tr className="border-b border-slate-300 dark:border-slate-800">
                  <td
                    colSpan={16}
                    className="p-1 px-3 bg-white dark:bg-slate-950 border-r border-slate-300 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={sheetFormData.contract_number || ''}
                        onChange={(e) =>
                          setSheetFormData((p) => ({ ...p, contract_number: e.target.value }))
                        }
                        placeholder="Ex.: CT 5900089378"
                        className="h-8 w-80 font-bold font-mono text-xs border-slate-300 dark:border-slate-700"
                      />
                      <span className="text-[11px] text-slate-400 italic">
                        (Identificação do contrato da área/projeto)
                      </span>
                    </div>
                  </td>
                </tr>

                {/* LINHA 3: IDENTIFICAÇÃO DO LOCAL (ex: KM244 - ALTO ALEGRE DO PINDARÉ/MA) - EDITÁVEL */}
                <tr className="border-b border-slate-300 dark:border-slate-800">
                  <td
                    colSpan={16}
                    className="p-1 px-3 bg-slate-50/60 dark:bg-slate-900/60 border-r border-slate-300 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase text-slate-500 shrink-0">
                        Localidade / Área:
                      </span>
                      <Input
                        value={sheetFormData.area_name || ''}
                        onChange={(e) =>
                          setSheetFormData((p) => ({ ...p, area_name: e.target.value }))
                        }
                        placeholder="Ex.: KM244 - ALTO ALEGRE DO PINDARÉ/MA"
                        className="h-8 max-w-lg font-bold uppercase text-xs sm:text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      />
                    </div>
                  </td>
                </tr>

                {/* LINHA 4: PLANILHA DIÁRIA DE CAMPO */}
                <tr className="border-b border-slate-300 dark:border-slate-800">
                  <td
                    colSpan={16}
                    className="px-3 py-1.5 font-bold uppercase text-xs sm:text-sm text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 border-r border-slate-300 dark:border-slate-800"
                  >
                    PLANILHA DIÁRIA DE CAMPO
                  </td>
                </tr>

                {/* LINHA 5: Monitoramento do Nível d'Água */}
                <tr className="border-b-2 border-slate-400 dark:border-slate-700">
                  <td
                    colSpan={16}
                    className="px-3 py-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/60 border-r border-slate-300 dark:border-slate-800"
                  >
                    Monitoramento do Nível d'Água
                  </td>
                </tr>

                {/* LINHA 6: DATA: (cols 1-12) e Clima: (cols 13-16) */}
                <tr className="border-b-2 border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <td
                    colSpan={12}
                    className="px-3 py-1.5 border-r border-slate-300 dark:border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        DATA:
                      </span>
                      <Input
                        value={sheetFormData.date || ''}
                        onChange={(e) =>
                          setSheetFormData((p) => ({ ...p, date: applyDateMask(e.target.value) }))
                        }
                        placeholder="DD/MM/AAAA"
                        maxLength={10}
                        className={cn(
                          'h-7 w-32 font-mono text-center text-xs border-slate-300 dark:border-slate-700',
                          sheetFormData.date &&
                            !isValidBrDate(sheetFormData.date) &&
                            'border-rose-500 bg-rose-50 dark:bg-rose-950/40',
                        )}
                      />
                      <span className="text-[11px] text-slate-400 ml-4 hidden sm:inline">
                        Responsável:
                      </span>
                      <Input
                        value={sheetFormData.responsible_name || ''}
                        onChange={(e) =>
                          setSheetFormData((p) => ({ ...p, responsible_name: e.target.value }))
                        }
                        placeholder="Técnico responsável"
                        className="h-7 w-48 text-xs border-slate-300 dark:border-slate-700 hidden sm:inline-flex"
                      />
                    </div>
                  </td>
                  <td colSpan={4} className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        Clima:
                      </span>
                      {isOtherWeather ? (
                        <div className="flex items-center gap-1 flex-1">
                          <Input
                            value={displayWeather}
                            onChange={(e) =>
                              setSheetFormData((p) => ({ ...p, weather: e.target.value }))
                            }
                            placeholder="Descreva o clima..."
                            className="h-7 text-xs flex-1 border-slate-300 dark:border-slate-700"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSheetFormData((p) => ({ ...p, weather: 'Ensolarado' }))
                            }
                            className="h-7 px-1.5 text-[10px]"
                          >
                            Lista
                          </Button>
                        </div>
                      ) : (
                        <select
                          value={rawWeather}
                          onChange={(e) =>
                            setSheetFormData((p) => ({
                              ...p,
                              weather: e.target.value === 'Outros' ? 'Outros' : e.target.value,
                            }))
                          }
                          className="h-7 flex-1 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="Ensolarado">Ensolarado</option>
                          <option value="Chuvoso">Chuvoso</option>
                          <option value="Instável">Instável</option>
                          <option value="Outros">Outros</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>

                {/* LINHA 7: CABEÇALHOS DAS COLUNAS (4 BLOCOS IDÊNTICOS: Poço | NA (m) | NO (m) | Obs.) */}
                <tr className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-[11px] border-b-2 border-slate-400 dark:border-slate-700 select-none">
                  {/* Bloco 1 */}
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    Poço
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NA (m)
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NO (m)
                  </th>
                  <th className="p-1 text-center border-r-2 border-slate-400 dark:border-slate-600">
                    Obs.
                  </th>
                  {/* Bloco 2 */}
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    Poço
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NA (m)
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NO (m)
                  </th>
                  <th className="p-1 text-center border-r-2 border-slate-400 dark:border-slate-600">
                    Obs.
                  </th>
                  {/* Bloco 3 */}
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    Poço
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NA (m)
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NO (m)
                  </th>
                  <th className="p-1 text-center border-r-2 border-slate-400 dark:border-slate-600">
                    Obs.
                  </th>
                  {/* Bloco 4 */}
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    Poço
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NA (m)
                  </th>
                  <th className="p-1 text-center border-r border-slate-300 dark:border-slate-700">
                    NO (m)
                  </th>
                  <th className="p-1 text-center">Obs.</th>
                </tr>

                {/* LINHAS DE DADOS (4 BLOCOS LADO A LADO) */}
                {displayMatrix.map((row) => {
                  const rowIdx = row.key
                  return (
                    <tr
                      key={rowIdx}
                      className={cn(
                        'border-b border-slate-200 dark:border-slate-800 hover:bg-emerald-50/20 dark:hover:bg-slate-900/40',
                        rowIdx % 2 === 1 && 'bg-slate-50/40 dark:bg-slate-900/20',
                      )}
                    >
                      {row.blocks.flatMap(({ blockIdx, item, originalIdx }) => {
                        const isLastBlock = blockIdx === 3
                        const keyPrefix = `r${rowIdx}-b${blockIdx}`

                        if (!item) {
                          return [
                            <td
                              key={`${keyPrefix}-poco`}
                              className="p-1 text-center border-r border-slate-200 dark:border-slate-800 text-slate-300 select-none"
                            >
                              &nbsp;
                            </td>,
                            <td
                              key={`${keyPrefix}-na`}
                              className="p-1 border-r border-slate-200 dark:border-slate-800 select-none"
                            >
                              &nbsp;
                            </td>,
                            <td
                              key={`${keyPrefix}-no`}
                              className="p-1 border-r border-slate-200 dark:border-slate-800 select-none"
                            >
                              &nbsp;
                            </td>,
                            <td
                              key={`${keyPrefix}-obs`}
                              className={cn(
                                'p-1 select-none',
                                !isLastBlock && 'border-r-2 border-slate-400 dark:border-slate-700',
                              )}
                            >
                              &nbsp;
                            </td>,
                          ]
                        }

                        return [
                          <td
                            key={`${keyPrefix}-poco`}
                            className="p-0.5 text-center font-mono font-bold text-[11px] bg-emerald-50/30 dark:bg-slate-900/80 border-r border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 group/cell relative"
                          >
                            <div className="flex items-center justify-between w-full h-full gap-0.5 px-0.5">
                              <Input
                                value={item.well_code || ''}
                                onChange={(e) =>
                                  handleUpdateReadingCell(
                                    originalIdx,
                                    'well_code',
                                    e.target.value.toUpperCase(),
                                  )
                                }
                                placeholder="PM-01"
                                title="Código do poço (editável — clique para alterar)"
                                className="h-6 w-full min-w-0 px-1 text-[11px] font-mono font-bold text-center uppercase rounded-none border-0 focus-visible:ring-1 focus-visible:ring-emerald-600 bg-transparent text-emerald-950 dark:text-emerald-200"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveWellReading(originalIdx)}
                                title={`Excluir poço ${item.well_code || ''}`}
                                className="opacity-0 group-hover/cell:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 rounded transition shrink-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>,
                          <td
                            key={`${keyPrefix}-na`}
                            className="p-0.5 border-r border-slate-200 dark:border-slate-800"
                          >
                            <Input
                              inputMode="decimal"
                              value={item.na_m || ''}
                              onChange={(e) =>
                                handleUpdateReadingCell(originalIdx, 'na_m', e.target.value)
                              }
                              placeholder="—"
                              className="h-6 w-full px-1 text-[11px] font-mono text-right rounded-none border-0 focus-visible:ring-1 focus-visible:ring-emerald-600 bg-transparent"
                            />
                          </td>,
                          <td
                            key={`${keyPrefix}-no`}
                            className="p-0.5 border-r border-slate-200 dark:border-slate-800"
                          >
                            <Input
                              inputMode="decimal"
                              value={item.no_m || ''}
                              onChange={(e) =>
                                handleUpdateReadingCell(originalIdx, 'no_m', e.target.value)
                              }
                              placeholder="—"
                              className="h-6 w-full px-1 text-[11px] font-mono text-right rounded-none border-0 focus-visible:ring-1 focus-visible:ring-emerald-600 bg-transparent"
                            />
                          </td>,
                          <td
                            key={`${keyPrefix}-obs`}
                            className={cn(
                              'p-0.5',
                              !isLastBlock && 'border-r-2 border-slate-400 dark:border-slate-700',
                            )}
                          >
                            <Input
                              value={item.observation || ''}
                              onChange={(e) =>
                                handleUpdateReadingCell(originalIdx, 'observation', e.target.value)
                              }
                              placeholder=""
                              className="h-6 w-full px-1 text-[11px] rounded-none border-0 focus-visible:ring-1 focus-visible:ring-emerald-600 bg-transparent"
                            />
                          </td>,
                        ]
                      })}
                    </tr>
                  )
                })}

                {/* LINHA 39 (RODAPÉ): Observações */}
                <tr className="border-t-2 border-slate-400 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <td colSpan={16} className="p-3">
                    <div className="space-y-1.5">
                      <label className="font-bold uppercase text-[11px] text-slate-800 dark:text-slate-200">
                        Observações
                      </label>
                      <textarea
                        value={sheetFormData.notes || ''}
                        onChange={(e) => setSheetFormData((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Observações de campo sobre as condições da área, poços secos, obstruções ou anomalias..."
                        rows={3}
                        className="w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 text-slate-800 dark:text-slate-200"
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // RENDER: EDIÇÃO DE CONFIGURAÇÃO DE ÁREA (ADMIN)
  // ==========================================
  if (isEditingConfig) {
    const wellsList = configFormData.wells || []

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsEditingConfig(false)
                loadAll()
              }}
              className="text-slate-600 hover:text-slate-900 dark:text-slate-300"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl flex items-center gap-2">
                <span>Configuração de Área de NA</span>
                <Badge className="bg-emerald-800 text-white text-[10px]">Administrador</Badge>
              </h2>
              <p className="text-xs text-slate-500">
                Defina a lista de poços que farão parte da área no preenchimento do operador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedConfig?.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirm({ type: 'config', id: selectedConfig.id })}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 min-h-[38px]"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir Área
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleSaveConfig}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs min-h-[38px] shadow-sm"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Salvar Configuração
            </Button>
          </div>
        </div>

        {/* Dados da Área */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              Dados da Área
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome da Área / Localidade *
              </label>
              <Input
                value={configFormData.area_name || ''}
                onChange={(e) => setConfigFormData((p) => ({ ...p, area_name: e.target.value }))}
                placeholder="Ex.: KM244 - ALTO ALEGRE DO PINDARÉ/MA"
                className="mt-1 h-9 text-xs sm:text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nº do Contrato Padrão (Opcional)
              </label>
              <Input
                value={configFormData.contract_number || ''}
                onChange={(e) =>
                  setConfigFormData((p) => ({ ...p, contract_number: e.target.value }))
                }
                placeholder="Ex.: CT 5900089378"
                className="mt-1 h-9 text-xs sm:text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição Adicional
              </label>
              <Input
                value={configFormData.description || ''}
                onChange={(e) => setConfigFormData((p) => ({ ...p, description: e.target.value }))}
                placeholder="Ex.: Base operacional e bacia de contenção"
                className="mt-1 h-9 text-xs sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Cadastro Dinâmico de Poços da Área */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
                Poços Pertencentes a Esta Área (Dinâmico)
              </CardTitle>
              <CardDescription className="text-xs">
                Cadastre os poços (ex: PM-03, PM-07, PR-01, etc.). Quantidade não limitada.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={newWellCodeInput}
                onChange={(e) => setNewWellCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddWellToConfig()
                  }
                }}
                placeholder="Ex.: PM-12 ou PR-04"
                className="h-9 w-40 text-xs font-mono font-bold uppercase"
              />
              <Button
                size="sm"
                onClick={handleAddWellToConfig}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-9"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Adicionar Poço
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {wellsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                Nenhum poço cadastrado para esta área. Digite o código acima e clique em "Adicionar
                Poço".
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {wellsList.map((w) => (
                  <div
                    key={w.code}
                    className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 shadow-sm"
                  >
                    <span>{w.code}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveWellFromConfig(w.code)}
                      className="text-slate-400 hover:text-rose-600 transition"
                      title={`Remover ${w.code}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] text-slate-500">
              Total de poços definidos para a área: <b>{wellsList.length}</b>. Esta lista serve como
              base inicial configurada para o operador ao criar a Planilha de NA.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ==========================================
  // RENDER: VISUALIZAÇÃO PRINCIPAL EM ABAS
  // ==========================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
              Planilha de Monitoramento de NA
            </h1>
            <Badge className="bg-emerald-600 text-white font-medium text-xs">
              Nível d'Água e Óleo
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Controle do nível de água (NA) e óleo (NO) por área com base inicial de poços e edição
            livre.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              onClick={() => setActiveTab('configs')}
              variant="outline"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 min-h-[42px] px-3"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurar Áreas
            </Button>
          )}

          <Button
            onClick={handleStartNewSheet}
            className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[42px] px-4 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Planilha de NA
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1">
          <TabsTrigger value="sheets" className="text-xs font-semibold">
            <Waves className="mr-1.5 h-3.5 w-3.5" />
            Planilhas de Monitoramento ({filteredSheets.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="configs" className="text-xs font-semibold">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Configuração de Áreas / Poços ({filteredConfigs.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ABA 1: PLANILHAS DE MONITORAMENTO */}
        <TabsContent value="sheets" className="space-y-4">
          {/* Card explicativo do fluxo */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5 dark:text-emerald-400" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  Diretrizes da Planilha de Monitoramento de NA:
                </p>
                <p>
                  <b>1. Base Inicial:</b> Ao iniciar uma planilha ou selecionar uma área, os poços
                  cadastrados pelo Administrador são carregados como base inicial.
                </p>
                <p>
                  <b>2. 100% Editável:</b> Todos os campos são editáveis — Contrato, Local/Área,
                  Data, Clima, Código do Poço, NA (m), NO (m), Obs. e Observações gerais.
                </p>
                <p>
                  <b>3. Liberdade de Poços:</b> Adicione quantos poços forem necessários pelo botão{' '}
                  <b>"＋ Adicionar Poço"</b>, edite nomes/códigos, exclua ou reordene conforme a
                  rotina de campo, mantendo sempre o layout original em 4 blocos.
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-sm text-slate-500">Carregando planilhas de NA...</p>
            </div>
          ) : filteredSheets.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Waves className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Nenhuma planilha de monitoramento de NA encontrada
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1">
                  Clique no botão acima para iniciar a primeira planilha para uma área configurada.
                </p>
                <Button onClick={handleStartNewSheet} variant="outline" className="mt-4 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Criar Planilha de NA
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSheets.map((sheet) => {
                const totalWells = sheet.readings?.length || 0
                return (
                  <Card
                    key={sheet.id}
                    className="hover:border-emerald-400 dark:hover:border-emerald-600 transition shadow-sm cursor-pointer group"
                    onClick={() => handleOpenSheet(sheet)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base text-emerald-950 dark:text-emerald-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition">
                            {sheet.area_name}
                          </CardTitle>
                          <CardDescription className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            Data: {sheet.date || '—'}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] uppercase font-bold shrink-0',
                            sheet.status === 'approved'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : sheet.status === 'submitted'
                                ? 'border-blue-500 bg-blue-50 text-blue-800'
                                : 'border-slate-300 bg-slate-50 text-slate-700',
                          )}
                        >
                          {sheet.status === 'approved'
                            ? 'Aprovado'
                            : sheet.status === 'submitted'
                              ? 'Enviado'
                              : 'Rascunho'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                        <span>Poços monitorados:</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {totalWells} poço{totalWells !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {sheet.weather && (
                        <div className="flex items-center justify-between">
                          <span>Clima:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {sheet.weather}
                          </span>
                        </div>
                      )}
                      {sheet.responsible_name && (
                        <div className="flex items-center justify-between">
                          <span>Responsável:</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {sheet.responsible_name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA 2: CONFIGURAÇÃO DE ÁREAS PELO ADMIN */}
        {isAdmin && (
          <TabsContent value="configs" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Áreas e Poços Configurados pelo Administrador
                </h3>
                <p className="text-xs text-slate-500">
                  Cadastre as áreas e vincule a lista dinâmica de poços. Ficam disponíveis para os
                  operadores.
                </p>
              </div>
              <Button
                onClick={handleStartNewConfig}
                size="sm"
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Nova Configuração de Área
              </Button>
            </div>

            {filteredConfigs.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <Layers className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma área configurada</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Crie a primeira área (ex: "Alto Alegre do Pindaré") e adicione seus poços.
                  </p>
                  <Button onClick={handleStartNewConfig} variant="outline" className="mt-3 text-xs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Cadastrar Área
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredConfigs.map((cfg) => {
                  const wells = cfg.wells || []
                  return (
                    <Card
                      key={cfg.id}
                      className="hover:border-emerald-400 dark:hover:border-emerald-600 transition shadow-sm cursor-pointer group"
                      onClick={() => handleOpenConfig(cfg)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base text-emerald-950 dark:text-emerald-100 group-hover:text-emerald-700">
                            {cfg.area_name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {wells.length} poços
                          </Badge>
                        </div>
                        {cfg.description && (
                          <CardDescription className="text-xs">{cfg.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                          {wells.map((w) => (
                            <span
                              key={w.code}
                              className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {w.code}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Confirmação de exclusão */}
      <AlertDialog open={Boolean(deleteConfirm)} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirm?.type === 'sheet'
                ? 'Deseja excluir esta planilha de NA?'
                : 'Deseja excluir esta configuração de área?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente o registro selecionado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecuteDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Excluir Definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
