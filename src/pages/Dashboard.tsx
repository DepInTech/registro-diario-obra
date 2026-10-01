import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  RefreshCw,
  Users,
  Waves,
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
import { inSituService, naSheetService } from '@/services/inSituAndNaService'

export function Dashboard({ navigate }: { navigate: (page: Page) => void }) {
  const { user } = useAuth()
  const { isOnline, isSyncing, syncNow, pendingCount } = useSync()
  const [rdoCount, setRdoCount] = useState<number>(0)
  const [pendingRdos, setPendingRdos] = useState<number>(0)
  const [sheetCount, setSheetCount] = useState<number>(0)
  const [inSituCount, setInSituCount] = useState<number>(0)
  const [naSheetCount, setNaSheetCount] = useState<number>(0)
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
          const [serverRdos, serverSheets, serverInSitu, serverNaSheets] = await Promise.all([
            pb.collection('reports_rdo').getFullList({ sort: '-created' }),
            pb.collection('field_spreadsheets').getFullList({ sort: '-created' }),
            pb
              .collection('in_situ_sheets')
              .getFullList({ sort: '-created' })
              .catch(() => []),
            pb
              .collection('na_sheets')
              .getFullList({ sort: '-created' })
              .catch(() => []),
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

          const activeInSitu = serverInSitu.filter((s: any) => !s.deleted && !s.archived)
          setInSituCount(activeInSitu.length)

          const activeNa = serverNaSheets.filter((s: any) => !s.deleted && !s.archived)
          setNaSheetCount(activeNa.length)
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

          const cachedInSitu = await inSituService.listSheets()
          setInSituCount(cachedInSitu.filter((s) => !s.archived).length)
          const cachedNa = await naSheetService.listSheets()
          setNaSheetCount(cachedNa.filter((s) => !s.archived).length)
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

        const cachedInSitu = await inSituService.listSheets()
        setInSituCount(cachedInSitu.filter((s) => !s.archived).length)
        const cachedNa = await naSheetService.listSheets()
        setNaSheetCount(cachedNa.filter((s) => !s.archived).length)
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

      // Carregar Atividades Recentes reais combinando servidor, logs de auditoria e armazenamento offline
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
            const [recentRdos, recentSheets, recentInSitu, recentNa, recentLogs] =
              await Promise.all([
                pb.collection('reports_rdo').getList(1, 10, {
                  sort: '-created',
                  expand: 'performed_by,project',
                }),
                pb.collection('field_spreadsheets').getList(1, 10, {
                  sort: '-created',
                  expand: 'operator,project',
                }),
                pb
                  .collection('in_situ_sheets')
                  .getList(1, 10, {
                    sort: '-created',
                  })
                  .catch(() => ({ items: [] })),
                pb
                  .collection('na_sheets')
                  .getList(1, 10, {
                    sort: '-created',
                  })
                  .catch(() => ({ items: [] })),
                pb.collection('audit_logs').getList(1, 20, {
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

            // Processar In-Situ do servidor
            for (const ins of recentInSitu.items) {
              const proj = ins.project_name || '21-0229'
              const sys = ins.system_name ? ` (${ins.system_name})` : ''
              const userName = ins.responsible_name || 'Técnico EPA'
              const timeDisplay = formatFullDateTime(ins.created)
              const sortTimestamp = ins.created ? new Date(ins.created).getTime() : 0

              let actionText = 'criou uma nova medição In-Situ'
              if (ins.status === 'submitted') actionText = 'enviou a medição In-Situ'
              else if (ins.status === 'approved') actionText = 'aprovou a medição In-Situ'

              activities.push({
                id: `server_insitu_${ins.id}`,
                user: userName,
                initials: getInitials(userName),
                action: actionText,
                entity: `Projeto ${proj}${sys}`,
                time: timeDisplay,
                sortNumber: 0,
                sortTimestamp,
              })
            }

            // Processar Planilhas de NA do servidor
            for (const na of recentNa.items) {
              const area = na.area_name || 'Área de Monitoramento'
              const userName = na.responsible_name || 'Técnico EPA'
              const timeDisplay = formatFullDateTime(na.created)
              const sortTimestamp = na.created ? new Date(na.created).getTime() : 0

              let actionText = 'criou uma Planilha de NA'
              if (na.status === 'submitted') actionText = 'enviou a Planilha de NA'
              else if (na.status === 'approved') actionText = 'aprovou a Planilha de NA'

              activities.push({
                id: `server_na_${na.id}`,
                user: userName,
                initials: getInitials(userName),
                action: actionText,
                entity: `Área: ${area}`,
                time: timeDisplay,
                sortNumber: 0,
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
              else if (log.action === 'create') {
                if (log.entity === 'in_situ_sheets') actionText = 'criou uma nova medição In-Situ'
                else if (log.entity === 'na_sheets') actionText = 'criou uma Planilha de NA'
                else actionText = 'criou o registro'
              } else if (log.action === 'update') {
                if (log.entity === 'in_situ_sheets') actionText = 'editou a medição In-Situ'
                else if (log.entity === 'na_sheets') actionText = 'editou a Planilha de NA'
                else actionText = 'atualizou informações'
              } else if (log.action === 'export_pdf' || log.action === 'export_excel') {
                if (log.entity === 'in_situ_sheets') actionText = 'exportou a medição In-Situ'
                else if (log.entity === 'na_sheets') actionText = 'exportou uma Planilha de NA'
                else actionText = `exportou o relatório (${details.format || 'PDF'})`
              } else if (log.action === 'add_well') {
                actionText = details.well_code
                  ? `adicionou o poço ${details.well_code} à Planilha de NA`
                  : 'adicionou um poço à Planilha de NA'
              }

              let entityText = log.entity
              if (log.entity === 'projects') entityText = 'Projeto'
              else if (log.entity === 'reports_rdo') entityText = 'RDO'
              else if (log.entity === 'field_spreadsheets') entityText = 'Planilha de Campo'
              else if (log.entity === 'in_situ_sheets') entityText = 'Medição In-Situ'
              else if (log.entity === 'na_sheets') entityText = 'Planilha de NA'
              else if (log.entity === 'na_area_configs') entityText = 'Configuração de Área'
              else if (log.entity === 'users') entityText = 'Usuários'
              else if (log.entity === 'system_reset') entityText = 'Sistema'

              activities.push({
                id: `log_${log.id}`,
                user: userName,
                initials: getInitials(userName),
                action:
                  label && log.action !== 'add_well' ? `${actionText} (${label})` : actionText,
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
          const [offlineRdos, offlineSheets, offlineInSitu, offlineNa] = await Promise.all([
            offlineStorage.getAllRdos(),
            offlineStorage.getAllFieldSheets(),
            inSituService.listSheets().catch(() => []),
            naSheetService.listSheets().catch(() => []),
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

          for (const ins of offlineInSitu) {
            const sid = `server_insitu_${ins.id}`
            const oid = `offline_insitu_${ins.id}`
            if (existingIds.has(sid) || existingIds.has(oid)) continue

            const userName = ins.responsible_name || user?.name || 'Técnico EPA'
            const timeVal = ins.created || ins.updated || ''
            const timeDisplay = formatFullDateTime(timeVal)
            const sortTimestamp = timeVal ? new Date(timeVal).getTime() : 0

            activities.push({
              id: oid,
              user: userName,
              initials: getInitials(userName),
              action: 'registrou medição In-Situ',
              entity: `Projeto ${ins.project_name || '21-0229'}`,
              time: timeDisplay,
              sortNumber: 0,
              sortTimestamp,
            })
          }

          for (const na of offlineNa) {
            const sid = `server_na_${na.id}`
            const oid = `offline_na_${na.id}`
            if (existingIds.has(sid) || existingIds.has(oid)) continue

            const userName = na.responsible_name || user?.name || 'Técnico EPA'
            const timeVal = na.created || na.updated || ''
            const timeDisplay = formatFullDateTime(timeVal)
            const sortTimestamp = timeVal ? new Date(timeVal).getTime() : 0

            activities.push({
              id: oid,
              user: userName,
              initials: getInitials(userName),
              action: 'registrou Planilha de NA',
              entity: `Área: ${na.area_name || 'Geral'}`,
              time: timeDisplay,
              sortNumber: 0,
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
        col === 'in_situ_sheets' ||
        col === 'na_sheets' ||
        col === 'na_area_configs' ||
        col === 'audit_logs' ||
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
      {/* 1. Welcome header with dynamic greeting & comfortable button wrap */}
      <section className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between epa-card p-6 bg-gradient-to-r from-[#032825] via-[#086B63] to-[#0a524c] text-white dark:border-slate-800">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs text-emerald-200 capitalize tracking-wide font-medium">
            {getFormattedDate()}
          </p>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight md:text-3xl text-white">
            {getGreeting()} <span className="align-top text-xl">👋</span>
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
            Acompanhe em tempo real as operações ambientais, RDOs e planilhas de campo.
          </p>
        </div>

        {/* Action buttons arranged comfortably in responsive flex wrap */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {(user?.role === 'admin' || user?.role === 'technician') && (
            <Button
              onClick={() => navigate('rdos')}
              className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-md min-h-[42px] px-4 font-semibold text-xs justify-center shrink-0"
            >
              <ClipboardList className="mr-2 h-4 w-4 shrink-0" />
              Novo RDO
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'technician') && (
            <Button
              onClick={() => navigate('fields')}
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[42px] px-4 font-semibold text-xs justify-center shrink-0"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4 shrink-0" />
              Planilha de Campo
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'technician') && (
            <Button
              onClick={() => navigate('insitu')}
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[42px] px-4 font-semibold text-xs justify-center shrink-0"
            >
              <Activity className="mr-2 h-4 w-4 shrink-0" />
              Nova Medição In-Situ
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'technician') && (
            <Button
              onClick={() => navigate('na_monitoring')}
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[42px] px-4 font-semibold text-xs justify-center shrink-0"
            >
              <Waves className="mr-2 h-4 w-4 shrink-0" />
              Nova Planilha de NA
            </Button>
          )}
          {user?.role === 'admin' && (
            <Button
              onClick={() => navigate('projects')}
              variant="outline"
              className="bg-white/10 text-white hover:bg-white/20 border-white/20 min-h-[42px] px-4 font-semibold text-xs justify-center shrink-0"
            >
              <FolderKanban className="mr-2 h-4 w-4 shrink-0" />
              Gerenciar Projetos
            </Button>
          )}
        </div>
      </section>

      {/* 2 & 3. Main KPI Counters - STRICT 3x2 Grid (Desktop: 3 per row, Tablet: 2, Mobile: 1) */}
      <section className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {[
          {
            id: 'projects',
            label: 'Projetos ativos',
            value: String(projectsList.length),
            helper: 'Em operação ambiental',
            badge: '+1 este mês',
            icon: FolderKanban,
            up: true,
            page: 'projects' as Page,
            visible: true,
          },
          {
            id: 'rdos',
            label: 'RDOs aguardando aprovação',
            value: String(pendingRdos),
            helper: `${rdoCount} relatórios no total`,
            badge: pendingRdos > 0 ? `${pendingRdos} pendentes` : 'Tudo em dia',
            icon: ClipboardList,
            up: pendingRdos === 0,
            page: 'rdos' as Page,
            visible: true,
          },
          {
            id: 'sheets',
            label: 'Planilhas de Campo',
            value: String(sheetCount),
            helper: 'Medições operacionais',
            badge: `${sheetCount} ativas`,
            icon: FileSpreadsheet,
            up: true,
            page: 'fields' as Page,
            visible: true,
          },
          {
            id: 'insitu',
            label: 'Medições In-Situ',
            value: String(inSituCount),
            helper: 'Registros realizados',
            badge: `${inSituCount} ativas`,
            icon: Activity,
            up: true,
            page: 'insitu' as Page,
            visible: true,
          },
          {
            id: 'na',
            label: 'Planilhas de NA',
            value: String(naSheetCount),
            helper: 'Monitoramentos realizados',
            badge: `${naSheetCount} ativas`,
            icon: Waves,
            up: true,
            page: 'na_monitoring' as Page,
            visible: true,
          },
          {
            id: 'users',
            label: 'Usuários cadastrados',
            value: user?.role === 'admin' ? String(userCount) : '1',
            helper: 'Gestão de acessos',
            badge: 'Acessos do sistema',
            icon: Users,
            up: true,
            page: (user?.role === 'admin' ? 'users' : 'dashboard') as Page,
            visible: true,
          },
        ]
          .filter((stat) => stat.visible)
          .map((stat) => {
            const Icon = stat.icon
            const Trend = stat.up ? ArrowUpRight : ArrowDownRight
            return (
              <article
                key={stat.id}
                onClick={() => navigate(stat.page)}
                className="epa-card group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-500/40 cursor-pointer flex flex-col justify-between min-h-[160px]"
              >
                <div>
                  {/* Top: Icon + Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:group-hover:bg-emerald-900/60">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                      <Trend
                        className={`h-3.5 w-3.5 shrink-0 ${stat.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}
                      />
                      <span className="whitespace-nowrap">{stat.badge}</span>
                    </div>
                  </div>

                  {/* 4. Visual Hierarchy: Big Number -> Title */}
                  <div className="mt-4">
                    <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                      {stat.label}
                    </p>
                  </div>
                </div>

                {/* Footer: Complementary info cleanly separated */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
                  <span className="truncate">{stat.helper}</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs shrink-0 ml-2 group-hover:underline">
                    Ver detalhes →
                  </span>
                </div>
              </article>
            )
          })}
      </section>

      {/* 5. Projects Progress */}
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
                className="group block w-full text-left rounded-lg p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-900/50"
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

      {/* 6. Recent Activities & Operational Shortcuts */}
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
                  className="flex gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
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
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
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
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'technician') && (
              <button
                onClick={() => navigate('rdos')}
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
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
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'technician') && (
              <button
                onClick={() => navigate('fields')}
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
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
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'technician') && (
              <button
                onClick={() => navigate('insitu')}
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-cyan-600" />
                  <div>
                    <p className="text-xs font-semibold">Medições In-Situ</p>
                    <p className="text-[10px] text-slate-500">
                      Registrar e consultar medições de parâmetros In-Situ
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}

            {(user?.role === 'admin' || user?.role === 'technician') && (
              <button
                onClick={() => navigate('na_monitoring')}
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
              >
                <div className="flex items-center gap-3">
                  <Waves className="h-5 w-5 text-sky-600" />
                  <div>
                    <p className="text-xs font-semibold">Planilha de NA</p>
                    <p className="text-[10px] text-slate-500">
                      Registrar e consultar monitoramentos do nível d'água
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}

            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('users')}
                className="flex items-center justify-between rounded-xl border p-3.5 text-left transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:bg-slate-900/60"
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
                <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              </button>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
