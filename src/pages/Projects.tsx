import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Users2,
} from 'lucide-react'
import { useState } from 'react'
import { projects, rdos, fieldSheets, type EpaProject } from '@/data/epa'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function Projects({
  query,
  onOpenRdo,
  onOpenField,
}: {
  query: string
  onOpenRdo: () => void
  onOpenField: () => void
}) {
  const [selected, setSelected] = useState<EpaProject | null>(null)
  const filtered = projects.filter((p) =>
    `${p.name} ${p.client} ${p.code}`.toLowerCase().includes(query.toLowerCase()),
  )
  if (selected)
    return (
      <ProjectDetail
        project={selected}
        onBack={() => setSelected(null)}
        onOpenRdo={onOpenRdo}
        onOpenField={onOpenField}
      />
    )
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Filtrar projetos..." className="bg-white pl-9" />
        </div>
        <Button className="w-fit bg-emerald-700 hover:bg-emerald-800">
          <Plus className="mr-2 h-4 w-4" />
          Novo projeto
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          <b className="text-slate-800">{filtered.length}</b> projetos visíveis para seu perfil
        </p>
        <div className="flex rounded-lg border bg-white p-1 text-xs">
          <button className="rounded-md bg-slate-100 px-3 py-1.5 font-medium">Todos</button>
          <button className="px-3 py-1.5 text-slate-500">Ativos</button>
          <button className="px-3 py-1.5 text-slate-500">Pausados</button>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((project) => (
          <button
            onClick={() => setSelected(project)}
            key={project.id}
            className="epa-card group overflow-hidden text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="h-1.5 bg-gradient-to-r from-emerald-700 to-teal-400" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                    project.status === 'active'
                      ? 'active-glow bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700',
                  )}
                >
                  {project.status === 'active' ? '● Ativo' : 'Ⅱ Pausado'}
                </span>
              </div>
              <p className="mt-4 font-mono text-[10px] font-medium text-emerald-700">
                {project.code}
              </p>
              <h3 className="mt-1 min-h-12 text-base font-semibold leading-6 group-hover:text-emerald-700">
                {project.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{project.client}</p>
              <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {project.location}
              </div>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-slate-500">Progresso geral</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.team.slice(0, 3).map((member) => (
                    <span
                      key={member}
                      title={member}
                      className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-600"
                    >
                      {member
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)}
                    </span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  Abrir projeto{' '}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProjectDetail({
  project,
  onBack,
  onOpenRdo,
  onOpenField,
}: {
  project: EpaProject
  onBack: () => void
  onOpenRdo: () => void
  onOpenField: () => void
}) {
  const { user } = useAuth()
  const role = user?.role
  const isOperator = role === 'operator'
  const isTechnician = role === 'technician'
  const isAdmin = role === 'admin'

  const projectRdos = rdos.filter((r) => r.projectId === project.id)
  const sheets = fieldSheets.filter((s) => s.projectId === project.id)

  const historyItems = [
    ...(isAdmin || isOperator
      ? projectRdos.map((r) => ({
          id: r.id,
          title: `RDO #${String(r.number).padStart(3, '0')} · ${r.activity}`,
          date: r.date,
          status: r.status,
          type: 'RDO',
        }))
      : []),
    ...(isAdmin || isTechnician
      ? sheets.map((s) => ({
          id: s.id,
          title: `Planilha de Campo · ${s.area}`,
          date: s.date,
          status: s.status,
          type: 'Campo',
        }))
      : []),
  ]

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos projetos
      </button>
      <section className="epa-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#044741] to-[#086B63] p-6 text-white md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10px]">
                  {project.code}
                </span>
                <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] text-emerald-100">
                  ● Projeto ativo
                </span>
              </div>
              <h2 className="max-w-2xl text-2xl font-semibold md:text-3xl">{project.name}</h2>
              <p className="mt-2 text-sm text-emerald-100">{project.client}</p>
              <div className="mt-5 flex flex-wrap gap-5 text-xs text-emerald-50">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {project.location}
                </span>
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Contrato {project.contract}
                </span>
                <span className="flex items-center gap-2">
                  <Users2 className="h-4 w-4" />
                  {project.team.length} pessoas atribuídas
                </span>
              </div>
            </div>
            <div className="flex min-w-[148px] flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur">
              <span className="text-3xl font-semibold">{project.progress}%</span>
              <span className="text-xs text-emerald-100">concluído</span>
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-3">
        {(isAdmin || isOperator) && (
          <MiniStat
            label="RDOs emitidos"
            value="18"
            helper="3 aguardando aprovação"
            icon={ClipboardList}
          />
        )}
        <MiniStat
          label="Poços monitorados"
          value="12"
          helper="10 ativos · 2 tamponados"
          icon={MapPin}
        />
        {(isAdmin || isTechnician) && (
          <MiniStat
            label="Planilhas de campo"
            value="24"
            helper="Última: 28 mai 2025"
            icon={FileSpreadsheet}
          />
        )}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="font-semibold">Histórico operacional</h3>
              <p className="text-xs text-slate-500">RDOs e planilhas vinculados ao projeto</p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
          <div className="divide-y">
            {historyItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum histórico operacional acessível para o seu perfil.
              </div>
            ) : (
              historyItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.type === 'RDO' ? onOpenRdo : onOpenField}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {item.type === 'RDO' ? (
                      <ClipboardList className="h-4 w-4" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-[10px] text-slate-400">
                      {item.date} · {item.type}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </button>
              ))
            )}
          </div>
        </section>
        <section className="epa-card p-5">
          <h3 className="font-semibold">Equipe atribuída</h3>
          <p className="mt-1 text-xs text-slate-500">Acesso restrito a este projeto</p>
          <div className="mt-5 space-y-4">
            {project.team.map((member, index) => (
              <div key={member} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-[10px] font-bold">
                  {member
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{member}</p>
                  <p className="text-[10px] text-slate-400">
                    {index === 0 ? 'Administrador' : index === 1 ? 'Operador' : 'Técnico'}
                  </p>
                </div>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string
  helper: string
  icon: typeof ClipboardList
}) {
  return (
    <div className="epa-card flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-semibold">{value}</p>
        <p className="text-xs font-medium">{label}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">{helper}</p>
      </div>
    </div>
  )
}
