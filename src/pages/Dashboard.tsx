import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Droplets,
  FolderKanban,
  MapPin,
  MoreHorizontal,
} from 'lucide-react'
import { auditEvents, projects } from '@/data/epa'
import { Button } from '@/components/ui/button'

const stats = [
  {
    label: 'Projetos ativos',
    value: '3',
    helper: 'de 4 projetos',
    trend: '+1 este mês',
    icon: FolderKanban,
    color: 'emerald',
    up: true,
  },
  {
    label: 'RDOs pendentes',
    value: '7',
    helper: 'aguardando revisão',
    trend: '2 urgentes',
    icon: ClipboardList,
    color: 'blue',
    up: false,
  },
  {
    label: 'Extrações no mês',
    value: '12,8k',
    helper: 'litros bombeados',
    trend: '+8,4%',
    icon: Droplets,
    color: 'cyan',
    up: true,
  },
  {
    label: 'Alertas de segurança',
    value: '2',
    helper: 'requerem atenção',
    trend: '−3 vs. abr',
    icon: AlertTriangle,
    color: 'amber',
    up: false,
  },
]
const barWidth = [31, 44, 38, 52, 46, 62, 58, 73, 66, 78, 71, 86]

export function Dashboard({ navigate }: { navigate: (page: 'projects' | 'rdos') => void }) {
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Quarta-feira, 28 de maio de 2025</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Bom dia, Annik <span className="align-top text-base">👋</span>
          </h2>
        </div>
        <Button
          onClick={() => navigate('rdos')}
          className="w-fit bg-emerald-700 shadow-sm hover:bg-emerald-800"
        >
          Novo relatório <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const Trend = stat.up ? ArrowUpRight : ArrowDownRight
          return (
            <article
              key={stat.label}
              className="epa-card group p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div
                  className={`grid h-10 w-10 place-items-center rounded-xl bg-${stat.color}-50 text-${stat.color}-700`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <Trend className={`h-4 w-4 ${stat.up ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{stat.label}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
                <span className="text-slate-400">{stat.helper}</span>
                <span className={stat.up ? 'font-medium text-emerald-600' : 'text-slate-500'}>
                  {stat.trend}
                </span>
              </div>
            </article>
          )
        })}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <article className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="font-semibold">Progresso dos projetos</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Percentual concluído nas obras atribuídas
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
          <div className="space-y-5 p-5">
            {projects.map((project) => (
              <button
                onClick={() => navigate('projects')}
                key={project.id}
                className="group block w-full text-left"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-emerald-700">
                      {project.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">{project.code}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-emerald-700">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-teal-400 transition-all group-hover:brightness-110"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate('projects')}
            className="flex w-full items-center justify-center gap-2 border-t py-3.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50/60"
          >
            Ver todos os projetos <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </article>
        <article className="epa-card overflow-hidden">
          <div className="border-b bg-gradient-to-br from-emerald-800 to-teal-700 p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
                  <CloudSun className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-emerald-100">Condições no local</p>
                  <p className="font-semibold">Açailândia — MA</p>
                </div>
              </div>
              <span className="rounded-full bg-white/15 px-2 py-1 text-[10px]">
                Atualizado agora
              </span>
            </div>
            <div className="mt-8 flex items-end justify-between">
              <div>
                <span className="text-5xl font-light tracking-tight">29°</span>
                <p className="mt-1 text-sm text-emerald-100">Parcialmente nublado</p>
              </div>
              <div className="space-y-1.5 text-right text-xs text-emerald-100">
                <p>
                  Umidade <b className="text-white">68%</b>
                </p>
                <p>
                  Vento <b className="text-white">12 km/h</b>
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x p-4 text-center">
            {['Agora|29°|☁️', '12h|31°|🌤️', '15h|30°|🌥️', '18h|26°|🌧️'].map((item) => {
              const [time, temp, emoji] = item.split('|')
              return (
                <div key={time}>
                  <p className="text-[10px] text-slate-400">{time}</p>
                  <p className="my-1 text-base">{emoji}</p>
                  <p className="font-mono text-xs font-semibold">{temp}</p>
                </div>
              )
            })}
          </div>
          <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <span>Possibilidade de chuva após 17h</span>
          </div>
        </article>
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <article className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="font-semibold">Atividade de extração</h3>
              <p className="mt-0.5 text-xs text-slate-500">Volume diário · últimos 12 dias</p>
            </div>
            <div className="rounded-lg border px-2.5 py-1.5 text-xs text-slate-600">Maio 2025</div>
          </div>
          <div className="p-5">
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">1.284 L</span>
              <span className="text-xs font-medium text-emerald-600">↑ 8,4% na semana</span>
            </div>
            <div className="flex h-36 items-end gap-2 border-b border-l px-3 pt-3">
              {barWidth.map((height, index) => (
                <div
                  key={index}
                  className="group relative flex-1 rounded-t bg-emerald-200 hover:bg-emerald-500"
                  style={{ height: `${height}%` }}
                >
                  <span className="absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-slate-800 px-1.5 py-1 font-mono text-[9px] text-white group-hover:block">
                    {height * 2}L
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-400">
              <span>17/05</span>
              <span>20/05</span>
              <span>23/05</span>
              <span>28/05</span>
            </div>
          </div>
        </article>
        <article className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h3 className="font-semibold">Atividades recentes</h3>
              <p className="mt-0.5 text-xs text-slate-500">Atualizações dos seus projetos</p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 active-glow" />
          </div>
          <div className="divide-y">
            {auditEvents.slice(0, 4).map((item) => (
              <div key={item.id} className="flex gap-3 px-5 py-3.5 hover:bg-slate-50">
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-${item.color}-100 text-[10px] font-bold text-${item.color}-700`}
                >
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-slate-700">
                    <b>{item.user}</b> {item.action}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {item.entity} · {item.time}
                  </p>
                </div>
                {item.action.includes('aprovou') && (
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
                )}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
