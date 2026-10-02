import { useState, useEffect, useMemo } from 'react'
import { Activity, Plus, Trash2, Save, ArrowLeft, Send, FileDown, Sparkles } from 'lucide-react'
import {
  printInSituSheet,
  buildDefaultNutrientRows,
  createNutrientTrio,
  IN_SITU_REPETITION_COUNT,
} from '@/services/inSituSheetExport'
import { EPA_LOGO_BASE64 } from '@/assets/epaLogoBase64'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { applyShortDateMask, isValidBrDate } from '@/lib/dateMask'
import { inSituService } from '@/services/inSituAndNaService'
import { auditExport } from '@/services/epa'
import type { InSituSheet, InSituNutrientRowData } from '@/types/inSituAndNa'

export function InSituPage({ query = '' }: { query?: string }) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [sheets, setSheets] = useState<InSituSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState<InSituSheet | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Formulário ativo digitalizado conforme o modelo oficial IN SITU REV2
  const [formData, setFormData] = useState<Partial<InSituSheet>>({
    project_name: '21-0229',
    system_name: '',
    active_number: '',
    rev: '',
    rev_date: '',
    status: 'draft',
    notes: '',
    records: [],
    nutrient_rows: [],
  })

  const isAdmin = user?.role === 'admin'

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
        s.active_number?.toLowerCase().includes(q) ||
        s.responsible_name?.toLowerCase().includes(q),
    )
  }, [sheets, query])

  const handleStartNew = () => {
    setFormData({
      project_name: '21-0229',
      system_name: '',
      active_number: '',
      rev: '', // Sem valor fixo no código, Técnico e Admin preenchem
      rev_date: '', // Sem valor fixo no código, máscara com barras fixas
      responsible_name: user?.name || '',
      status: 'draft',
      notes: '',
      records: [],
      nutrient_rows: [], // Nasce vazia
    })
    setSelectedSheet(null)
    setIsEditing(true)
  }

  const handleOpenSheet = (sheet: InSituSheet) => {
    setSelectedSheet(sheet)
    const nutrientRows = Array.isArray(sheet.nutrient_rows) ? sheet.nutrient_rows : []
    setFormData({
      ...sheet,
      rev: sheet.rev || '',
      rev_date: sheet.rev_date || '',
      records: sheet.records || [],
      nutrient_rows: nutrientRows,
    })
    setIsEditing(true)
  }

  // Adiciona dinamicamente um novo conjunto completo (ENTRADA + SAÍDA + T. NUTRIENTES)
  const handleAddDayRecord = () => {
    setFormData((prev) => {
      const currentRows = prev.nutrient_rows || []

      // Determina o próximo system_index a partir do maior existente
      const maxIndex = currentRows.reduce((acc, r) => Math.max(acc, r.system_index ?? 0), -1)
      const nextIndex = maxIndex + 1

      // Cria novo trio sem herança automática ou com data vazia
      const newTrio = createNutrientTrio(nextIndex, '')
      return {
        ...prev,
        nutrient_rows: [...currentRows, ...newTrio],
      }
    })

    toast({
      title: 'Novo Registro / Dia adicionado',
      description: 'Conjunto ENTRADA, SAÍDA e T. NUTRIENTES incluído na planilha.',
    })
  }

  const handleUpdateRowCell = (
    rowId: string,
    field: keyof InSituNutrientRowData,
    value: string,
  ) => {
    setFormData((prev) => {
      const currentRows = prev.nutrient_rows || []

      const updatedNutrientRows = currentRows.map((r) => {
        if (r.id !== rowId) return r
        return {
          ...r,
          [field]: field === 'date' ? applyShortDateMask(value) : value,
        }
      })

      return {
        ...prev,
        nutrient_rows: updatedNutrientRows,
      }
    })
  }

  const handleSave = async (newStatus?: 'draft' | 'submitted' | 'approved') => {
    if (!formData.project_name?.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Informe o código do PROJETO (ex: 21-0229).',
        variant: 'destructive',
      })
      return
    }

    if (formData.rev_date && !isValidBrDate(formData.rev_date)) {
      toast({
        title: 'Data da Revisão inválida',
        description: 'Informe uma data válida no formato DD/MM/AA (ex: 15/07/26).',
        variant: 'destructive',
      })
      return
    }

    const currentRows = formData.nutrient_rows || []

    // Validação de datas preenchidas nas linhas
    for (const row of currentRows) {
      if (row.date && !isValidBrDate(row.date)) {
        toast({
          title: 'Data inválida na planilha',
          description: `A data "${row.date}" na linha "${row.type}" é inválida. Utilize o formato DD/MM/AA (ex: 15/07/26).`,
          variant: 'destructive',
        })
        return
      }
    }

    try {
      const payload: Partial<InSituSheet> = {
        ...formData,
        date: formData.rev_date || '', // mantém sincronizado para compatibilidade
        rev: formData.rev || '',
        rev_date: formData.rev_date || '',
        nutrient_rows: currentRows,
        id: selectedSheet?.id,
        status: newStatus || formData.status || 'draft',
      }

      const saved = await inSituService.saveSheet(payload)
      setSelectedSheet(saved)
      setFormData({
        ...saved,
        nutrient_rows: saved.nutrient_rows || [],
      })
      toast({
        title: 'Planilha In-Situ salva com sucesso!',
        description:
          newStatus === 'submitted'
            ? 'Planilha enviada para aprovação.'
            : 'As medições da planilha in-situ foram salvas.',
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

  // Visualização de lista
  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
                Planilha in-situ (REV 02)
              </h1>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                Modelo Oficial EPA
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Versão digital exata da planilha física de Medições In-Situ (REV 02. 15/07/26).
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

        {/* Resumo de orientações do documento oficial */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5 dark:text-emerald-400" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                Regras Obrigatórias do Documento Oficial (REV 02. 15/07/26):
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>
                  <b>OD SEMPRE EM MG/L:</b> OD sempre deve ser medido em mg/L, <u>NUNCA em %</u>.
                </li>
                <li>
                  <b>CONDUTIVIDADE:</b> A unidade altera-se automaticamente, anote sempre a unidade
                  que está no visor!
                </li>
                <li>
                  <b>Estrutura original:</b> 5 repetições de ENTRADA / SAÍDA / T. NUTRIENTES (15
                  linhas) com 11 colunas de medição.
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
                Nenhuma planilha in-situ encontrada
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1">
                Clique no botão acima para abrir a versão digital da planilha in-situ.
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
              const sheetRows = Array.isArray(sheet.nutrient_rows) ? sheet.nutrient_rows : []
              const filledCount = sheetRows.filter(
                (r) => r.ph || r.conductivity || r.od_mg_l || r.date,
              ).length
              const revLabel = sheet.rev ? `REV ${sheet.rev}` : ''
              const revDateLabel = sheet.rev_date ? sheet.rev_date : ''
              const revFull = [revLabel, revDateLabel].filter(Boolean).join('. ')

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
                          PROJETO: {sheet.project_name || '21-0229'}
                        </CardTitle>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          SISTEMA: {sheet.system_name || '—'}
                        </p>
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
                      <span>Nº Ativo:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {sheet.active_number || '—'}
                      </span>
                    </div>
                    {revFull && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span>Identificação:</span>
                        <span className="font-mono font-semibold text-emerald-800 dark:text-emerald-300">
                          {revFull}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Medições diárias:</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {sheetRows.length === 0
                          ? '0 registros'
                          : `${filledCount} de ${sheetRows.length} medições (${Math.floor(sheetRows.length / 3)} dias)`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Preenchimento da planilha digital (fiel ao documento físico anexado IN SITU REV2)
  const rows = formData.nutrient_rows || []

  return (
    <div className="space-y-4">
      {/* Barra superior de ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
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
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              Planilha In-Situ (Digital)
            </span>
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                auditExport(
                  'export_pdf',
                  'in_situ_sheets',
                  selectedSheet?.id || formData.project_name || 'in_situ',
                  `Planilha_In_Situ_${formData.project_name || 'EPA'}.pdf`,
                  { label: `Planilha In-Situ · ${formData.project_name || '21-0229'}` },
                ).catch(() => {})
              } catch {
                /* intentionally ignored */
              }
              printInSituSheet(formData as InSituSheet)
            }}
            className="text-xs min-h-[36px] border-sky-400 text-sky-900 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 font-semibold"
            title="Exporta o PDF ou imprime com layout idêntico ao documento original REV 02"
          >
            <FileDown className="mr-1.5 h-3.5 w-3.5" />
            Exportar PDF / Imprimir
          </Button>

          {isAdmin && selectedSheet?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmId(selectedSheet.id)}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 min-h-[36px]"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Excluir
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave('draft')}
            className="text-xs border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 min-h-[36px]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Salvar Rascunho
          </Button>

          <Button
            size="sm"
            onClick={() => handleSave('submitted')}
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs min-h-[36px] shadow-sm font-semibold"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            Salvar e Enviar
          </Button>
        </div>
      </div>

      {/* DOCUMENTO DIGITAL IN-SITU (Versão digital da planilha física original) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-3 sm:p-5 shadow-sm">
        {/* Top Header: Logo EPA | MEDIÇÕES IN-SITU | Planilha in-situ — REV {rev}. {data} (Editáveis por Admin e Técnico) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-full sm:w-48 flex justify-center sm:justify-start">
            <img
              src={EPA_LOGO_BASE64}
              alt="Grupo EPA - A Engenharia Protegendo o Ambiente"
              className="max-h-12 max-w-[160px] object-contain"
            />
          </div>

          <div className="flex-1 text-center">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight uppercase">
              MEDIÇÕES IN-SITU
            </h1>
          </div>

          <div className="w-full sm:w-72 flex justify-center sm:justify-end">
            {/* Bloco de identificação oficial: Planilha in-situ — REV [XX]. [DD/MM/AA] (Editável por Admin e Técnico, sem valor fixo) */}
            <div className="bg-[#eaf6d8] dark:bg-lime-950/60 text-[#557924] dark:text-lime-300 border border-[#cbe5a3] dark:border-lime-800 px-3 py-1.5 rounded text-center text-[11px] font-bold leading-tight shadow-xs w-full sm:w-auto">
              <div className="tracking-wide">Planilha in-situ</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold">
                <span className="font-bold">REV</span>
                <input
                  type="text"
                  value={formData.rev ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, rev: e.target.value }))}
                  placeholder="XX"
                  title="Número da Revisão (ex: 02)"
                  className="w-9 h-5 text-center font-bold font-mono bg-white/90 dark:bg-slate-900/90 border border-lime-400 dark:border-lime-700 rounded px-0.5 text-[#557924] dark:text-lime-300 focus:outline-none focus:ring-1 focus:ring-lime-500"
                />
                <span className="font-bold">.</span>
                <input
                  type="text"
                  value={formData.rev_date ?? ''}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      rev_date: applyShortDateMask(e.target.value),
                    }))
                  }
                  placeholder="DD/MM/AA"
                  maxLength={8}
                  title="Data da Revisão no formato DD/MM/AA com barras automáticas (ex: 15/07/26)"
                  className={cn(
                    'w-20 h-5 text-center font-bold font-mono bg-white/90 dark:bg-slate-900/90 border border-lime-400 dark:border-lime-700 rounded px-1 text-[#557924] dark:text-lime-300 focus:outline-none focus:ring-1 focus:ring-lime-500',
                    formData.rev_date &&
                      !isValidBrDate(formData.rev_date) &&
                      'border-rose-500 text-rose-600',
                  )}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Faixa Oficial: PROJETO | SISTEMA | NÚMERO ATIVO (sem campo de data separado conforme requisito 1) */}
        <div className="grid grid-cols-1 md:grid-cols-12 border-2 border-[#334155] dark:border-slate-700 bg-white dark:bg-slate-900 mb-3 text-xs divide-y md:divide-y-0 md:divide-x divide-slate-400 dark:divide-slate-700">
          <div className="md:col-span-4 p-2 flex items-center gap-2">
            <span className="font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              PROJETO:
            </span>
            <input
              type="text"
              value={formData.project_name || ''}
              onChange={(e) => setFormData((p) => ({ ...p, project_name: e.target.value }))}
              placeholder="21-0229"
              className="w-full font-bold text-slate-900 dark:text-slate-100 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-xs"
            />
          </div>

          <div className="md:col-span-5 p-2 flex items-center gap-2">
            <span className="font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              SISTEMA:
            </span>
            <input
              type="text"
              value={formData.system_name || ''}
              onChange={(e) => setFormData((p) => ({ ...p, system_name: e.target.value }))}
              placeholder="Digite o sistema..."
              className="w-full font-medium text-slate-900 dark:text-slate-100 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-xs"
            />
          </div>

          <div className="md:col-span-3 p-2 flex items-center gap-2">
            <span className="font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              NÚMERO ATIVO:
            </span>
            <input
              type="text"
              value={formData.active_number || ''}
              onChange={(e) => setFormData((p) => ({ ...p, active_number: e.target.value }))}
              placeholder="Ex.: AT-01"
              className="w-full font-mono font-medium text-slate-900 dark:text-slate-100 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 text-xs"
            />
          </div>
        </div>

        {/* Barra de controle dos registros diários: Botão ÚNICO "＋ Adicionar Registro / Dia" */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-1.5 mb-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleAddDayRecord}
              className="bg-sky-700 hover:bg-sky-800 text-white text-xs h-9 px-3.5 shadow-sm font-semibold"
              title="Adiciona um novo conjunto completo diário: ENTRADA + SAÍDA + T. NUTRIENTES"
            >
              <Plus className="mr-1.5 h-4 w-4" />＋ Adicionar Registro / Dia
            </Button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Cada clique adiciona o trio completo (ENTRADA + SAÍDA + T. NUTRIENTES)
            </span>
          </div>

          <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
            Total de linhas:{' '}
            <strong className="text-slate-900 dark:text-slate-100">{rows.length}</strong> (
            {Math.floor(rows.length / 3)} dias/conjuntos)
          </div>
        </div>

        {/* Indicador de rolagem para telas menores */}
        <p className="py-1 text-[11px] text-slate-500 xl:hidden">
          👉 Deslize horizontalmente para visualizar e editar todas as 11 colunas da planilha física
        </p>

        {/* Tabela Oficial Única: 11 colunas x N linhas dinâmicas (conjuntos de ENTRADA/SAÍDA/T. NUTRIENTES) */}
        <div className="overflow-x-auto border-2 border-[#334155] dark:border-slate-700 mb-3 shadow-xs">
          <table className="w-full min-w-[1100px] border-collapse text-left text-xs bg-white dark:bg-slate-950">
            <colgroup>
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr className="bg-[#bde4f7] text-[#0b4e7b] dark:bg-sky-950 dark:text-sky-200 font-extrabold text-[11px] text-center divide-x-2 divide-[#475569] dark:divide-slate-700 border-b-2 border-[#334155] dark:border-slate-700">
                <th className="p-2 leading-tight">
                  PONTO DE
                  <br />
                  MEDIÇÃO
                </th>
                <th className="p-2">DATA</th>
                <th className="p-2">HORA</th>
                <th className="p-2">pH</th>
                <th className="p-2">Cond.</th>
                <th className="p-2 leading-tight">
                  OD
                  <br />
                  (mg/L)
                </th>
                <th className="p-2 leading-tight">
                  Temp.
                  <br />
                  (ºC)
                </th>
                <th className="p-2">ORP</th>
                <th className="p-2 leading-tight">
                  TURVA
                  <br />
                  (sim/não)
                </th>
                <th className="p-2">CLIMA</th>
                <th className="p-2 leading-tight">
                  RESPONSÁVEL PELAS
                  <br />
                  MEDIÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-slate-500 bg-slate-50/60 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Nenhum registro diário adicionado.
                      </p>
                      <Button
                        type="button"
                        onClick={handleAddDayRecord}
                        size="sm"
                        className="bg-sky-700 hover:bg-sky-800 text-white text-xs h-8 px-3"
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Adicionar Primeiro Registro / Dia (ENTRADA + SAÍDA + T. NUTRIENTES)
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="divide-x divide-slate-300 dark:divide-slate-700 hover:bg-sky-50/40 dark:hover:bg-slate-900/60"
                  >
                    {/* PONTO DE MEDIÇÃO: ENTRADA / SAÍDA / T. NUTRIENTES em azul oficial com borda destacada */}
                    <td className="px-2 py-1.5 text-center font-extrabold text-[#004b87] dark:text-sky-400 bg-slate-50/80 dark:bg-slate-950 select-none tracking-tight">
                      {row.type}
                    </td>

                    {/* DATA */}
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.date || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'date', e.target.value)}
                        placeholder="DD/MM/AA"
                        maxLength={8}
                        className={cn(
                          'w-full h-7 px-1 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500',
                          row.date &&
                            !isValidBrDate(row.date) &&
                            'bg-rose-50 text-rose-700 font-semibold border-rose-300',
                        )}
                      />
                    </td>
                    {/* HORA */}
                    <td className="p-1">
                      <input
                        type="time"
                        value={row.time || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'time', e.target.value)}
                        className="w-full h-7 px-0.5 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* pH */}
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.ph || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'ph', e.target.value)}
                        className="w-full h-7 px-1 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* Cond. (com campo de unidade ao lado) */}
                    <td className="p-1">
                      <div className="flex items-center gap-0.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.conductivity || ''}
                          onChange={(e) =>
                            handleUpdateRowCell(row.id, 'conductivity', e.target.value)
                          }
                          placeholder=""
                          className="w-full h-7 px-1 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <input
                          type="text"
                          value={row.conductivity_unit ?? 'µS/cm'}
                          onChange={(e) =>
                            handleUpdateRowCell(row.id, 'conductivity_unit', e.target.value)
                          }
                          placeholder="unid"
                          title="Anote a unidade indicada no visor (ex: µS/cm, mS/cm)"
                          className="w-12 h-6 text-[9px] font-mono text-center text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                        />
                      </div>
                    </td>

                    {/* OD (mg/L) */}
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.od_mg_l || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'od_mg_l', e.target.value)}
                        placeholder=""
                        title="OD SEMPRE DEVE SER MEDIDO EM MG/L NUNCA EM %"
                        className="w-full h-7 px-1 text-center font-mono font-semibold text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* Temp. (ºC) */}
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.temperature_c || ''}
                        onChange={(e) =>
                          handleUpdateRowCell(row.id, 'temperature_c', e.target.value)
                        }
                        placeholder=""
                        className="w-full h-7 px-1 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* ORP */}
                    <td className="p-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.orp || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'orp', e.target.value)}
                        placeholder=""
                        className="w-full h-7 px-1 text-center font-mono text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* TURVA (sim/não) */}
                    <td className="p-1">
                      <select
                        value={row.turbidity || ''}
                        onChange={(e) =>
                          handleUpdateRowCell(row.id, 'turbidity', e.target.value as any)
                        }
                        className="w-full h-7 px-1 text-center text-xs bg-white dark:bg-slate-950 rounded-xs border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">—</option>
                        <option value="não">não</option>
                        <option value="sim">sim</option>
                      </select>
                    </td>

                    {/* CLIMA */}
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.weather || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'weather', e.target.value)}
                        placeholder=""
                        className="w-full h-7 px-1 text-center text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>

                    {/* RESPONSÁVEL PELAS MEDIÇÕES */}
                    <td className="p-1">
                      <input
                        type="text"
                        value={row.responsible || ''}
                        onChange={(e) => handleUpdateRowCell(row.id, 'responsible', e.target.value)}
                        placeholder=""
                        className="w-full h-7 px-1 text-center text-xs bg-white dark:bg-transparent rounded-xs border border-slate-300 dark:border-transparent focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Faixa Inferior de Avisos Obrigatórios (Idêntica à cor e texto do PDF REV 02) */}
        <div className="border border-[#e09875] bg-[#faede5] dark:border-orange-900/60 dark:bg-orange-950/30 p-2.5 text-xs text-slate-900 dark:text-orange-200 space-y-0.5 leading-snug">
          <div className="font-bold">
            ATENÇÃO AS UNIDADES DE MEDIDAS: OD SEMPRE DEVE SER MEDIDO EM MG/L{' '}
            <span className="font-extrabold underline">NUNCA EM %</span>
          </div>
          <div className="font-semibold text-slate-800 dark:text-orange-200">
            CONDUTIVIDADE A UNIDADE ALTERA-SE AUTOMATICAMENTE, ANOTE SEMPRE A UNIDADE QUE ESTÁ NO
            VISOR!
          </div>
        </div>
      </div>

      {/* Confirmação de exclusão */}
      <AlertDialog open={Boolean(deleteConfirmId)} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja excluir esta planilha In-Situ?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente esta planilha e todas as suas medições.
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
