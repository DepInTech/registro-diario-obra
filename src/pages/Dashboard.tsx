import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
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
import { useSync, SYNC_BROADCAST_EVENT } from '@/context/SyncContext'
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
  const [userCount, setUserCount] = useState<number>(4)
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

  const loadStats = async () => {
    try {
      // 1. If online and PocketBase available, fetch latest RDOs and FieldSheets to ensure fresh server data
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const [serverRdos, serverSheets] = await Promise.all([
            pb.collection('reports_rdo').getFullList({ sort: '-created' }),
            pb.collection('field_spreadsheets').getFullList({ sort: '-created' }),
          ])

          if (serverRdos.length > 0) {
            const activeServerRdos = serverRdos.filter((r) => !r.deleted)
            setRdoCount(activeServerRdos.length)
            setPendingRdos(activeServerRdos.filter((r) => r.status === 'submitted').length)
          } else {
            const rdos = await offlineStorage.getAllRdos()
            const activeRdos = rdos.filter((r) => !r.deleted)
            setRdoCount(activeRdos.length)
            setPendingRdos(activeRdos.filter((r) => r.status === 'submitted').length)
          }

          if (serverSheets.length > 0) {
            const activeServerSheets = serverSheets.filter((s) => !s.deleted)
            setSheetCount(activeServerSheets.length)
          } else {
            const sheets = await offlineStorage.getAllFieldSheets()
            const activeSheets = sheets.filter((s) => !s.deleted)
            setSheetCount(activeSheets.length)
          }
        } catch (serverFetchErr) {
          console.warn(
            'Could not fetch server counts directly, using offline cache:',
            serverFetchErr,
          )
          const rdos = await offlineStorage.getAllRdos()
          const activeRdos = rdos.filter((r) => !r.deleted)
          setRdoCount(activeRdos.length)
          setPendingRdos(activeRdos.filter((r) => r.status === 'submitted').length)

          const sheets = await offlineStorage.getAllFieldSheets()
          const activeSheets = sheets.filter((s) => !s.deleted)
          setSheetCount(activeSheets.length)
        }
      } else {
        const rdos = await offlineStorage.getAllRdos()
        const activeRdos = rdos.filter((r) => !r.deleted)
        setRdoCount(activeRdos.length)
        setPendingRdos(activeRdos.filter((r) => r.status === 'submitted').length)

        const sheets = await offlineStorage.getAllFieldSheets()
        const activeSheets = sheets.filter((s) => !s.deleted)
        setSheetCount(activeSheets.length)
      }

      if (navigator.onLine && pb.authStore.isValid && user?.role === 'admin') {
        try {
          const users = await pb.collection('users').getList(1, 1, {
            filter: 'deleted = false || deleted:isset = false',
          })
          if (users.totalItems > 0) {
            setUserCount(users.totalItems)
          }
        } catch (userErr) {
          console.warn('Dashboard users count fetch error:', userErr)
        }
      }

      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const projs = await pb.collection('projects').getFullList({
            filter: 'deleted = false || deleted:isset = false',
            sort: '-created',
            expand: 'client,contract',
          })
          if (projs.length > 0) {
            setProjectsList(
              projs
                .filter((p) => !p.deleted && !p.archived)
                .map((p) => {
                  const clientExp = p.expand?.client as any
                  const contractExp = p.expand?.contract as any
                  return {
                    id: p.id,
                    name: p.name,
                    client: clientExp?.name || 'Cliente EPA',
                    code: p.epa_code || 'EPA-001',
                    location: p.location || 'Área Industrial',
                    status: (p.status as any) || 'active',
                    progress: p.progress ?? 50,
                    contract: contractExp?.code || 'CT-2025',
                    team: ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos'],
                  }
                }),
            )
          }
        } catch (projErr) {
          console.warn('Projects fetch error:', projErr)
        }
      }
    } catch (err) {
      console.warn('Dashboard stats error:', err)
    }
  }

  useEffect(() => {
    loadStats()

    const handleSyncComplete = () => {
      loadStats()
    }
    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    }
  }, [user])

  return (
    <div className="space-y-6">
      {/* Welcome header with dynamic greeting */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between epa-card p-6 bg-gradient-to-r from-[#032825] via-[#086B63] to-[#0a524c] text-white dark:border-slate-800">
        <div>
          <p className="text-xs text-emerald-200 capitalize">{getFormattedDate()}</p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl">
            {getGreeting()} <span className="align-top text-lg">👋</span>
          </h2>
          <p className="mt-1 text-xs text-emerald-100/80">
            Acompanhe em tempo real as operações ambientais, RDOs e planilhas de campo.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 w-full sm:w-auto">
          {(user?.role === 'admin' || user?.role === 'technician' || user?.role === 'operator') && (
            <Button
              onClick={() => navigate('rdos')}
              className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-500 shadow-md min-h-[44px] font-semibold text-xs justify-center"
            >
              <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
              Novo RDO
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'technician' || user?.role === 'operator') && (
            <Button
              onClick={() => navigate('fields')}
              variant="outline"
              className="w-full sm:w-auto bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[44px] font-semibold text-xs justify-center"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />
              Planilha de Campo
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button
              onClick={() => navigate('projects')}
              variant="outline"
              className="w-full sm:w-auto bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[44px] font-semibold text-xs justify-center"
            >
              <FolderKanban className="mr-2 h-4 w-4 shrink-0" />
              Gerenciar Projetos
            </Button>
          )}
        </div>
      </section>

      {/* Main KPI Counters */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            visible: true,
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
            visible: true,
          },
          {
            label: 'Planilhas de campo',
            value: String(sheetCount),
            helper: 'medições operacionais',
            trend: `${sheetCount} ativas`,
            icon: FileSpreadsheet,
            color: 'teal',
            up: true,
            page: 'fields' as Page,
            visible: true,
          },
          {
            label: 'Usuários cadastrados',
            value: user?.role === 'admin' ? String(userCount) : 'Ativo',
            helper: user?.role === 'admin' ? 'gestão de acessos' : 'seu perfil ativo',
            trend: user?.role === 'admin' ? 'acessos do sistema' : 'Operação OK',
            icon: Users,
            color: 'amber',
            up: true,
            page: (user?.role === 'admin' ? 'users' : 'dashboard') as Page,
            visible: user?.role === 'admin',
          },
        ]
          .filter((stat) => stat.visible)
          .map((stat) => {
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

      {/* Projects Progress */}
      <section>
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
          <div className="grid gap-5 p-5 md:grid-cols-2">
            {projectsList.map((project) => (
              <button
                onClick={() => navigate('projects')}
                key={project.id}
                className="group block w-full text-left rounded-lg p-2 transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
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
      </section>

      {/* Recent Activities & Quick Shortcuts */}
      <section className="grid gap-5 lg:grid-cols-1 xl:grid-cols-[1.1fr_.9fr]">
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
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('projects')}
                className="flex items-center justify-between rounded-xl border p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <FolderKanban className="h-5 w-5 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold">Projetos & Obras Ambientais</p>
                    <p className="text-[10px] text-slate-500">
                      Cadastrar novo projeto, gerenciar contratos e equipes
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            )}

            {(user?.role === 'admin' ||
              user?.role === 'technician' ||
              user?.role === 'operator') && (
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
            )}

            {(user?.role === 'admin' ||
              user?.role === 'technician' ||
              user?.role === 'operator') && (
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
            )}

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
                      Controle de papéis (Admin e Técnico)
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
