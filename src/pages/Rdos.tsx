import { useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudSun,
  Download,
  Eye,
  FileText,
  Filter,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  TableProperties,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { rdos, type EpaRdo, type Status } from '@/data/epa'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { authHeaders, exportUrl, updateRdoStatus } from '@/services/workspace'
import { cn } from '@/lib/utils'

export function RdosPage({ query }: { query: string }) {
  const [editing, setEditing] = useState<EpaRdo | null>(null)
  const [items, setItems] = useState(rdos)
  const [filter, setFilter] = useState<'all' | Status>('all')
  const [isNew, setIsNew] = useState(false)
  const filtered = items.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      `${r.number} ${r.project} ${r.activity}`.toLowerCase().includes(query.toLowerCase()),
  )
  const openNew = () => {
    setIsNew(true)
    setEditing({
      id: 'new',
      number: 129,
      projectId: 'epa-rsl-a01',
      project: 'Recuperação Ambiental Lote A',
      date: '28 mai 2025',
      activity: '',
      description: '',
      weather: 'Sol',
      status: 'draft',
      operator: 'Carlos Oliveira',
      technician: 'Marina Santos',
      wells: 1,
      photos: 0,
      updated: 'agora',
    })
  }
  if (editing)
    return (
      <RdoEditor
        report={editing}
        isNew={isNew}
        onBack={() => {
          setEditing(null)
          setIsNew(false)
        }}
        onChangeStatus={(status) =>
          setItems((prev) => prev.map((r) => (r.id === editing.id ? { ...r, status } : r)))
        }
      />
    )
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Rascunhos', '4', 'draft'],
          ['Aguardando aprovação', '7', 'submitted'],
          ['Aprovados no mês', '18', 'approved'],
          ['Devolvidos', '2', 'returned'],
        ].map(([label, value, status]) => (
          <button
            onClick={() => setFilter(status as Status)}
            key={label}
            className={cn(
              'epa-card flex items-center justify-between p-4 text-left transition hover:shadow-md',
              filter === status && 'border-emerald-500 ring-2 ring-emerald-500/10',
            )}
          >
            <div>
              <p className="text-2xl font-semibold">{value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{label}</p>
            </div>
            <StatusBadge status={status as Status} compact />
          </button>
        ))}
      </div>
      <section className="epa-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar número, projeto ou atividade..." />
          </div>
          <Button variant="outline" onClick={() => setFilter('all')} className="w-fit">
            <Filter className="mr-2 h-4 w-4" />
            Todos os status
          </Button>
          <Button onClick={openNew} className="w-fit bg-emerald-700 hover:bg-emerald-800">
            <Plus className="mr-2 h-4 w-4" />
            Novo RDO
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-500">
              <tr>
                <th className="px-5 py-3">RDO / Data</th>
                <th className="px-5 py-3">Projeto</th>
                <th className="px-5 py-3">Atividade</th>
                <th className="px-5 py-3">Responsáveis</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((report) => (
                <tr key={report.id} className="group hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-mono text-sm font-semibold text-emerald-700">
                      RDO #{String(report.number).padStart(3, '0')}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <CalendarDays className="h-3 w-3" />
                      {report.date} · {report.weather}
                    </p>
                  </td>
                  <td className="max-w-[220px] px-5 py-4">
                    <p className="truncate text-sm font-medium">{report.project}</p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="h-3 w-3" />
                      {report.projectId === 'u6c77idn7hfi13c'
                        ? 'Açailândia — MA'
                        : 'Área operacional'}
                    </p>
                  </td>
                  <td className="max-w-[260px] px-5 py-4">
                    <p className="truncate text-sm text-slate-700">{report.activity}</p>
                    <p className="mt-1 flex gap-3 text-[10px] text-slate-400">
                      <span>{report.wells} poços</span>
                      <span>{report.photos} fotos</span>
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-xs font-medium">{report.operator}</p>
                    <p className="text-[10px] text-slate-400">{report.technician}</p>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={report.status} />
                    {report.reviewNotes && (
                      <p className="mt-1 max-w-36 truncate text-[10px] text-amber-700">
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
                      className="text-xs"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-slate-500">
          <span>
            Exibindo {filtered.length} de {items.length} relatórios
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Anterior
            </Button>
            <Button variant="outline" size="sm">
              Próximo
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function RdoEditor({
  report,
  isNew,
  onBack,
  onChangeStatus,
}: {
  report: EpaRdo
  isNew: boolean
  onBack: () => void
  onChangeStatus: (status: Status) => void
}) {
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState(report.status)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewNotes, setReviewNotes] = useState(report.reviewNotes || '')
  const { toast } = useToast()
  const steps = [
    { label: 'Dados iniciais', icon: FileText },
    { label: 'Poços e fotos', icon: Wrench },
    { label: 'Revisão', icon: CheckCircle2 },
  ]
  const changeStatus = async (next: Status) => {
    try {
      if (!isNew) await updateRdoStatus(report.id, next, reviewNotes)
      setStatus(next)
      onChangeStatus(next)
      setReviewOpen(false)
      toast({
        title:
          next === 'approved'
            ? 'RDO aprovado'
            : next === 'returned'
              ? 'RDO devolvido'
              : 'RDO enviado',
        description: `RDO #${String(report.number).padStart(3, '0')} atualizado com sucesso.`,
      })
    } catch {
      setStatus(next)
      onChangeStatus(next)
      setReviewOpen(false)
      toast({
        title: 'Modo de demonstração',
        description: 'A interface foi atualizada. Entre no backend para persistir a alteração.',
      })
    }
  }
  const exportPdf = async () => {
    try {
      const res = await fetch(exportUrl('rdo', report.id), { headers: authHeaders() })
      if (!res.ok) throw new Error()
      const html = await res.text()
      const popup = window.open('', '_blank')
      popup?.document.write(html)
      popup?.document.close()
      setTimeout(() => popup?.print(), 350)
    } catch {
      toast({
        title: 'Acesso de administrador necessário',
        description: 'Entre com uma conta administradora para gerar o documento oficial.',
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
            Voltar aos relatórios
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">RDO #{String(report.number).padStart(3, '0')}</h2>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {report.project} · {report.date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={isNew}>
            <Download className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: 'Rascunho salvo',
                description: 'Todas as alterações foram registradas.',
              })
            }
          >
            Salvar rascunho
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              Continuar <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => changeStatus('submitted')}
              className="bg-blue-700 hover:bg-blue-800"
            >
              <Send className="mr-2 h-4 w-4" />
              Enviar para aprovação
            </Button>
          )}
        </div>
      </div>
      <div className="epa-card p-3 sm:p-4">
        <div className="flex items-center">
          {steps.map((item, index) => {
            const Icon = item.icon
            const active = step === index + 1
            const done = step > index + 1
            return (
              <div key={item.label} className="flex flex-1 items-center last:flex-none">
                <button onClick={() => setStep(index + 1)} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-full text-xs font-semibold',
                      active
                        ? 'bg-emerald-700 text-white'
                        : done
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'hidden text-xs font-medium sm:block',
                      active ? 'text-emerald-800' : 'text-slate-400',
                    )}
                  >
                    {item.label}
                  </span>
                </button>
                {index < 2 && (
                  <div className="mx-3 h-1 flex-1 rounded-full bg-slate-100">
                    <div
                      className={cn(
                        'h-full rounded-full bg-emerald-500 transition-all',
                        done ? 'w-full' : 'w-0',
                      )}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      {step === 1 && (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <section className="epa-card p-5">
            <SectionTitle
              icon={FileText}
              title="Cabeçalho do relatório"
              subtitle="Dados contratuais e identificação da atividade"
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Cliente" value="Petrobras — Refinaria Sul" />
              <Field label="Contrato" value="CT-EPA-2025-017" />
              <Field label="Local" value="Refinaria Sul — Área Industrial" />
              <Field label="Projeto EPA" value="EPA-RSL-A01" />
              <Field label="Empresa" value="EPA Gestão Ambiental" />
              <Field label="Data" value="28/05/2025" type="date" />
              <Field label="Realizado por" value={report.operator} />
              <Field label="Supervisionado por" value={report.technician} />
            </div>
          </section>
          <section className="space-y-5">
            <div className="epa-card p-5">
              <SectionTitle icon={CloudSun} title="Condições do dia" />
              <label className="mt-5 block epa-label">
                Clima
                <select className="epa-input" defaultValue={report.weather}>
                  <option>Sol</option>
                  <option>Nublado</option>
                  <option>Chuva</option>
                  <option>Instável</option>
                </select>
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label="Início" value="07:00" />
                <Field label="Término" value="17:00" />
              </div>
            </div>
            <div className="epa-card p-5">
              <SectionTitle icon={User} title="Responsabilidades" />
              <div className="mt-4 space-y-3 text-xs">
                <RoleLine role="Operador" name={report.operator} done />
                <RoleLine role="Técnico" name={report.technician} done={step > 1} />
                <RoleLine role="Administrador" name="Annik Almeida" done={status === 'approved'} />
              </div>
            </div>
          </section>
          <section className="epa-card p-5 xl:col-span-2">
            <SectionTitle icon={ClipboardListIcon} title="Atividade executada" />
            <div className="mt-5">
              <label className="epa-label">
                Atividade
                <input
                  className="epa-input"
                  defaultValue={report.activity}
                  placeholder="Ex.: Tamponamento de poços de monitoramento"
                />
              </label>
              <label className="mt-4 block epa-label">
                Descrição da atividade
                <Textarea
                  className="epa-textarea min-h-[140px]"
                  defaultValue={report.description}
                  placeholder="Descreva o serviço executado, recursos utilizados e resultados..."
                />
              </label>
            </div>
          </section>
        </div>
      )}
      {step === 2 && (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="epa-card p-5">
            <SectionTitle
              icon={TableProperties}
              title="Tabela de poços"
              subtitle="Profundidade, data e diâmetro"
            />
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-3">ID do poço</th>
                    <th className="p-3">Profundidade</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Diâmetro</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {['PZ-01', 'PZ-02'].map((well, index) => (
                    <tr key={well}>
                      <td className="p-2">
                        <input className="epa-input mt-0" defaultValue={well} />
                      </td>
                      <td className="p-2">
                        <input
                          className="epa-input mt-0"
                          defaultValue={index === 0 ? '8.5' : '10.2'}
                        />
                      </td>
                      <td className="p-2">
                        <input className="epa-input mt-0" defaultValue="28/05/2025" />
                      </td>
                      <td className="p-2">
                        <input className="epa-input mt-0" defaultValue="4 pol." />
                      </td>
                      <td>
                        <Button variant="ghost" size="icon">
                          <X className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="mt-4 text-xs">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar poço
            </Button>
          </section>
          <section className="epa-card p-5">
            <SectionTitle
              icon={Camera}
              title="Registro fotográfico"
              subtitle="Imagens com legenda e ordem de apresentação"
            />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <PhotoCard
                src="https://img.usecurling.com/p/640/420?q=monitoring%20well"
                caption="Leitura inicial do hidrômetro PZ-01"
              />
              <PhotoCard
                src="https://img.usecurling.com/p/640/420?q=water%20pump"
                caption="Condição da bomba pneumática"
              />
              <button className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-emerald-400 hover:bg-emerald-50">
                <Camera className="mb-2 h-6 w-6 text-slate-400" />
                Adicionar fotografia
              </button>
            </div>
          </section>
          <section className="epa-card p-5 xl:col-span-2">
            <SectionTitle icon={AlertCircle} title="Observações técnicas" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TextField label="Acidentes" value="Não houve" />
              <TextField label="Interferências" value="Não houve" />
              <TextField label="Mudanças no plano" value="Não houve" />
              <TextField
                label="Tempo de espera / deslocamento"
                value="Deslocamento: 01h20 · Espera: sem ocorrências"
              />
            </div>
          </section>
        </div>
      )}
      {step === 3 && (
        <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <section className="epa-card overflow-hidden">
            <div className="border-b bg-slate-50 p-5">
              <SectionTitle
                icon={Eye}
                title="Pré-visualização do relatório"
                subtitle="Revise os dados antes de aprovar ou devolver"
              />
            </div>
            <div className="p-5">
              <div className="mb-5 flex items-center justify-between border-b-2 border-emerald-700 pb-4">
                <img
                  src="https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/9fd27c13-4b57-4495-a17d-d514629fc46c/logo-epa-f4060.png"
                  className="h-12"
                  alt="Grupo EPA"
                />
                <div className="text-right">
                  <p className="font-mono text-xs font-semibold">
                    RDO #{String(report.number).padStart(3, '0')}
                  </p>
                  <p className="text-[10px] text-slate-500">{report.date}</p>
                </div>
              </div>
              <h3 className="bg-emerald-800 py-2 text-center text-sm font-semibold text-white">
                RELATÓRIO DIÁRIO DE ACOMPANHAMENTO DE OBRAS
              </h3>
              <div className="grid grid-cols-2 border-x text-xs">
                {[
                  ['Cliente', 'Petrobras — Refinaria Sul'],
                  ['Contrato', 'CT-EPA-2025-017'],
                  ['Local', 'Refinaria Sul — Área Industrial'],
                  ['Clima', report.weather],
                ].map(([label, value]) => (
                  <div className="border-b p-3" key={label}>
                    <b className="mb-1 block text-[9px] uppercase text-emerald-700">{label}</b>
                    {value}
                  </div>
                ))}
              </div>
              <PreviewSection title="Atividade">
                {report.activity || 'Atividade operacional em campo'}
              </PreviewSection>
              <PreviewSection title="Descrição da atividade">
                {report.description || 'Descrição técnica detalhada da operação executada.'}
              </PreviewSection>
              <PreviewSection title="Tabela de poços">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <b>PZ-01</b>
                  <span>8,5 m</span>
                  <span>28/05/2025</span>
                  <span>4 pol.</span>
                </div>
              </PreviewSection>
              <PreviewSection title="Observações técnicas">
                Sem acidentes, interferências ou alterações de plano registradas.
              </PreviewSection>
            </div>
          </section>
          <aside className="space-y-4">
            <div className="epa-card p-5">
              <h3 className="font-semibold">Checklist de revisão</h3>
              <div className="mt-4 space-y-3 text-xs">
                {[
                  'Cabeçalho preenchido',
                  'Atividade e descrição',
                  'Poços e dimensões',
                  'Registro fotográfico',
                  'Observações técnicas',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="epa-card p-5">
              <h3 className="font-semibold">Ação do administrador</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                A aprovação bloqueia o relatório. A devolução libera ajustes com uma justificativa.
              </p>
              <div className="mt-5 space-y-2">
                <Button
                  onClick={() => changeStatus('approved')}
                  className="w-full bg-emerald-700 hover:bg-emerald-800"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Aprovar RDO
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReviewOpen(true)}
                  className="w-full border-amber-300 text-amber-800 hover:bg-amber-50"
                >
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Devolver para correção
                </Button>
              </div>
            </div>
          </aside>
        </div>
      )}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">Devolver RDO</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Descreva os ajustes necessários para o técnico.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReviewOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              className="mt-5 min-h-[120px]"
              placeholder="Ex.: Conferir profundidade do poço e incluir foto..."
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => changeStatus('returned')}
                disabled={!reviewNotes.trim()}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Confirmar devolução
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ClipboardListIcon = FileText
function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof FileText
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
      <input
        className="epa-input"
        type={type}
        defaultValue={type === 'date' ? '2025-05-28' : value}
      />
    </label>
  )
}
function TextField({ label, value }: { label: string; value: string }) {
  return (
    <label className="epa-label">
      {label}
      <Textarea className="epa-textarea min-h-[80px]" defaultValue={value} />
    </label>
  )
}
function RoleLine({ role, name, done }: { role: string; name: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'grid h-7 w-7 place-items-center rounded-full',
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </span>
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-[10px] text-slate-400">{role}</p>
      </div>
    </div>
  )
}
function PhotoCard({ src, caption }: { src: string; caption: string }) {
  return (
    <figure className="overflow-hidden rounded-xl border bg-white">
      <img src={src} className="h-28 w-full object-cover" alt={caption} />
      <figcaption className="p-2 text-[10px] text-slate-600">{caption}</figcaption>
    </figure>
  )
}
function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold uppercase text-emerald-800">
        {title}
      </h4>
      <div className="min-h-12 border border-t-0 p-3 text-xs leading-5 text-slate-700">
        {children}
      </div>
    </section>
  )
}
