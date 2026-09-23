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
import {
  useSync,
  SYNC_BROADCAST_EVENT,
  REALTIME_RECORD_UPDATE,
  RealtimeRecordUpdateDetail,
} from '@/context/SyncContext'
import { offlineStorage } from '@/services/offlineStorage'
import { Page } from '@/components/Layout'
import { projects as staticProjects, type EpaProject } from '@/data/epa'
import pb from '@/lib/pocketbase/client'

export function Dashboard({ navigate }: { navigate: (page: Page) => void }) {
  const { user } = useAuth()
  const { isOnline, isSyncing, syncNow, pendingCount } = useSync()
  const [rdoCount, setRdoCount] = useState<number>(0)
  const [pendingRdos, setPendingRdos] = useState<number>(0)
  const [sheetCount, setSheetCount] = useState<number>(0)
  const [userCount, setUserCount] = useState<number>(4)
  const [projectsList, setProjectsList] = useState(staticProjects)
  const [recentActivities, setRecentActivities] = useState<
    Array<{
      id: string
      user: string
      initials: string
      action: string
      entity: string
      time: string
      sortNumber: number
      sortTimestamp: number
    }>
  >([])
  const [loadingActivities, setLoadingActivities] = useState<boolean>(true)

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

  const loadStats = async (_options?: { silent?: boolean }) => {
    try {
      // 1. Se online e PocketBase disponível, consulta diretamente o servidor e purga itens obsoletos locais
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          const [serverRdos, serverSheets] = await Promise.all([
            pb.collection('reports_rdo').getFullList({ sort: '-created' }),
            pb.collection('field_spreadsheets').getFullList({ sort: '-created' }),
          ])

          const serverRdoIds = new Set(serverRdos.map((r) => r.id))
          const serverSheetIds = new Set(serverSheets.map((s) => s.id))

          // Purga registros órfãos ou pré-zeragem do IndexedDB
          const defaultWipe = new Date('2025-05-28T00:00:00Z').getTime()
          await offlineStorage.purgePreWipeOperationalData(defaultWipe, {
            knownServerRdoIds: serverRdoIds,
            knownServerSheetIds: serverSheetIds,
            purgeAllSynced: serverRdos.length === 0 && serverSheets.length === 0,
          })

          // Recalcula somando itens ativos do servidor + eventuais rascunhos pendentes offline novos
          const localRdos = await offlineStorage.getAllRdos()
          const pendingNewRdos = localRdos.filter(
            (r) =>
              !r.deleted &&
              (r.syncStatus === 'pending_create' || r.syncStatus === 'pending_update') &&
              !serverRdoIds.has(r.id),
          )
          const activeServerRdos = serverRdos.filter((r) => !r.deleted)
          const totalActiveRdos = activeServerRdos.length + pendingNewRdos.length
          const submittedRdosCount =
            activeServerRdos.filter((r) => r.status === 'submitted').length +
            pendingNewRdos.filter((r) => r.status === 'submitted').length
          setRdoCount(totalActiveRdos)
          setPendingRdos(submittedRdosCount)

          const localSheets = await offlineStorage.getAllFieldSheets()
          const pendingNewSheets = localSheets.filter(
            (s) =>
              !s.deleted &&
              (s.syncStatus === 'pending_create' || s.syncStatus === 'pending_update') &&
              !serverSheetIds.has(s.id),
          )
          const activeServerSheets = serverSheets.filter((s) => !s.deleted)
          setSheetCount(activeServerSheets.length + pendingNewSheets.length)
        } catch (serverFetchErr) {
          console.warn(
            'Could not fetch server counts directly, using offline cache:',
            serverFetchErr,
          )
          const defaultWipe = new Date('2025-05-28T00:00:00Z').getTime()
          await offlineStorage.purgePreWipeOperationalData(defaultWipe)
          const rdos = await offlineStorage.getAllRdos()
          const activeRdos = rdos.filter((r) => !r.deleted)
          setRdoCount(activeRdos.length)
          setPendingRdos(activeRdos.filter((r) => r.status === 'submitted').length)

          const sheets = await offlineStorage.getAllFieldSheets()
          const activeSheets = sheets.filter((s) => !s.deleted)
          setSheetCount(activeSheets.length)
        }
      } else {
        const defaultWipe = new Date('2025-05-28T00:00:00Z').getTime()
        await offlineStorage.purgePreWipeOperationalData(defaultWipe)
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

      // 4. Carregar Atividades Recentes reais combinando servidor, logs de auditoria e armazenamento offline
      try {
        const activities: Array<{
          id: string
          user: string
          initials: string
          action: string
          entity: string
          time: string
          sortNumber: number
          sortTimestamp: number
        }> = []

        const formatFullDateTime = (dateVal: string | number | undefined | null) => {
          if (!dateVal) return ''
          const d = new Date(dateVal)
          if (isNaN(d.getTime())) return ''
          return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        }

        const getInitials = (nameStr: string) => {
          const parts = (nameStr || 'Sistema').trim().split(/\s+/)
          return (
            parts
              .slice(0, 2)
              .map((p) => p[0])
              .join('')
              .toUpperCase() || 'EP'
          )
        }

        // Buscar do servidor se online
        if (navigator.onLine && pb.authStore.isValid) {
          try {
            const [recentRdos, recentSheets, recentLogs] = await Promise.all([
              pb.collection('reports_rdo').getList(1, 10, {
                sort: '-created',
                expand: 'performed_by,project',
              }),
              pb.collection('field_spreadsheets').getList(1, 10, {
                sort: '-created',
                expand: 'operator,project',
              }),
              pb.collection('audit_logs').getList(1, 10, {
                sort: '-created',
                expand: 'actor',
              }),
            ])

            // Processar RDOs do servidor
            for (const r of recentRdos.items) {
              const num = typeof r.number === 'number' && r.number > 0 ? r.number : 0
              const label = num > 0 ? `RDO Nº ${num}` : 'RDO Offline'
              const performer = (r.expand?.performed_by as any) || {}
              const userName = performer.name || performer.email || 'Técnico EPA'
              const proj = (r.expand?.project as any) || {}
              const projName = proj.name || 'Projeto Operacional'
              const timeDisplay = formatFullDateTime(r.created)
              const sortTimestamp = r.created ? new Date(r.created).getTime() : 0

              let actionText = `emitiu o ${label}`
              if (r.status === 'submitted') actionText = `enviou o ${label} para aprovação`
              else if (r.status === 'approved') actionText = `aprovou o ${label}`
              else if (r.status === 'returned') actionText = `devolveu o ${label} para correção`
              else if (r.deleted) actionText = `excluiu o ${label}`

              activities.push({
                id: `server_rdo_${r.id}`,
                user: userName,
                initials: getInitials(userName),
                action: actionText,
                entity: `${projName}${r.activity_title ? ` · ${r.activity_title}` : ''}`,
                time: timeDisplay,
                sortNumber: num,
                sortTimestamp,
              })
            }

            // Processar Planilhas de Campo do servidor
            for (const s of recentSheets.items) {
              const num = typeof s.number === 'number' && s.number > 0 ? s.number : 0
              const label = num > 0 ? `Planilha Nº ${num}` : 'Planilha Offline'
              const op = (s.expand?.operator as any) || {}
              const userName = op.name || op.email || 'Técnico EPA'
              const proj = (s.expand?.project as any) || {}
              const projName = proj.name || 'Projeto Operacional'
              const timeDisplay = formatFullDateTime(s.created)
              const sortTimestamp = s.created ? new Date(s.created).getTime() : 0

              let actionText = `preencheu a ${label}`
              if (s.status === 'submitted') actionText = `enviou a ${label} para aprovação`
              else if (s.status === 'approved') actionText = `aprovou a ${label}`
              else if (s.status === 'returned') actionText = `devolveu a ${label} para correção`
              else if (s.deleted) actionText = `excluiu a ${label}`

              activities.push({
                id: `server_sheet_${s.id}`,
                user: userName,
                initials: getInitials(userName),
                action: actionText,
                entity: `${projName} · Área ${s.area || 'Geral'}`,
                time: timeDisplay,
                sortNumber: num,
                sortTimestamp,
              })
            }

            // Processar Logs de Auditoria do servidor
            for (const log of recentLogs.items) {
              const actor = (log.expand?.actor as any) || {}
              const userName = actor.name || actor.email || 'Sistema'
              const details = (log.details as any) || {}
              const label = details.label || ''
              const timeDisplay = formatFullDateTime(log.created)
              const sortTimestamp = log.created ? new Date(log.created).getTime() : 0

              let actionText = log.action
              if (log.action === 'soft_delete') {
                actionText = details.deleted_reason
                  ? `excluiu e arquivou (Motivo: "${details.deleted_reason}")`
                  : 'excluiu e arquivou o registro'
              } else if (log.action === 'restore') actionText = 'restaurou o registro excluído'
              else if (log.action === 'archive') actionText = 'arquivou o registro'
              else if (log.action === 'unarchive') actionText = 'desarquivou o registro'
              else if (log.action === 'delete') actionText = 'excluiu registro definitivamente'
              else if (log.action === 'approve') actionText = 'aprovou o relatório'
              else if (log.action === 'return') actionText = 'devolveu para correção'
              else if (log.action === 'create') actionText = 'criou o registro'
              else if (log.action === 'update') actionText = 'atualizou informações'

              let entityText = log.entity
              if (log.entity === 'projects') entityText = 'Projeto'
              else if (log.entity === 'reports_rdo') entityText = 'RDO'
              else if (log.entity === 'field_spreadsheets') entityText = 'Planilha de Campo'
              else if (log.entity === 'users') entityText = 'Usuários'
              else if (log.entity === 'system_reset') entityText = 'Sistema'

              activities.push({
                id: `log_${log.id}`,
                user: userName,
                initials: getInitials(userName),
                action: label ? `${actionText} (${label})` : actionText,
                entity: entityText,
                time: timeDisplay,
                sortNumber: 0,
                sortTimestamp,
              })
            }
          } catch (serverActErr) {
            console.warn('Erro ao carregar atividades do servidor:', serverActErr)
          }
        }

        // Complementar / Fallback com offlineStorage
        try {
          const [offlineRdos, offlineSheets] = await Promise.all([
            offlineStorage.getAllRdos(),
            offlineStorage.getAllFieldSheets(),
          ])

          const existingIds = new Set(activities.map((a) => a.id))

          for (const r of offlineRdos) {
            const sid = `server_rdo_${r.id}`
            const oid = `offline_rdo_${r.id}`
            if (existingIds.has(sid) || existingIds.has(oid)) continue

            const num = typeof r.number === 'number' && r.number > 0 ? r.number : 0
            const label = num > 0 ? `RDO Nº ${num}` : 'RDO Offline'
            const userName = r.performedByName || user?.name || 'Técnico EPA'
            const timeVal =
              r.serverCreatedAt || (r.lastModified ? new Date(r.lastModified).toISOString() : '')
            const timeDisplay = formatFullDateTime(timeVal)
            const sortTimestamp = r.serverCreatedAt
              ? new Date(r.serverCreatedAt).getTime()
              : r.lastModified || 0

            activities.push({
              id: oid,
              user: userName,
              initials: getInitials(userName),
              action: `${r.status === 'submitted' ? 'enviou para aprovação o' : 'editou o'} ${label}`,
              entity: `${r.projectName || 'Projeto'}${r.activityTitle ? ` · ${r.activityTitle}` : ''}`,
              time: timeDisplay,
              sortNumber: num,
              sortTimestamp,
            })
          }

          for (const s of offlineSheets) {
            const sid = `server_sheet_${s.id}`
            const oid = `offline_sheet_${s.id}`
            if (existingIds.has(sid) || existingIds.has(oid)) continue

            const num = typeof s.number === 'number' && s.number > 0 ? s.number : 0
            const label = num > 0 ? `Planilha Nº ${num}` : 'Planilha Offline'
            const userName = s.operatorName || user?.name || 'Técnico EPA'
            const timeVal =
              s.serverCreatedAt || (s.lastModified ? new Date(s.lastModified).toISOString() : '')
            const timeDisplay = formatFullDateTime(timeVal)
            const sortTimestamp = s.serverCreatedAt
              ? new Date(s.serverCreatedAt).getTime()
              : s.lastModified || 0

            activities.push({
              id: oid,
              user: userName,
              initials: getInitials(userName),
              action: `${s.status === 'submitted' ? 'enviou para aprovação a' : 'editou a'} ${label}`,
              entity: `${s.projectName || 'Projeto'} · Área ${s.area || 'Geral'}`,
              time: timeDisplay,
              sortNumber: num,
              sortTimestamp,
            })
          }
        } catch (offlineActErr) {
          console.warn('Erro ao carregar atividades offline:', offlineActErr)
        }

        // Ordenação decrescente:
        // Primeiro por número sequencial do servidor (sortNumber DESC),
        // e para itens sem número (rascunhos / logs), pelo timestamp de criação (sortTimestamp DESC)
        activities.sort((a, b) => {
          if (a.sortNumber > 0 && b.sortNumber > 0) {
            if (a.sortNumber !== b.sortNumber) return b.sortNumber - a.sortNumber
          } else if (a.sortNumber > 0 && b.sortNumber === 0) {
            return -1
          } else if (b.sortNumber > 0 && a.sortNumber === 0) {
            return 1
          }
          return b.sortTimestamp - a.sortTimestamp
        })

        // Atualiza a lista de atividades recentes reais (sem fallback estático quando houver dados reais no sistema)
        if (activities.length > 0) {
          setRecentActivities(activities.slice(0, 8))
        } else {
          setRecentActivities([])
        }
      } catch (actErr) {
        console.warn('Erro geral ao processar atividades recentes:', actErr)
      } finally {
        setLoadingActivities(false)
      }
    } catch (err) {
      console.warn('Dashboard stats error:', err)
    }
  }

  useEffect(() => {
    loadStats()

    const handleSyncComplete = () => {
      loadStats({ silent: true })
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeRecordUpdateDetail>
      const detail = customEvent.detail
      const col = detail?.collection
      const action = detail?.action
      const record = detail?.record

      // Atualização incremental imediata de projetos sem depender exclusivamente de loadStats
      if (col === 'projects' && record) {
        setProjectsList((prev) => {
          const id = record.id || detail.id
          if (action === 'delete') {
            return prev.filter((p) => p.id !== id)
          }

          const isAssigned =
            user?.role === 'admin' ||
            (Array.isArray(record.assigned_users)
              ? record.assigned_users.includes(user?.id)
              : record.assigned_users === user?.id)

          if (!isAssigned) {
            return prev.filter((p) => p.id !== id)
          }

          const mappedProj: EpaProject = {
            id: String(record.id || detail.id),
            name: String(record.name || 'Projeto Sem Nome'),
            client: String(record.client || 'Cliente EPA'),
            code: String(record.epa_code || 'EPA-001'),
            location: String(record.location || 'Área Operacional'),
            status:
              record.status === 'paused' || record.status === 'completed'
                ? record.status
                : 'active',
            progress: typeof record.progress === 'number' ? record.progress : 0,
            contract: String(record.contract || 'CT-2025'),
            team: ['Equipe EPA'],
          }

          const exists = prev.some((p) => p.id === id)
          if (exists) {
            return prev.map((p) => (p.id === id ? { ...p, ...mappedProj } : p))
          } else {
            return [mappedProj, ...prev]
          }
        })
      }

      // Reage incrementalmente para qualquer coleção relevante
      if (
        col === 'reports_rdo' ||
        col === 'field_spreadsheets' ||
        col === 'projects' ||
        col === 'users'
      ) {
        loadStats({ silent: true })
      }
    }

    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
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
          {(user?.role === 'admin' || user?.role === 'technician') && (
            <Button
              onClick={() => navigate('rdos')}
              className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-500 shadow-md min-h-[44px] font-semibold text-xs justify-center"
            >
              <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
              Novo RDO
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'technician') && (
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
            {loadingActivities ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="mx-auto h-5 w-5 animate-spin text-emerald-600 mb-2" />
                Carregando atividades recentes...
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma atividade recente registrada no sistema.
              </div>
            ) : (
              recentActivities.slice(0, 6).map((item) => (
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
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-500 shrink-0" />
                </div>
              ))
            )}
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

            {(user?.role === 'admin' || user?.role === 'technician') && (
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

            {(user?.role === 'admin' || user?.role === 'technician') && (
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
