import { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Calendar,
  Clock,
  Send,
  Printer,
  Sparkles,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { inSituService } from '@/services/inSituAndNaService'
import type { InSituSheet, InSituMeasurementRow } from '@/types/inSituAndNa'

const SYSTEM_OPTIONS = [
  'Sistema 1 — Extração / Tratamento',
  'Sistema 2 — Infiltração',
  'Sistema 3 — Bioventing / SVE',
  'Sistema 4 — Monitoramento Geral',
]

const FIXED_WEATHER_CHOICES = ['Ensolarado', 'Chuvoso', 'Instável']

export function InSituPage({ query = '' }: { query?: string }) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [sheets, setSheets] = useState<InSituSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState<InSituSheet | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Formulário ativo
  const [formData, setFormData] = useState<Partial<InSituSheet>>({
    project_name: '',
    system_name: SYSTEM_OPTIONS[0],
    active_number: '',
    measurement_point: '',
    responsible_name: '',
    status: 'draft',
    notes: '',
    records: [],
  })

  const isAdmin = user?.role === 'admin'
  const isTechnician = user?.role === 'technician'

  const loadSheets = async () => {
    setIsLoading(true)
    try {
      const list = await inSituService.listSheets()
      setSheets(list)
    } catch (err) {
      console.error('Erro ao carregar in_situ_sheets:', err)
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as planilhas In-Situ salvas.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSheets()
  }, [])

  const filteredSheets = useMemo(() => {
    if (!query) return sheets
    const q = query.toLowerCase()
    return sheets.filter(
      (s) =>
        s.project_name?.toLowerCase().includes(q) ||
        s.system_name?.toLowerCase().includes(q) ||
        s.measurement_point?.toLowerCase().includes(q) ||
        s.responsible_name?.toLowerCase().includes(q) ||
        s.active_number?.toLowerCase().includes(q),
    )
  }, [sheets, query])

  const handleStartNew = () => {
    const today = new Date()
    const dStr = today.toLocaleDateString('pt-BR')
    const hStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const initialRow: InSituMeasurementRow = {
      id: `row_${Date.now()}_1`,
      date: dStr,
      time: hStr,
      ph: '',
      conductivity: '',
      conductivity_unit: 'µS/cm',
      od_mg_l: '',
      temperature_c: '',
      orp: '',
      turbidity: 'Não',
      weather: 'Ensolarado',
      responsible: user?.name || '',
      nutrients_in: '',
      nutrients_out: '',
      notes: '',
    }

    setFormData({
      project_name: 'Remediação Ambiental',
      system_name: SYSTEM_OPTIONS[0],
      active_number: '',
      measurement_point: 'Ponto 01',
      responsible_name: user?.name || '',
      status: 'draft',
      notes: '',
      records: [initialRow],
    })
    setSelectedSheet(null)
    setIsEditing(true)
  }

  const handleOpenSheet = (sheet: InSituSheet) => {
    setSelectedSheet(sheet)
    setFormData({
      ...sheet,
      records: sheet.records || [],
    })
    setIsEditing(true)
  }

  const handleAddMeasurementRow = () => {
    const today = new Date()
    const dStr = today.toLocaleDateString('pt-BR')
    const hStr = today.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

    const newRow: InSituMeasurementRow = {
      id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: dStr,
      time: hStr,
      ph: '',
      conductivity: '',
      conductivity_unit:
        formData.records && formData.records.length > 0
          ? formData.records[formData.records.length - 1].conductivity_unit || 'µS/cm'
          : 'µS/cm',
      od_mg_l: '',
      temperature_c: '',
      orp: '',
      turbidity: 'Não',
      weather: 'Ensolarado',
      responsible: user?.name || '',
      nutrients_in: '',
      nutrients_out: '',
      notes: '',
    }

    setFormData((prev) => ({
      ...prev,
      records: [...(prev.records || []), newRow],
    }))
  }

  const handleRemoveMeasurementRow = (rowId: string) => {
    setFormData((prev) => ({
      ...prev,
      records: (prev.records || []).filter((r) => r.id !== rowId),
    }))
  }

  const handleUpdateRowCell = (rowId: string, field: keyof InSituMeasurementRow, value: string) => {
    setFormData((prev) => ({
      ...prev,
      records: (prev.records || []).map((r) => {
        if (r.id !== rowId) return r
        return {
          ...r,
          [field]: field === 'date' ? applyDateMask(value) : value,
        }
      }),
    }))
  }

  const handleSave = async (newStatus?: 'draft' | 'submitted' | 'approved') => {
    if (!formData.project_name?.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o nome do Projeto.',
        variant: 'destructive',
      })
      return
    }
    if (!formData.measurement_point?.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o Ponto de Medição.',
        variant: 'destructive',
      })
      return
    }

    // Validação de datas de todas as linhas
    for (const r of formData.records || []) {
      if (r.date && !isValidBrDate(r.date)) {
        toast({
          title: 'Data inválida no registro',
          description: `A data "${r.date}" não é válida. Utilize o formato DD/MM/AAAA.`,
          variant: 'destructive',
        })
        return
      }
    }

    try {
      const payload: Partial<InSituSheet> = {
        ...formData,
        id: selectedSheet?.id,
        status: newStatus || formData.status || 'draft',
      }

      const saved = await inSituService.saveSheet(payload)
      setSelectedSheet(saved)
      setFormData(saved)
      toast({
        title: 'Planilha In-Situ salva com sucesso!',
        description:
          newStatus === 'submitted'
            ? 'Planilha enviada para aprovação.'
            : 'As medições foram registradas e sincronizadas.',
      })
      loadSheets()
    } catch (err) {
      console.error('Erro ao salvar planilha In-Situ:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar a planilha In-Situ.',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await inSituService.deleteSheet(id)
      toast({
        title: 'Planilha excluída',
        description: 'A planilha In-Situ foi removida.',
      })
      if (selectedSheet?.id === id) {
        setIsEditing(false)
        setSelectedSheet(null)
      }
      loadSheets()
    } catch (err) {
      console.error('Erro ao excluir:', err)
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível remover a planilha.',
        variant: 'destructive',
      })
    } finally {
      setDeleteConfirmId(null)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // Visualização de lista
  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                Planilha de Parâmetros In-Situ
              </h1>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                4 Sistemas Padronizados
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Registro digital de parâmetros de campo (pH, Condutividade, OD em mg/L, Temperatura,
              ORP, Turbidez, Nutrientes) permitindo múltiplos dias na mesma folha.
            </p>
          </div>
          <Button
            onClick={handleStartNew}
            className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[42px] px-4 shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Planilha In-Situ
          </Button>
        </div>

        {/* Resumo de orientações da planilha física */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5 dark:text-emerald-400" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Modelo Digital Conforme a Planilha Física de Referência:
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  <b>OD (mg/L):</b> Unidade fixada estritamente em mg/L (não aceita registro em
                  porcentagem %).
                </li>
                <li>
                  <b>Condutividade:</b> Unidade editável conforme exibida no visor do equipamento
                  (µS/cm, mS/cm, etc.).
                </li>
                <li>
                  <b>Vários dias/medições:</b> Adicione novas linhas de medição ao longo dos dias
                  sem precisar criar uma nova ficha por dia.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Listagem de fichas */}
        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
            <p className="text-sm text-slate-500">Carregando planilhas In-Situ...</p>
          </div>
        ) : filteredSheets.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Activity className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhuma planilha de parâmetros In-Situ encontrada
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1">
                Clique no botão acima para iniciar um novo registro padronizado de parâmetros.
              </p>
              <Button onClick={handleStartNew} variant="outline" className="mt-4 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Criar primeira planilha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSheets.map((sheet) => {
              const recordsCount = sheet.records?.length || 0
              const lastRecord = recordsCount > 0 ? sheet.records[recordsCount - 1] : null
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
                          {sheet.project_name || 'Projeto sem nome'}
                        </CardTitle>
                        <CardDescription className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {sheet.system_name}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] uppercase font-bold shrink-0',
                          sheet.status === 'approved'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : sheet.status === 'submitted'
                              ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
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
                  <CardContent className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                      <span>Ponto de medição:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {sheet.measurement_point || '—'}
                      </span>
                    </div>
                    {sheet.active_number && (
                      <div className="flex items-center justify-between">
                        <span>Nº Ativo:</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {sheet.active_number}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Total de medições:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {recordsCount} registro{recordsCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {lastRecord && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Última leitura:</span>
                        <span>
                          {lastRecord.date} {lastRecord.time ? `às ${lastRecord.time}` : ''}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Visualização e preenchimento da ficha digital
  const records = formData.records || []

  return (
    <div className="space-y-6">
      {/* Barra superior de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsEditing(false)
              loadSheets()
            }}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-300"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-xl flex items-center gap-2">
              <span>Planilha de Parâmetros In-Situ</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] uppercase font-bold',
                  formData.status === 'approved'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : formData.status === 'submitted'
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-slate-300 bg-slate-50 text-slate-700',
                )}
              >
                {formData.status === 'approved'
                  ? 'Aprovado'
                  : formData.status === 'submitted'
                    ? 'Enviado'
                    : 'Rascunho'}
              </Badge>
            </h2>
            <p className="text-xs text-slate-500">
              Modelo padrão para os 4 sistemas operacionais EPA
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs min-h-[38px]"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Imprimir
          </Button>

          {isAdmin && selectedSheet?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(selectedSheet.id)}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 min-h-[38px]"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave('draft')}
            className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 min-h-[38px]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Salvar Rascunho
          </Button>

          <Button
            size="sm"
            onClick={() => handleSave('submitted')}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs min-h-[38px] shadow-sm"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Enviar / Salvar
          </Button>
        </div>
      </div>

      {/* Cabeçalho da Planilha Física: Projeto, Sistema, Número ativo, Ponto de medição */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="bg-slate-50/80 dark:bg-slate-900/50 pb-4 border-b border-slate-200 dark:border-slate-800">
          <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Identificação da Ficha de Parâmetros In-Situ
          </CardTitle>
          <CardDescription className="text-xs">
            Configuração da folha: selecione o projeto, o sistema padronizado e o ponto de medição
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Projeto *
            </label>
            <Input
              value={formData.project_name || ''}
              onChange={(e) => setFormData((p) => ({ ...p, project_name: e.target.value }))}
              placeholder="Ex.: Remediação Ambiental"
              className="mt-1 h-9 text-xs sm:text-sm font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Sistema *
            </label>
            <select
              value={formData.system_name || SYSTEM_OPTIONS[0]}
              onChange={(e) => setFormData((p) => ({ ...p, system_name: e.target.value }))}
              className="mt-1 flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs sm:text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            >
              {SYSTEM_OPTIONS.map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Número ativo
            </label>
            <Input
              value={formData.active_number || ''}
              onChange={(e) => setFormData((p) => ({ ...p, active_number: e.target.value }))}
              placeholder="Ex.: AT-04 / EQ-12"
              className="mt-1 h-9 text-xs sm:text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Ponto de medição *
            </label>
            <Input
              value={formData.measurement_point || ''}
              onChange={(e) => setFormData((p) => ({ ...p, measurement_point: e.target.value }))}
              placeholder="Ex.: Ponto 01 / Poço PR-01"
              className="mt-1 h-9 text-xs sm:text-sm font-semibold"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Medições com Suporte a Vários Dias na Mesma Folha */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-300">
              Medições e Leituras In-Situ
            </CardTitle>
            <CardDescription className="text-xs">
              Múltiplos registros/dias permitidos na mesma folha física digital.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleAddMeasurementRow}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-9"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar Registro / Dia
          </Button>
        </CardHeader>
        <CardContent className="p-0 sm:p-4">
          <p className="px-4 py-2 text-[11px] text-slate-500 lg:hidden">
            👉 Deslize horizontalmente para visualizar e preencher todas as colunas
          </p>

          <div className="overflow-x-auto rounded-none sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <table className="w-full min-w-[1300px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-emerald-900 text-white dark:bg-emerald-950 text-[11px]">
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-28">
                    Data (DD/MM/AAAA)
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-20">
                    Hora
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-20">
                    pH
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[170px]">
                    Condutividade + Unidade
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[110px] bg-emerald-950">
                    OD (mg/L) *
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-24">
                    Temp. (ºC)
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-24">
                    ORP (mV)
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center w-28">
                    Turbidez
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[170px]">
                    Clima
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[160px]">
                    T. Nutrientes (Entr. / Saída)
                  </th>
                  <th className="p-2.5 border border-emerald-800 font-semibold text-center min-w-[140px]">
                    Responsável
                  </th>
                  <th className="p-2.5 border border-emerald-800 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-slate-400">
                      Nenhum registro de medição adicionado. Clique em "Adicionar Registro / Dia"
                      acima.
                    </td>
                  </tr>
                ) : (
                  records.map((row, idx) => {
                    const rawWeather = row.weather ?? 'Ensolarado'
                    const isOtherWeather =
                      rawWeather === 'Outros' ||
                      (rawWeather !== '' && !FIXED_WEATHER_CHOICES.includes(rawWeather))
                    const displayWeather = rawWeather === 'Outros' ? '' : rawWeather

                    return (
                      <tr
                        key={row.id || idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                      >
                        {/* Data */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            value={row.date}
                            onChange={(e) => handleUpdateRowCell(row.id, 'date', e.target.value)}
                            placeholder="DD/MM/AAAA"
                            maxLength={10}
                            className={cn(
                              'h-9 text-xs text-center font-mono',
                              row.date && !isValidBrDate(row.date) && 'border-rose-500 bg-rose-50',
                            )}
                          />
                        </td>

                        {/* Hora */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            type="time"
                            value={row.time}
                            onChange={(e) => handleUpdateRowCell(row.id, 'time', e.target.value)}
                            className="h-9 text-xs font-mono px-1 text-center"
                          />
                        </td>

                        {/* pH */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            inputMode="decimal"
                            value={row.ph}
                            onChange={(e) => handleUpdateRowCell(row.id, 'ph', e.target.value)}
                            placeholder="7,0"
                            className="h-9 text-xs font-mono text-center"
                          />
                        </td>

                        {/* Condutividade + Unidade configurável conforme visor */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1">
                            <Input
                              inputMode="decimal"
                              value={row.conductivity}
                              onChange={(e) =>
                                handleUpdateRowCell(row.id, 'conductivity', e.target.value)
                              }
                              placeholder="Valor"
                              className="h-9 text-xs font-mono text-right flex-1"
                            />
                            <Input
                              value={row.conductivity_unit}
                              onChange={(e) =>
                                handleUpdateRowCell(row.id, 'conductivity_unit', e.target.value)
                              }
                              placeholder="Unidade"
                              title="Unidade indicada no visor (ex: µS/cm, mS/cm)"
                              className="h-9 w-20 text-[11px] font-mono px-1 text-center bg-slate-50 dark:bg-slate-900"
                            />
                          </div>
                        </td>

                        {/* OD (mg/L) — rotulado e gravado estritamente em mg/L */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/20">
                          <div className="relative flex items-center">
                            <Input
                              inputMode="decimal"
                              value={row.od_mg_l}
                              onChange={(e) =>
                                handleUpdateRowCell(row.id, 'od_mg_l', e.target.value)
                              }
                              placeholder="0,00"
                              className="h-9 text-xs font-mono font-semibold text-right pr-12 text-emerald-950 dark:text-emerald-100"
                            />
                            <span className="absolute right-2 text-[10px] font-bold text-emerald-700 pointer-events-none select-none">
                              mg/L
                            </span>
                          </div>
                        </td>

                        {/* Temperatura */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            inputMode="decimal"
                            value={row.temperature_c}
                            onChange={(e) =>
                              handleUpdateRowCell(row.id, 'temperature_c', e.target.value)
                            }
                            placeholder="ºC"
                            className="h-9 text-xs font-mono text-center"
                          />
                        </td>

                        {/* ORP */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            inputMode="decimal"
                            value={row.orp}
                            onChange={(e) => handleUpdateRowCell(row.id, 'orp', e.target.value)}
                            placeholder="mV"
                            className="h-9 text-xs font-mono text-center"
                          />
                        </td>

                        {/* Turbidez: Sim/Não */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <select
                            value={row.turbidity || 'Não'}
                            onChange={(e) =>
                              handleUpdateRowCell(row.id, 'turbidity', e.target.value as any)
                            }
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-medium dark:border-slate-800 dark:bg-slate-950"
                          >
                            <option value="Não">Não (Límpida)</option>
                            <option value="Sim">Sim (Turva)</option>
                          </select>
                        </td>

                        {/* Clima: Inline existente no sistema (Ensolarado/Chuvoso/Instável/Outros com texto livre) */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          {isOtherWeather ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={displayWeather}
                                onChange={(e) =>
                                  handleUpdateRowCell(row.id, 'weather', e.target.value)
                                }
                                placeholder="Descreva o clima..."
                                className="h-9 text-xs flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleUpdateRowCell(row.id, 'weather', 'Ensolarado')}
                                className="h-9 px-2 text-[10px] shrink-0"
                              >
                                Opções
                              </Button>
                            </div>
                          ) : (
                            <select
                              value={rawWeather}
                              onChange={(e) =>
                                handleUpdateRowCell(
                                  row.id,
                                  'weather',
                                  e.target.value === 'Outros' ? 'Outros' : e.target.value,
                                )
                              }
                              className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                            >
                              <option value="Ensolarado">Ensolarado</option>
                              <option value="Chuvoso">Chuvoso</option>
                              <option value="Instável">Instável</option>
                              <option value="Outros">Outros</option>
                            </select>
                          )}
                        </td>

                        {/* T. Nutrientes - Entrada / Saída */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1">
                            <Input
                              value={row.nutrients_in || ''}
                              onChange={(e) =>
                                handleUpdateRowCell(row.id, 'nutrients_in', e.target.value)
                              }
                              placeholder="Entrada"
                              title="T. Nutrientes — Entrada"
                              className="h-9 text-xs font-mono text-center flex-1"
                            />
                            <span className="text-slate-400">/</span>
                            <Input
                              value={row.nutrients_out || ''}
                              onChange={(e) =>
                                handleUpdateRowCell(row.id, 'nutrients_out', e.target.value)
                              }
                              placeholder="Saída"
                              title="T. Nutrientes — Saída"
                              className="h-9 text-xs font-mono text-center flex-1"
                            />
                          </div>
                        </td>

                        {/* Responsável */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800">
                          <Input
                            value={row.responsible}
                            onChange={(e) =>
                              handleUpdateRowCell(row.id, 'responsible', e.target.value)
                            }
                            placeholder="Nome"
                            className="h-9 text-xs"
                          />
                        </td>

                        {/* Excluir linha */}
                        <td className="p-2 border border-slate-200 dark:border-slate-800 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMeasurementRow(row.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Observações Gerais */}
      <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Observações e Anotações de Campo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Informações adicionais sobre calibração de sondas, intercorrências ou trocas de insumos..."
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950"
          />
        </CardContent>
      </Card>

      {/* Confirmação de exclusão */}
      <AlertDialog open={Boolean(deleteConfirmId)} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir esta planilha In-Situ?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente todos os registros de medição desta folha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
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
