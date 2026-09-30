import { useState, useEffect, useMemo } from 'react'
import {
  Waves,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Send,
  Printer,
  Settings,
  ShieldCheck,
  Lock,
  Layers,
  MapPin,
  HelpCircle,
} from 'lucide-react'
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
  const [sheetFormData, setSheetFormData] = useState<Partial<NaSheet>>({
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
    const initialReadings: NaWellReadingRow[] = (firstConfig.wells || []).map((w) => ({
      well_code: w.code,
      na_m: '',
      no_m: '',
      observation: '',
    }))

    setSheetFormData({
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
    setSheetFormData({
      ...sheet,
      readings: sheet.readings || [],
    })
    setIsEditingSheet(true)
  }

  // Quando o usuário seleciona uma área no preenchimento, carrega automaticamente os poços cadastrados pelo Admin
  const handleAreaChangeInSheet = (newAreaName: string) => {
    const configFound = configs.find((c) => c.area_name === newAreaName)
    const newReadings: NaWellReadingRow[] = configFound
      ? (configFound.wells || []).map((w) => {
          // Preserva leitura anterior se mesmo poço
          const prevReading = sheetFormData.readings?.find((r) => r.well_code === w.code)
          return {
            well_code: w.code,
            na_m: prevReading?.na_m || '',
            no_m: prevReading?.no_m || '',
            observation: prevReading?.observation || '',
          }
        })
      : []

    setSheetFormData((prev) => ({
      ...prev,
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

    return (
      <div className="space-y-6">
        {/* Barra superior de ações */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
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
                Poços carregados automaticamente pela Área configurada · Nível d'Água (m) e Nível de
                Óleo (m)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs min-h-[38px]"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimir
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
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs min-h-[38px] shadow-sm"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Enviar / Salvar
            </Button>
          </div>
        </div>

        {/* Informações da Ficha e Seleção de Área */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="bg-slate-50/80 dark:bg-slate-900/50 pb-4 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Identificação da Área e Condições Operacionais
            </CardTitle>
            <CardDescription className="text-xs">
              Ao selecionar a Área, os poços cadastrados pelo Administrador são carregados e
              bloqueados automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Área de Monitoramento *
              </label>
              <select
                value={sheetFormData.area_name || ''}
                onChange={(e) => handleAreaChangeInSheet(e.target.value)}
                className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs sm:text-sm shadow-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                {configs.map((c) => (
                  <option key={c.id} value={c.area_name}>
                    {c.area_name} ({c.wells?.length || 0} poços)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Data (DD/MM/AAAA) *
              </label>
              <Input
                value={sheetFormData.date || ''}
                onChange={(e) =>
                  setSheetFormData((p) => ({ ...p, date: applyDateMask(e.target.value) }))
                }
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={cn(
                  'mt-1 h-9 text-xs sm:text-sm font-mono text-center',
                  sheetFormData.date &&
                    !isValidBrDate(sheetFormData.date) &&
                    'border-rose-500 bg-rose-50',
                )}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Clima
              </label>
              {isOtherWeather ? (
                <div className="mt-1 flex items-center gap-1">
                  <Input
                    value={displayWeather}
                    onChange={(e) => setSheetFormData((p) => ({ ...p, weather: e.target.value }))}
                    placeholder="Descreva o clima..."
                    className="h-9 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSheetFormData((p) => ({ ...p, weather: 'Ensolarado' }))}
                    className="h-9 px-2 text-[10px] shrink-0"
                  >
                    Opções
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
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="Ensolarado">Ensolarado</option>
                  <option value="Chuvoso">Chuvoso</option>
                  <option value="Instável">Instável</option>
                  <option value="Outros">Outros</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Responsável pelas Medições
              </label>
              <Input
                value={sheetFormData.responsible_name || ''}
                onChange={(e) =>
                  setSheetFormData((p) => ({ ...p, responsible_name: e.target.value }))
                }
                placeholder="Nome do técnico"
                className="mt-1 h-9 text-xs sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* Aviso de Regra de Bloqueio dos Poços pelo Admin */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-emerald-700 shrink-0 dark:text-emerald-400" />
          <div className="leading-relaxed">
            <b>Poços Bloqueados:</b> Os poços abaixo foram configurados previamente pelo
            Administrador para a área <b>{sheetFormData.area_name}</b>. O operador preenche apenas
            NA (m), NO (m) e Observação. Para incluir ou alterar poços da área, contate o
            Administrador na aba "Configuração de NA".
          </div>
        </div>

        {/* Tabela Padronizada de Poços da Área: Poço (travado), NA (m), NO (m), Observação */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300 flex items-center justify-between">
              <span>Medições dos Poços — {sheetFormData.area_name}</span>
              <span className="text-xs font-normal text-slate-500">
                {sheetFormData.readings?.length || 0} poços na configuração
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-4">
            {!sheetFormData.readings || sheetFormData.readings.length === 0 ? (
              <div className="py-10 text-center text-slate-500">
                Nenhum poço encontrado na configuração desta área. Selecione outra área ou configure
                os poços como Administrador.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-none sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                      <th className="p-2.5 border border-emerald-800 font-semibold text-center w-36">
                        Poço (Bloqueado)
                      </th>
                      <th className="p-2.5 border border-emerald-800 font-semibold text-center w-40">
                        NA (m)
                      </th>
                      <th className="p-2.5 border border-emerald-800 font-semibold text-center w-40">
                        NO (m)
                      </th>
                      <th className="p-2.5 border border-emerald-800 font-semibold text-center">
                        Observação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sheetFormData.readings.map((reading, idx) => (
                      <tr
                        key={reading.well_code || idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                      >
                        {/* Poço: Totalmente Bloqueado (usuário não pode editar/excluir/substituir) */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 text-center font-bold font-mono text-emerald-950 dark:text-emerald-200 select-none">
                          <div className="flex items-center justify-center gap-1.5 py-1">
                            <Lock className="h-3 w-3 text-slate-400" />
                            <span>{reading.well_code}</span>
                          </div>
                        </td>

                        {/* NA (m) */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            inputMode="decimal"
                            value={reading.na_m}
                            onChange={(e) => handleUpdateReadingCell(idx, 'na_m', e.target.value)}
                            placeholder="0,00"
                            className="h-9 text-xs font-mono text-right"
                          />
                        </td>

                        {/* NO (m) */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            inputMode="decimal"
                            value={reading.no_m}
                            onChange={(e) => handleUpdateReadingCell(idx, 'no_m', e.target.value)}
                            placeholder="0,00"
                            className="h-9 text-xs font-mono text-right"
                          />
                        </td>

                        {/* Observação */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            value={reading.observation}
                            onChange={(e) =>
                              handleUpdateReadingCell(idx, 'observation', e.target.value)
                            }
                            placeholder="Ex.: Seco, obstruído, presença de fase livre..."
                            className="h-9 text-xs"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações da Ficha */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Observações Gerais do Monitoramento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={sheetFormData.notes || ''}
              onChange={(e) => setSheetFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Informações gerais sobre o estado da área, nível estático ou condições operacionais..."
              rows={3}
              className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950"
            />
          </CardContent>
        </Card>
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
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nome da Área *
              </label>
              <Input
                value={configFormData.area_name || ''}
                onChange={(e) => setConfigFormData((p) => ({ ...p, area_name: e.target.value }))}
                placeholder="Ex.: Alto Alegre do Pindaré"
                className="mt-1 h-9 text-xs sm:text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descrição / Localidade
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
              Total de poços definidos para a área: <b>{wellsList.length}</b>. Esta lista será
              apresentada bloqueada aos operadores durante o preenchimento de cada Planilha de NA.
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
            Controle do nível de água (NA) e óleo (NO) por área com carregamento e bloqueio
            automático de poços.
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
                  Fluxo Padronizado do Monitoramento de NA:
                </p>
                <p>
                  <b>1. Admin:</b> Define as Áreas e cadastra a lista dinâmica de poços.
                </p>
                <p>
                  <b>2. Operador:</b> Inicia uma Nova Planilha de NA, seleciona a Área e o sistema
                  carrega automaticamente todos os poços cadastrados já <b>bloqueados</b>.
                </p>
                <p>
                  <b>3. Preenchimento:</b> O técnico informa apenas NA (m), NO (m), Observações e
                  Clima, sem digitar nem alterar o código dos poços.
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
