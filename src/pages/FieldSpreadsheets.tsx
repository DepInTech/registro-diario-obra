import { useMemo, useState } from 'react'
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
  MoreHorizontal,
  Plus,
  Recycle,
  Save,
  Search,
  Send,
  Settings2,
  TestTubes,
  X,
} from 'lucide-react'
import { fieldSheets, type FieldSheet, type Status } from '@/data/epa'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { authHeaders, exportUrl, updateFieldStatus } from '@/services/workspace'

export function FieldSpreadsheets({ query }: { query: string }) {
  const [editing, setEditing] = useState<FieldSheet | null>(null)
  const [items, setItems] = useState(fieldSheets)
  const filtered = items.filter((s) =>
    `${s.project} ${s.area} ${s.date}`.toLowerCase().includes(query.toLowerCase()),
  )
  const openNew = () =>
    setEditing({
      id: 'new-field',
      projectId: 'epa-rsl-a01',
      project: 'Recuperação Ambiental Lote A',
      date: '28 mai 2025',
      area: 'Lote A — Setor Leste',
      status: 'draft',
      extraction: 0,
      map: 0,
      urea: 0,
      liquidWaste: 0,
      environment: false,
      operator: 'Carlos Oliveira',
    })
  if (editing)
    return (
      <FieldEditor
        sheet={editing}
        onBack={() => setEditing(null)}
        onStatus={(status) =>
          setItems((prev) => prev.map((s) => (s.id === editing.id ? { ...s, status } : s)))
        }
      />
    )
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Volume no mês', '12.840 L', Droplets, 'emerald'],
          ['Nutrientes aplicados', '184 kg', Beaker, 'blue'],
          ['Resíduos líquidos', '28,4 L', Recycle, 'amber'],
          ['Checklists conformes', '92%', Leaf, 'teal'],
        ].map(([label, value, Icon, color]) => (
          <div key={label as string} className="epa-card flex items-center gap-4 p-5">
            <div
              className={`grid h-11 w-11 place-items-center rounded-xl bg-${color}-50 text-${color}-700`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-semibold">{value as string}</p>
              <p className="text-xs text-slate-500">{label as string}</p>
            </div>
          </div>
        ))}
      </div>
      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por projeto, área ou data..." />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtrar
          </Button>
          <Button onClick={openNew} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus className="mr-2 h-4 w-4" />
            Nova planilha
          </Button>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((sheet) => (
            <button
              onClick={() => setEditing(sheet)}
              key={sheet.id}
              className="group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <StatusBadge status={sheet.status} />
              </div>
              <p className="mt-4 text-sm font-semibold group-hover:text-emerald-700">
                {sheet.project}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {sheet.area} · {sheet.date}
              </p>
              <div className="mt-4 grid grid-cols-3 divide-x border-y py-3 text-center">
                <div>
                  <p className="font-mono text-sm font-semibold">{sheet.extraction} L</p>
                  <p className="text-[9px] text-slate-400">Extração</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold">{sheet.map + sheet.urea} kg</p>
                  <p className="text-[9px] text-slate-400">Nutrientes</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold">{sheet.liquidWaste} L</p>
                  <p className="text-[9px] text-slate-400">Resíduo</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-slate-400">Por {sheet.operator}</span>
                <span className="font-semibold text-emerald-700">Abrir planilha →</span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function FieldEditor({
  sheet,
  onBack,
  onStatus,
}: {
  sheet: FieldSheet
  onBack: () => void
  onStatus: (status: Status) => void
}) {
  const [map, setMap] = useState(sheet.map)
  const [urea, setUrea] = useState(sheet.urea)
  const [status, setStatus] = useState(sheet.status)
  const [review, setReview] = useState(false)
  const [notes, setNotes] = useState('')
  const { toast } = useToast()
  const total = useMemo(() => Number(map || 0) + Number(urea || 0), [map, urea])
  const change = async (next: Status) => {
    try {
      if (sheet.id !== 'new-field') await updateFieldStatus(sheet.id, next, notes)
    } catch {
      /* intentionally ignored */
    }
    setStatus(next)
    onStatus(next)
    setReview(false)
    toast({
      title:
        next === 'approved'
          ? 'Planilha aprovada'
          : next === 'returned'
            ? 'Planilha devolvida'
            : 'Planilha enviada',
      description: 'O fluxo colaborativo foi atualizado.',
    })
  }
  const exportExcel = async () => {
    try {
      const response = await fetch(exportUrl('field', sheet.id), { headers: authHeaders() })
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Planilha-Campo-${sheet.date}.xls`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({
        title: 'Acesso de administrador necessário',
        description: 'Entre com uma conta administradora para gerar o Excel oficial.',
      })
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar às planilhas
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Planilha de Campo</h2>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {sheet.project} · {sheet.date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({ title: 'Planilha salva', description: 'Medições armazenadas como rascunho.' })
            }
          >
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
          <Button onClick={() => change('submitted')} className="bg-blue-700 hover:bg-blue-800">
            <Send className="mr-2 h-4 w-4" />
            Enviar
          </Button>
        </div>
      </div>
      <section className="epa-card p-5">
        <SectionTitle icon={FileSpreadsheet} title="Identificação da operação" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Projeto" value={sheet.project} />
          <Field label="Data" value="2025-05-28" type="date" />
          <Field label="Área" value={sheet.area} />
          <Field label="Operador" value={sheet.operator} />
          <Field label="Clima" value="Sol" />
          <Field label="Pluviômetro (mm)" value="0" />
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="epa-card p-5">
          <SectionTitle
            icon={Droplets}
            title="Extração / Volume bombeado"
            subtitle="Leituras de hidrômetros por poço"
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-2">Poço</th>
                  <th className="p-2">Manhã</th>
                  <th className="p-2">Tarde</th>
                  <th className="p-2">Bomba</th>
                  <th className="p-2">Auto bomba</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['PB-127', '12540', '12612', '18', '72'],
                  ['PB-128', '9860', '9918', '20', '58'],
                ].map((row) => (
                  <tr key={row[0]} className="border-b">
                    {row.map((cell) => (
                      <td key={cell} className="p-1.5">
                        <Input defaultValue={cell} className="h-9 font-mono text-xs" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar poço
          </Button>
        </section>
        <section className="epa-card p-5">
          <SectionTitle
            icon={Gauge}
            title="Infiltração"
            subtitle="Leituras gerais e saídas do sistema"
          />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Geral — manhã" value="830" />
            <Field label="Geral — tarde" value="910" />
            <Field label="Saída 01 — manhã" value="210" />
            <Field label="Saída 01 — tarde" value="235" />
          </div>
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-800">Variação calculada</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-blue-900">+105 L</p>
            <p className="text-[10px] text-blue-600">entre as leituras registradas</p>
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="epa-card p-5">
          <SectionTitle icon={TestTubes} title="Dosagem de nutrientes" />
          <div className="mt-5 flex items-center justify-between rounded-lg bg-emerald-50 p-3">
            <div>
              <p className="text-xs font-medium">Aplicação realizada</p>
              <p className="text-[10px] text-slate-500">MAP e Ureia</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="epa-label">
              MAP (kg)
              <input
                type="number"
                className="epa-input font-mono"
                value={map}
                onChange={(e) => setMap(Number(e.target.value))}
              />
            </label>
            <label className="epa-label">
              Ureia (kg)
              <input
                type="number"
                className="epa-input font-mono"
                value={urea}
                onChange={(e) => setUrea(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-xs text-slate-500">Total calculado</span>
            <span className="font-mono text-lg font-semibold text-emerald-700">{total} kg</span>
          </div>
        </section>
        <section className="epa-card p-5">
          <SectionTitle icon={Settings2} title="Compressores" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Hidrômetro 01" value="2.481" />
            <Field label="Pressão 01" value="7,2 bar" />
            <Field label="Hidrômetro 02" value="1.938" />
            <Field label="Pressão 02" value="7,0 bar" />
          </div>
          <div className="mt-4 flex gap-3">
            <CheckPill text="Óleo 01 OK" />
            <CheckPill text="Óleo 02 OK" />
          </div>
        </section>
        <section className="epa-card p-5">
          <SectionTitle icon={Recycle} title="Remoção de óleo" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="SAO 01 (L)" value="2,5" />
            <Field label="Data" value="2025-05-28" type="date" />
            <Field label="SAO 02 (L)" value="1,2" />
            <Field label="Data" value="2025-05-28" type="date" />
          </div>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <section className="epa-card p-5">
          <SectionTitle icon={Recycle} title="Resíduos gerados" />
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Field label="Líquidos (L)" value={String(sheet.liquidWaste)} />
            <Field label="Sólidos (kg)" value="1,0" />
          </div>
          {sheet.liquidWaste > 4 && (
            <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Volume acima da média de 2,6 L deste projeto. Verifique medição e causa operacional.
            </div>
          )}
        </section>
        <section className="epa-card p-5">
          <SectionTitle icon={Leaf} title="Controle ambiental" />
          <div className="mt-5 space-y-3">
            <ToggleLine
              title="Verificação 5S da área"
              subtitle="Organização, limpeza e sinalização"
              checked={sheet.environment}
            />
            <ToggleLine
              title="Checklist ambiental mensal"
              subtitle="Conformidade documental e operacional"
              checked={sheet.environment}
            />
          </div>
        </section>
      </div>
      <section className="epa-card p-5">
        <SectionTitle icon={Eye} title="Observações e revisão" />
        <Textarea
          className="mt-5 min-h-[110px]"
          defaultValue="Operação dentro dos parâmetros previstos. Equipamentos inspecionados antes do início das atividades."
        />
        <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-slate-500">
            O administrador deve conferir medições, anomalias e controles ambientais antes de
            concluir o fluxo.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setReview(true)}
              className="border-amber-300 text-amber-800"
            >
              <AlertCircle className="mr-2 h-4 w-4" />
              Devolver
            </Button>
            <Button
              onClick={() => change('approved')}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Aprovar planilha
            </Button>
          </div>
        </div>
      </section>
      {review && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Devolver planilha</h3>
              <Button variant="ghost" size="icon" onClick={() => setReview(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Informe as medições ou controles que precisam ser corrigidos.
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-4 min-h-[120px]"
            />
            <Button
              onClick={() => change('returned')}
              disabled={!notes.trim()}
              className="mt-4 w-full bg-amber-600 hover:bg-amber-700"
            >
              Confirmar devolução
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof FileSpreadsheet
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}
function Field({ label, value, type = 'text' }: { label: string; value: string; type?: string }) {
  return (
    <label className="epa-label">
      {label}
      <input type={type} className="epa-input" defaultValue={value} />
    </label>
  )
}
function CheckPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700">
      <CheckCircle2 className="h-3 w-3" />
      {text}
    </span>
  )
}
function ToggleLine({
  title,
  subtitle,
  checked,
}: {
  title: string
  subtitle: string
  checked: boolean
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3">
      <div>
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
      </div>
      <Switch defaultChecked={checked} />
    </div>
  )
}
