import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  CloudSun,
  Droplets,
  FileSpreadsheet,
  FolderKanban,
  MapPin,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { useSync } from '@/context/SyncContext'
import { offlineStorage } from '@/services/offlineStorage'
import { Page } from '@/components/Layout'
import { projects as staticProjects, auditEvents } from '@/data/epa'
import pb from '@/lib/pocketbase/client'

export function Dashboard({ navigate }: { navigate: (page: Page) => void }) {
  const { user } = useAuth()
  const { isOnline, isSyncing, syncNow, pendingCount } = useSync()
  const [rdoCount, setRdoCount] = useState<number>(0)
  const [pendingRdos, setPendingRdos] = useState<number>(0)
  const [sheetCount, setSheetCount] = useState<number>(0)
  const [projectsList, setProjectsList] = useState(staticProjects)

  // Automatic greeting based on real local time
  // 05:00–11:59 "Bom dia, [Nome]!"
  // 12:00–17:59 "Boa tarde, [Nome]!"
  // 18:00–04:59 "Boa noite, [Nome]!"
  const getGreeting = () => {
    const hours = new Date().getHours()
    const name = user?.name ? user.name.split(' ')[0] : 'Usuário'
    if (hours >= 5 && hours < 12) {
      return `Bom dia, ${name}!`
    } else if (hours >= 12 && hours < 18) {
      return `Boa tarde, ${name}!`
    } else {
      return `Boa noite, ${name}!`
    }
  }

  const getFormattedDate = () => {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  useEffect(() => {
    const loadStats = async () => {
      try {
        const rdos = await offlineStorage.getAllRdos()
        setRdoCount(rdos.length)
        setPendingRdos(rdos.filter((r) => r.status === 'submitted').length)

        const sheets = await offlineStorage.getAllFieldSheets()
        setSheetCount(sheets.length)

        if (navigator.onLine && pb.authStore.isValid) {
          const projs = await pb.collection('projects').getFullList({ sort: '-created' })
          if (projs.length > 0) {
            setProjectsList(
              projs.map((p) => ({
                id: p.id,
                name: p.name,
                client: 'Petrobras — Refinaria Sul',
                code: p.epa_code || 'EPA-001',
                location: p.location || 'Área Industrial',
                status: (p.status as any) || 'active',
                progress: p.progress || 50,
                contract: 'CT-2025',
                team: ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
              })),
            )
          }
        }
      } catch (err) {
        console.warn('Dashboard stats error:', err)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome header with dynamic greeting */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between epa-card p-6 bg-gradient-to-r from-emerald-950 via-[#064e3b] to-teal-900 text-white dark:border-slate-800">
        <div>
          <p className="text-xs text-emerald-200 capitalize">{getFormattedDate()}</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
            {getGreeting()} <span className="align-top text-lg">👋</span>
          </h2>
          <p className="mt-1 text-xs text-emerald-100/80">
            Acompanhe em tempo real as operações ambientais, RDOs e planilhas de campo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            onClick={() => navigate('rdos')}
            className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-md min-h-[44px] font-semibold text-xs"
          >
            <ClipboardList className="mr-2 h-4 w-4" />
            Novo RDO
          </Button>
          <Button
            onClick={() => navigate('fields')}
            variant="outline"
            className="bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[44px] font-semibold text-xs"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Planilha de Campo
          </Button>
        </div>
      </section>

      {/* Main KPI Counters */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Projetos ativos',
            value: String(projectsList.length),
            helper: 'em operação ambiental',
            trend: '+1 este mês',
            icon: FolderKanban,
            color: 'emerald',
            up: true,
            page: 'projects' as Page,
          },
          {
            label: 'RDOs aguardando aprovação',
            value: String(pendingRdos),
            helper: `${rdoCount} relatórios no total`,
            trend: pendingRdos > 0 ? `${pendingRdos} pendentes` : 'Tudo em dia',
            icon: ClipboardList,
            color: 'blue',
            up: pendingRdos === 0,
            page: 'rdos' as Page,
          },
          {
            label: 'Planilhas de campo',
            value: String(sheetCount),
            helper: 'medições operacionais',
            trend: '+12 na semana',
            icon: Droplets,
            color: 'cyan',
            up: true,
            page: 'fields' as Page,
          },
          {
            label: 'Usuários cadastrados',
            value: user?.role === 'admin' ? '4' : 'Ativo',
            helper: user?.role === 'admin' ? 'gestão de acessos' : 'seu perfil ativo',
            trend: user?.role === 'admin' ? '3 no campo' : 'Operação OK',
            icon: Users,
            color: 'amber',
            up: true,
            page: (user?.role === 'admin' ? 'users' : 'dashboard') as Page,
          },
        ].map((stat) => {
          const Icon = stat.icon
          const Trend = stat.up ? ArrowUpRight : ArrowDownRight
          return (
            <article
              key={stat.label}
              onClick={() => navigate(stat.page)}
              className="epa-card group p-5 transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer dark:hover:border-emerald-500/40"
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon className="h-5 w-5" />
                </div>
                <Trend
                  className={`h-4 w-4 ${stat.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}
                />
              </div>
              <p className="mt-4 text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                {stat.label}
              </p>
              <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs dark:border-slate-800">
                <span className="text-slate-400">{stat.helper}</span>
                <span
                  className={
                    stat.up
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600'
                  }
                >
                  {stat.trend}
                </span>
              </div>
            </article>
          )
        })}
      </section>

      {/* Projects Progress & Field Conditions */}
      <section className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <article className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-sm">Progresso dos Projetos</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Percentual concluído nas obras atribuídas à equipe
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('projects')}
              className="text-xs"
            >
              Ver todos <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-5 p-5">
            {projectsList.map((project) => (
              <button
                onClick={() => navigate('projects')}
                key={project.id}
                className="group block w-full text-left"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                      {project.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      {project.code} · {project.location}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {project.progress}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-teal-400 transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="epa-card overflow-hidden">
          <div className="border-b bg-gradient-to-br from-emerald-900 to-teal-800 p-5 text-white">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15">
                  <CloudSun className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs text-emerald-200">Condições Operacionais em Campo</p>
                  <p className="font-semibold text-sm">Açailândia — MA / Refinaria Sul</p>
                </div>
              </div>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium">
                Tempo Real
              </span>
            </div>
            <div className="mt-6 flex items-end justify-between">
              <div>
                <span className="text-4xl font-light tracking-tight">29°C</span>
                <p className="mt-1 text-xs text-emerald-100">Sol com poucas nuvens</p>
              </div>
              <div className="space-y-1 text-right text-xs text-emerald-100">
                <p>
                  Umidade: <b className="text-white">65%</b>
                </p>
                <p>
                  Vento: <b className="text-white">10 km/h</b>
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 divide-x p-4 text-center dark:divide-slate-800">
            {['Manhã|27°|☀️', '12h|31°|🌤️', '15h|30°|🌥️', '18h|26°|🌧️'].map((item) => {
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
        </article>
      </section>

      {/* Recent Activities & Quick Shortcuts */}
      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <article className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-sm">Atividades Recentes do Sistema</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Histórico de ações e auditoria ambiental
              </p>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 active-glow" />
          </div>
          <div className="divide-y dark:divide-slate-800">
            {auditEvents.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/40"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {item.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-slate-700 dark:text-slate-300">
                    <b>{item.user}</b> {item.action}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {item.entity} · {item.time}
                  </p>
                </div>
                <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </article>

        <article className="epa-card p-5 space-y-4">
          <h3 className="font-semibold text-sm">Atalhos Operacionais</h3>
          <div className="grid gap-3">
            <button
              onClick={() => navigate('rdos')}
              className="flex items-center justify-between rounded-xl border p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-semibold">Emitir RDO</p>
                  <p className="text-[10px] text-slate-500">
                    Relatório Diário de Obra em tela única
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              onClick={() => navigate('fields')}
              className="flex items-center justify-between rounded-xl border p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                <div>
                  <p className="text-xs font-semibold">Preencher Planilha de Campo</p>
                  <p className="text-[10px] text-slate-500">
                    Extração, nutrientes, compressores e 5S
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('users')}
                className="flex items-center justify-between rounded-xl border p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold">Gerenciar Usuários & Acessos</p>
                    <p className="text-[10px] text-slate-500">
                      Controle de papéis (Admin, Técnico, Operador)
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
