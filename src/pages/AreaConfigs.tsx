import { useCallback, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Layers,
  Plus,
  Pencil,
  Power,
  Save,
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  ListChecks,
  Lock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/appVersion'
import { PRESET_DATE_KEYS, countConfiguredFields } from '@/lib/fieldSheetConfigMetadata'
import type { AreaConfigRecord, PresetFields } from '@/lib/fieldSheetConfigMetadata'
import FieldSheetEditorForm from '@/components/FieldSheetEditorForm'
import {
  emptyFieldSheetFormState,
  presetFieldsToFormState,
  formStateToPresetFields,
  countFilledFormFields,
  type FieldSheetFormState,
} from '@/components/FieldSheetEditorForm'

type ConfigForm = {
  id: string
  area_name: string
  contract_number: string
  description: string
  active: boolean
  config_version: number
  preset_fields: PresetFields
}

const emptyForm = (): ConfigForm => ({
  id: '',
  area_name: '',
  contract_number: '',
  description: '',
  active: true,
  config_version: 0,
  preset_fields: {},
})

export default function AreaConfigs() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [records, setRecords] = useState<AreaConfigRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ConfigForm | null>(null)
  const [isEditingExisting, setIsEditingExisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<AreaConfigRecord | null>(null)
  // Estado do formulário ÚNICO da Planilha de Campo (modo admin-config)
  const [sheetForm, setSheetForm] = useState<FieldSheetFormState>(() => emptyFieldSheetFormState())

  const isAdmin = user?.role === 'admin'

  const loadRecords = useCallback(async () => {
    setLoading(true)
    try {
      if (!navigator.onLine || !pb.authStore.isValid) {
        setRecords([])
      } else {
        const recs = await pb.collection('area_configs').getFullList({ sort: 'area_name' })
        setRecords(recs as unknown as AreaConfigRecord[])
      }
    } catch (err) {
      console.warn('Erro ao carregar configurações de área:', err)
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível ler a lista de áreas configuradas. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (isAdmin) loadRecords()
  }, [isAdmin, loadRecords])

  const startNew = () => {
    setIsEditingExisting(false)
    setEditing(emptyForm())
    setSheetForm(emptyFieldSheetFormState())
  }

  const startEdit = (rec: AreaConfigRecord) => {
    setIsEditingExisting(true)
    setEditing({
      id: rec.id,
      area_name: rec.area_name || '',
      contract_number: rec.contract_number || '',
      description: rec.description || '',
      active: rec.active !== false,
      config_version: rec.config_version || 0,
      preset_fields:
        rec.preset_fields && typeof rec.preset_fields === 'object' ? { ...rec.preset_fields } : {},
    })
    setSheetForm(presetFieldsToFormState(rec.preset_fields))
  }

  const setField = (key: keyof ConfigForm, value: unknown) => {
    setEditing((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const handleSave = async () => {
    if (!editing) return
    const name = (editing.area_name || '').trim()
    if (!name) {
      toast({
        title: 'Informe o nome da área/localidade',
        description: 'O nome da área é obrigatório para vincular a planilha ao preenchimento.',
        variant: 'destructive',
      })
      return
    }
    // Validação leve das chaves de data (mesma regra DD/MM/AAAA da Planilha de Campo)
    // (filledCount vem do escopo do componente — fonte INDEPENDENTE da serialização)
    const presetOut = formStateToPresetFields(sheetForm)
    const serializedCount = Object.keys(presetOut).length
    // LOG DE DEBUG temporário: prova em tela (console) o round-trip do estado do
    // editor -> serialização. "keys=19" do sheetForm é só a ESTRUTURA do estado
    // (emptyFieldSheetFormState sempre nasce com 19 chaves) — o que prova dados
    // é filledCount x serializedCount, com a versão do bundle no log para o
    // usuário confirmar qual build está executando o save.
    // Contagens ANINHADAS para leitura clara: 2 linhas de poços colapsam em 1
    // chave 'wells' no preset (o mesmo vale para saídas de infiltração e para
    // compressores), então serializedCount é MENOR que filledCount por
    // estrutura — não é perda. O que prova integridade é o presetOut impresso
    // logo abaixo (as linhas continuam lá dentro de wells[]).
    const wellsOut = Array.isArray(presetOut.wells) ? (presetOut.wells as unknown[]).length : 0
    const exitsOut = Array.isArray(presetOut.infiltration_exits)
      ? (presetOut.infiltration_exits as unknown[]).length
      : 0
    const compressorOut = Number(presetOut.compressor_count) || 0
    console.log(
      `[AreaConfigs][handleSave] build v${APP_VERSION}`,
      '| filledCount=',
      filledCount,
      '| serializedCount=',
      serializedCount,
      `(chaves de topo; poços=${wellsOut} linha(s), saídas=${exitsOut} linha(s), compressores=${compressorOut})`,
      '| presetOut=',
      JSON.parse(JSON.stringify(presetOut || {})),
    )
    // TRAVA ANTI-PERDA (mantida da v0.0.223, com régua melhor): se a tela mostra
    // campos preenchidos mas a serialização saiu vazia, é falha interna — nunca
    // gravar vazio em silêncio. (A perda PARCIAL agora é estruturalmente
    // impossível: o serializador e o contador usam o MESMO código de mapas.)
    if (filledCount > 0 && serializedCount === 0) {
      console.error(
        '[AreaConfigs] Serialização VAZIA com',
        filledCount,
        'campo(s) visível(is) na tela — salvamento bloqueado.',
      )
      toast({
        title: 'Falha interna de serialização',
        description:
          'Seus dados NÃO foram salvos; recarregue a página (Ctrl+Shift+R) e tente de novo.',
        variant: 'destructive',
      })
      return
    }
    // Chaves de data — mesma regra DD/MM/AAAA da Planilha de Campo. O serializador
    // grava as datas de remoção de óleo como chaves PLANAS (oil_removal.sao1DataLimpeza
    // etc. — mesmas chaves consumidas pelo hook de preset da planilha).
    for (const dk of PRESET_DATE_KEYS) {
      const v = presetOut[`oil_removal.${dk}`]
      if (typeof v === 'string' && v.trim() !== '') {
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim())
        if (!m) {
          toast({
            title: 'Data inválida',
            description: `Preencha ${dk === 'sao1DataLimpeza' ? 'SAO 01' : 'SAO 02'} com o formato DD/MM/AAAA.`,
            variant: 'destructive',
          })
          return
        }
      }
    }

    setSaving(true)
    try {
      const payload = {
        area_name: name,
        contract_number: (editing.contract_number || '').trim(),
        description: (editing.description || '').trim(),
        active: editing.active,
        preset_fields: presetOut,
      }
      // EVIDÊNCIA DO ROUND-TRIP: após o save bem-sucedido, comparamos o que a
      // tela serializou (presetOut) com o que o SERVIDOR devolveu no registro
      // salvo. Se saiu preenchido e voltou vazio, avisamos o usuário na hora —
      // os logs do backend ([area_configs] ... RAW-BODY) mostram o que chegou.
      type SavedAreaConfig = { preset_fields?: PresetFields | null }
      const saved = (isEditingExisting && editing.id
        ? await pb.collection('area_configs').update(editing.id, payload)
        : await pb.collection('area_configs').create(payload)) as unknown as SavedAreaConfig
      const savedPreset = saved?.preset_fields ?? null
      const savedKeys = Object.keys(savedPreset || {})
      console.log(
        `[AreaConfigs][handleSave] resposta do servidor (build v${APP_VERSION})`,
        '| savedPresetFieldsKeys=',
        savedKeys.length,
        '| savedPresetFields=',
        JSON.parse(JSON.stringify(savedPreset || {})),
      )
      if (serializedCount > 0 && savedKeys.length === 0) {
        console.error(
          '[AreaConfigs] SERVIDOR PERSISTIU preset_fields VAZIO — presetOut tinha',
          serializedCount,
          'chave(s). Dados podem não ter sido persistidos.',
        )
        toast({
          title: 'Servidor recebeu a configuração vazia',
          description:
            'Seus dados podem não ter sido persistidos. Informe o suporte (evidência: log do console).',
          variant: 'destructive',
        })
      }
      if (isEditingExisting) {
        toast({
          title: 'Configuração atualizada',
          description: `Área "${name}" salva (nova versão da configuração).`,
        })
      } else {
        toast({ title: 'Área configurada', description: `Área "${name}" cadastrada com sucesso.` })
      }
      setEditing(null)
      await loadRecords()
    } catch (err: unknown) {
      const anyErr = err as { message?: string; status?: number }
      if (anyErr?.status === 400) {
        toast({
          title: 'Nome de área já existe',
          description: 'Já há uma configuração cadastrada com esse nome de área/localidade.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Erro ao salvar',
          description:
            anyErr?.message || 'Não foi possível gravar a configuração. Tente novamente.',
          variant: 'destructive',
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!confirmToggle) return
    const rec = confirmToggle
    setConfirmToggle(null)
    setSaving(true)
    try {
      await pb.collection('area_configs').update(rec.id, { active: !rec.active })
      toast({
        title: !rec.active ? 'Área reativada' : 'Área desativada',
        description: !rec.active
          ? `A área "${rec.area_name}" voltou a ficar disponível para o Técnico.`
          : `A área "${rec.area_name}" não aparecerá mais na seleção de novas planilhas.`,
      })
      await loadRecords()
    } catch (err: unknown) {
      const anyErr = err as { message?: string }
      toast({
        title: 'Erro ao alterar situação',
        description: anyErr?.message || 'Não foi possível alterar a situação da área.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // ---------- LISTA ----------
  if (!editing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Configuração de Áreas da Planilha de Campo
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Cadastre as áreas/localidades, informe contrato e descrição e pré-preencha os valores
              padronizados da Planilha de Campo para cada área.
            </p>
          </div>
          <Button onClick={startNew} className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-1.5 h-4 w-4" />
            Nova área
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
          </div>
        ) : records.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Nenhuma área configurada ainda
              </p>
              <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
                Cadastre a primeira área para que o Técnico a selecione na Planilha de Campo e
                receba automaticamente contrato, descrição e os valores padronizados.
              </p>
              <Button onClick={startNew} variant="outline" className="mt-2">
                <Plus className="mr-1.5 h-4 w-4" />
                Cadastrar primeira área
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {records.map((rec) => {
              const active = rec.active !== false
              return (
                <Card key={rec.id} className={cn(!active && 'opacity-70')}>
                  <CardContent className="flex h-full flex-col gap-3 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {rec.area_name}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {rec.contract_number || 'Sem contrato informado'}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'shrink-0',
                          active
                            ? 'border-emerald-300 text-emerald-700 dark:text-emerald-300'
                            : 'border-slate-300 text-slate-500 dark:text-slate-400',
                        )}
                      >
                        {active ? 'Ativa' : 'Desativada'}
                      </Badge>
                    </div>
                    {rec.description && (
                      <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                        {rec.description}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <ListChecks className="h-3.5 w-3.5" />
                        {countConfiguredFields(rec.preset_fields)} campo(s) pré-preenchido(s)
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(rec)}
                          className="h-8 px-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmToggle(rec)}
                          className="h-8 px-2"
                          title={active ? 'Desativar área' : 'Reativar área'}
                        >
                          <Power className={cn('h-3.5 w-3.5', active && 'text-emerald-600')} />
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Configuração v{rec.config_version || 0}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Confirmação de desativação/reativação */}
        {confirmToggle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-md">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {confirmToggle.active !== false ? 'Desativar área' : 'Reativar área'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {confirmToggle.active !== false
                        ? `A área "${confirmToggle.area_name}" deixará de aparecer na seleção de novas planilhas. Planilhas já criadas preservam os valores carregados (snapshot).`
                        : `A área "${confirmToggle.area_name}" voltará a aparecer na seleção de novas planilhas.`}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirmToggle(null)}>
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    variant={confirmToggle.active !== false ? 'destructive' : 'default'}
                    onClick={handleToggleActive}
                  >
                    {confirmToggle.active !== false ? 'Desativar' : 'Reativar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  // ---------- FORMULÁRIO ----------
  // Contador INDEPENDENTE da serialização: conta os campos preenchidos
  // DIRETO no estado do editor (countFilledFormFields). Se fosse derivado da
  // mesma função que serializa (tautologia antiga), a trava anti-perda nunca
  // dispararia — agora detecta perda real e bloqueia o save.
  const filledCount = countFilledFormFields(sheetForm)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => setEditing(null)} className="shrink-0">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Voltar
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-slate-900 dark:text-white">
            {isEditingExisting
              ? `Editar área — ${editing.area_name || 'área'}`
              : 'Nova área da Planilha de Campo'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O que você pré-preencher aqui carrega bloqueado para o Técnico em cada nova planilha
            desta área.
          </p>
        </div>
        <span
          className="ml-auto shrink-0 select-none text-[10px] text-slate-400 dark:text-slate-500"
          title="Versão do bundle em execução neste dispositivo"
        >
          build v{APP_VERSION}
        </span>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="epa-label">NOME DA ÁREA / LOCALIDADE *</label>
              <Input
                className="mt-1"
                placeholder="Ex.: Área Industrial — Tanque 3"
                value={editing.area_name}
                onChange={(e) => setField('area_name', e.target.value)}
                disabled={isEditingExisting}
              />
              {isEditingExisting && (
                <p className="mt-1 text-[10px] text-slate-400">
                  O nome não pode ser alterado: ele é a chave de vínculo com as planilhas.
                </p>
              )}
            </div>
            <div>
              <label className="epa-label">NÚMERO DO CONTRATO</label>
              <Input
                className="mt-1"
                placeholder='Ex.: "CT 5900089378"'
                value={editing.contract_number}
                onChange={(e) => setField('contract_number', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                <Switch checked={editing.active} onCheckedChange={(v) => setField('active', v)} />
                <span>Área ativa (aparece na seleção do Técnico)</span>
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="epa-label">DESCRIÇÃO</label>
              <Input
                className="mt-1"
                placeholder='Ex.: "Monitoramento ambiental"'
                value={editing.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Estrutura da Planilha de Campo — pré-preenchimento
          </span>
        </div>
        <Badge
          variant="outline"
          className="border-emerald-300 text-emerald-700 dark:text-emerald-300"
        >
          {filledCount} campo(s) pré-preenchido(s)
        </Badge>
      </div>

      <FieldSheetEditorForm
        mode="admin-config"
        value={sheetForm}
        onChange={setSheetForm}
        disabled={saving}
      />

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Campos preenchidos aqui ficam somente leitura para o Técnico (bloqueio condicional ao
          conteúdo). Editar esta configuração depois não altera planilhas já criadas: elas mantêm o
          snapshot gravado no momento do preenchimento.
        </span>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}
