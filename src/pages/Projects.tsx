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
  Loader2,
  X,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Briefcase,
  Layers,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import {
  isValidDeletionJustification,
  INVALID_JUSTIFICATION_MESSAGE,
} from '@/lib/justificationValidator'
import {
  projects as staticProjects,
  rdos as staticRdos,
  fieldSheets as staticFieldSheets,
  type EpaProject,
} from '@/data/epa'
import { useAuth } from '@/context/AuthContext'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { offlineStorage, OfflineProjectItem } from '@/services/offlineStorage'
import {
  SYNC_BROADCAST_EVENT,
  REALTIME_RECORD_UPDATE,
  RealtimeRecordUpdateDetail,
} from '@/context/SyncContext'
import type { Client, Contract, Company, Area, EpaUser } from '@/types/epa'

interface ProjectItem extends EpaProject {
  rawClient?: string
  rawContract?: string
  rawCompany?: string
  rawArea?: string
  assignedUsersIds?: string[]
  archived?: boolean
  deleted?: boolean
  deletedReason?: string
  deletedBy?: string
  deletedByName?: string
  deletedAt?: string
}

export function Projects({
  query,
  onOpenRdo,
  onOpenField,
}: {
  query: string
  onOpenRdo: () => void
  onOpenField: () => void
}) {
  const [selected, setSelected] = useState<ProjectItem | null>(null)
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tabFilter, setTabFilter] = useState<'active' | 'archived' | 'deleted'>('active')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all')

  // Delete modal state
  const [deleteModalProject, setDeleteModalProject] = useState<ProjectItem | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Auxiliary data for project creation / edit
  const [clients, setClients] = useState<Client[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [usersList, setUsersList] = useState<EpaUser[]>([])

  // Modal states
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [formName, setFormName] = useState('')
  const [formEpaCode, setFormEpaCode] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formContractId, setFormContractId] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('')
  const [formAreaId, setFormAreaId] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formProgress, setFormProgress] = useState(0)
  const [formStatus, setFormStatus] = useState<'active' | 'paused' | 'completed'>('active')
  const [formAssignedUsers, setFormAssignedUsers] = useState<string[]>([])

  // Quick auxiliary create modals inside form
  const [showQuickClient, setShowQuickClient] = useState(false)
  const [quickClientName, setQuickClientName] = useState('')
  const [showQuickContract, setShowQuickContract] = useState(false)
  const [quickContractCode, setQuickContractCode] = useState('')

  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'

  const loadAuxiliaryData = async () => {
    if (!navigator.onLine || !pb.authStore.isValid) return
    try {
      const [cls, cts, cps, ars, uss] = await Promise.all([
        pb.collection('clients').getFullList<Client>({ sort: 'name' }),
        pb.collection('contracts').getFullList<Contract>({ sort: '-created' }),
        pb.collection('companies').getFullList<Company>({ sort: 'name' }),
        pb.collection('areas').getFullList<Area>({ sort: 'name' }),
        pb.collection('users').getFullList<EpaUser>({ sort: 'name' }),
      ])
      setClients(cls)
      setContracts(cts)
      setCompanies(cps)
      setAreas(ars)
      setUsersList(uss)
    } catch (err) {
      console.warn('Error loading auxiliary data:', err)
    }
  }

  const loadProjects = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      // 1. Check local offline projects first
      const localOffline = await offlineStorage.getAllProjects()

      if (navigator.onLine && pb.authStore.isValid) {
        const records = await pb.collection('projects').getFullList({
          sort: '-created',
          expand: 'client,contract,company,area,assigned_users,deleted_by',
        })

        if (records.length > 0) {
          const mapped: ProjectItem[] = records.map((rec) => {
            const expClient = rec.expand?.client as Client | undefined
            const expContract = rec.expand?.contract as Contract | undefined
            const expAssigned = rec.expand?.assigned_users as EpaUser[] | undefined
            const expDeletedBy = rec.expand?.deleted_by as EpaUser | undefined
            const assignedIds: string[] = Array.isArray(rec.assigned_users)
              ? rec.assigned_users
              : rec.assigned_users
                ? [rec.assigned_users]
                : []

            const teamNames =
              expAssigned && expAssigned.length > 0
                ? expAssigned.map((u) => u.name)
                : ['Annik Almeida', 'Carlos Oliveira', 'Marina Santos']

            return {
              id: rec.id,
              name: rec.name,
              client: expClient?.name || 'Cliente EPA',
              code: rec.epa_code || 'EPA-001',
              location: rec.location || 'Área Operacional',
              status: (rec.status as 'active' | 'paused' | 'completed') || 'active',
              progress: rec.progress ?? 0,
              contract: expContract?.code || 'CT-2025',
              team: teamNames,
              rawClient: rec.client,
              rawContract: rec.contract,
              rawCompany: rec.company,
              rawArea: rec.area,
              assignedUsersIds: assignedIds,
              archived: Boolean(rec.archived),
              deleted: Boolean(rec.deleted),
              deletedReason: rec.deleted_reason || undefined,
              deletedBy: rec.deleted_by || undefined,
              deletedByName: expDeletedBy?.name || undefined,
              deletedAt: rec.deleted_at || undefined,
            }
          })

          // Save server copy in local storage for offline use
          for (const m of mapped) {
            const existingLocal = localOffline.find((l) => l.id === m.id)
            if (!existingLocal || existingLocal.syncStatus === 'synced') {
              await offlineStorage.saveProject({
                ...m,
                syncStatus: 'synced',
                lastModified: Date.now(),
              })
            }
          }

          // Combine with any pending local creates
          const pendingCreates = localOffline
            .filter((l) => l.syncStatus === 'pending_create')
            .map((l) => ({
              id: l.id,
              name: l.name,
              client: l.client,
              code: l.code,
              location: l.location,
              status: l.status,
              progress: l.progress,
              contract: l.contract,
              team: l.team,
              rawClient: l.rawClient,
              rawContract: l.rawContract,
              rawCompany: l.rawCompany,
              rawArea: l.rawArea,
              assignedUsersIds: l.assignedUsersIds,
              archived: l.archived,
              deleted: l.deleted,
              deletedReason: l.deletedReason,
              deletedBy: l.deletedBy,
              deletedByName: l.deletedByName,
              deletedAt: l.deletedAt,
            }))

          const combined = [...pendingCreates, ...mapped]
          setProjectsList(combined)
          setLoading(false)
          return
        }
      }

      // If offline or no server records, use local IndexedDB
      if (localOffline.length > 0) {
        setProjectsList(
          localOffline.map((l) => ({
            id: l.id,
            name: l.name,
            client: l.client,
            code: l.code,
            location: l.location,
            status: l.status,
            progress: l.progress,
            contract: l.contract,
            team: l.team,
            rawClient: l.rawClient,
            rawContract: l.rawContract,
            rawCompany: l.rawCompany,
            rawArea: l.rawArea,
            assignedUsersIds: l.assignedUsersIds,
            archived: l.archived,
            deleted: l.deleted,
            deletedReason: l.deletedReason,
            deletedBy: l.deletedBy,
            deletedByName: l.deletedByName,
            deletedAt: l.deletedAt,
          })),
        )
        setLoading(false)
        return
      }

      // Fallback to static mock projects
      setProjectsList(
        staticProjects.map((p) => ({
          ...p,
          assignedUsersIds: ['mb059ge3zci2tzr', 'cfpekk93zx4j1pr', '2n6he1v3guzt3yt'],
          archived: false,
        })),
      )
    } catch (err) {
      console.warn('Projects fallback to static data:', err)
      setProjectsList(
        staticProjects.map((p) => ({
          ...p,
          assignedUsersIds: ['mb059ge3zci2tzr', 'cfpekk93zx4j1pr', '2n6he1v3guzt3yt'],
          archived: false,
        })),
      )
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadProjects()
    loadAuxiliaryData()

    const handleSyncComplete = () => {
      loadProjects({ silent: true })
    }

    const handleRealtimeUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<RealtimeRecordUpdateDetail>
      const col = customEvent.detail?.collection
      if (col === 'projects' || col === 'clients' || col === 'contracts') {
        loadProjects({ silent: true })
      }
    }

    window.addEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(SYNC_BROADCAST_EVENT, handleSyncComplete)
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    }
  }, [])

  const openNewProjectModal = () => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Apenas Administradores podem criar novos projetos.',
        variant: 'destructive',
      })
      return
    }

    setEditingProject(null)
    setFormName('')
    setFormEpaCode(`EPA-${String(Math.floor(100 + Math.random() * 900))}`)
    setFormClientId(clients[0]?.id || '')
    setFormContractId(contracts[0]?.id || '')
    setFormCompanyId(companies[0]?.id || '')
    setFormAreaId(areas[0]?.id || '')
    setFormLocation('Área Industrial')
    setFormProgress(0)
    setFormStatus('active')
    // By default, assign all current users or at least current admin
    setFormAssignedUsers(
      usersList.length > 0 ? usersList.map((u) => u.id) : user?.id ? [user.id] : [],
    )
    setModalOpen(true)
  }

  const openEditProjectModal = (p: ProjectItem) => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Apenas Administradores podem editar projetos.',
        variant: 'destructive',
      })
      return
    }

    setEditingProject(p)
    setFormName(p.name)
    setFormEpaCode(p.code)
    setFormClientId(p.rawClient || clients[0]?.id || '')
    setFormContractId(p.rawContract || contracts[0]?.id || '')
    setFormCompanyId(p.rawCompany || companies[0]?.id || '')
    setFormAreaId(p.rawArea || areas[0]?.id || '')
    setFormLocation(p.location)
    setFormProgress(p.progress)
    setFormStatus(p.status)
    setFormAssignedUsers(p.assignedUsersIds || [])
    setModalOpen(true)
  }

  const handleToggleAssignedUser = (userId: string) => {
    setFormAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleCreateQuickClient = async () => {
    if (!quickClientName.trim()) return
    try {
      const created = await pb.collection('clients').create<Client>({
        name: quickClientName.trim(),
        contact: 'Contato Direto',
      })
      setClients((prev) => [...prev, created])
      setFormClientId(created.id)
      setQuickClientName('')
      setShowQuickClient(false)
      toast({ title: 'Cliente adicionado com sucesso!' })
    } catch {
      toast({ title: 'Erro ao criar cliente rápido', variant: 'destructive' })
    }
  }

  const handleCreateQuickContract = async () => {
    if (!quickContractCode.trim()) return
    if (!formClientId) {
      toast({ title: 'Selecione um cliente antes de criar o contrato', variant: 'destructive' })
      return
    }
    try {
      const created = await pb.collection('contracts').create<Contract>({
        code: quickContractCode.trim(),
        client: formClientId,
        company: formCompanyId || companies[0]?.id || undefined,
        status: 'active',
      })
      setContracts((prev) => [...prev, created])
      setFormContractId(created.id)
      setQuickContractCode('')
      setShowQuickContract(false)
      toast({ title: 'Contrato adicionado com sucesso!' })
    } catch {
      toast({ title: 'Erro ao criar contrato rápido', variant: 'destructive' })
    }
  }

  const confirmDeleteProject = async () => {
    if (!deleteModalProject) return
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta ação.',
        variant: 'destructive',
      })
      setDeleteModalProject(null)
      setDeleteReason('')
      return
    }

    const trimmedReason = deleteReason.trim()
    if (!isValidDeletionJustification(trimmedReason)) {
      toast({
        title: 'Justificativa inválida',
        description: INVALID_JUSTIFICATION_MESSAGE,
        variant: 'destructive',
      })
      return
    }

    const p = deleteModalProject
    const nowIso = new Date().toISOString()
    setIsDeleting(true)
    try {
      if (navigator.onLine && pb.authStore.isValid) {
        try {
          await pb.collection('projects').update(p.id, {
            deleted: true,
            deleted_reason: trimmedReason,
            deleted_by: user?.id || null,
            deleted_at: nowIso,
          })
        } catch (pbErr: any) {
          console.error('Backend soft delete project error:', pbErr)
          const reason =
            pbErr?.data?.message ||
            pbErr?.message ||
            'Erro de permissão ou falha de comunicação com o servidor ao excluir o projeto.'
          throw new Error(reason)
        }
      }
      // Limpeza offline (IndexedDB) de RDOs e Planilhas associados ao projeto para não manter órfãos locais
      try {
        await Promise.all([
          offlineStorage.deleteRdosByProject(p.id),
          offlineStorage.deleteFieldSheetsByProject(p.id),
        ])
      } catch (storageErr) {
        console.warn('Erro ao limpar cache offline do projeto:', storageErr)
      }

      const updatedProject: ProjectItem = {
        ...p,
        deleted: true,
        deletedReason: trimmedReason,
        deletedBy: user?.id,
        deletedByName: user?.name,
        deletedAt: nowIso,
      }

      setProjectsList((prev) => prev.map((item) => (item.id === p.id ? updatedProject : item)))
      if (selected?.id === p.id) {
        setSelected(updatedProject)
      }
      toast({
        title: 'Projeto excluído com sucesso',
        description: `O projeto "${p.name}" foi movido para os itens excluídos com justificativa registrada.`,
      })
      setDeleteModalProject(null)
      setDeleteReason('')
    } catch (err: any) {
      console.error('Delete project error:', err)
      toast({
        title: 'Não foi possível excluir o projeto',
        description:
          err.message ||
          'Falha ao registrar a exclusão. O modal permanece aberto para nova tentativa.',
        variant: 'destructive',
      })
      // Mantém o modal aberto e não limpa deleteReason para o Admin tentar novamente
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleArchiveProject = async (p: ProjectItem) => {
    if (user?.role !== 'admin') {
      toast({
        title: 'Ação não autorizada',
        description: 'Apenas administradores podem arquivar projetos.',
        variant: 'destructive',
      })
      return
    }

    const nextArchived = !p.archived
    setActionLoadingId(p.id)
    try {
      if (navigator.onLine && pb.authStore.isValid) {
        await pb.collection('projects').update(p.id, {
          archived: nextArchived,
        })
      }
      setProjectsList((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, archived: nextArchived } : item)),
      )
      if (selected?.id === p.id) {
        setSelected({ ...selected, archived: nextArchived })
      }
      toast({
        title: nextArchived ? 'Projeto arquivado' : 'Projeto desarquivado',
        description: nextArchived
          ? `O projeto "${p.name}" foi movido para os arquivados.`
          : `O projeto "${p.name}" foi restaurado para a listagem ativa.`,
      })
    } catch (err: any) {
      console.error('Error toggling archive:', err)
      toast({
        title: 'Erro ao alterar estado de arquivamento',
        description: err.message || 'Verifique suas permissões.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAdmin) {
      toast({
        title: 'Ação não autorizada',
        description: 'Somente administradores podem salvar projetos.',
        variant: 'destructive',
      })
      return
    }

    if (!formName.trim() || !formEpaCode.trim()) {
      toast({
        title: 'Preencha os campos obrigatórios',
        description: 'Nome e Código EPA do projeto são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    // Ensure we have a client and contract (or create fallback if empty)
    let finalClientId = formClientId
    let finalContractId = formContractId
    let finalCompanyId = formCompanyId
    let finalAreaId = formAreaId

    setSubmitting(true)

    try {
      if (navigator.onLine && pb.authStore.isValid) {
        // Fallback creations if none exist
        if (!finalClientId && clients.length === 0) {
          const autoClient = await pb.collection('clients').create<Client>({
            name: 'Cliente Geral EPA',
          })
          finalClientId = autoClient.id
          setClients([autoClient])
        } else if (!finalClientId && clients.length > 0) {
          finalClientId = clients[0].id
        }

        if (!finalContractId && contracts.length === 0) {
          const autoContract = await pb.collection('contracts').create<Contract>({
            code: `CT-${new Date().getFullYear()}-001`,
            client: finalClientId,
            status: 'active',
          })
          finalContractId = autoContract.id
          setContracts([autoContract])
        } else if (!finalContractId && contracts.length > 0) {
          finalContractId = contracts[0].id
        }

        if (!finalCompanyId && companies.length > 0) {
          finalCompanyId = companies[0].id
        }
        if (!finalAreaId && areas.length > 0) {
          finalAreaId = areas[0].id
        }

        // Assigned users: ensure at least admin is assigned if empty
        let assigned = formAssignedUsers
        if (assigned.length === 0 && user?.id) {
          assigned = [user.id]
        }

        const payload: Record<string, any> = {
          name: formName.trim(),
          epa_code: formEpaCode.trim(),
          client: finalClientId,
          contract: finalContractId,
          location: formLocation.trim() || 'Área Operacional',
          progress: Number(formProgress) || 0,
          status: formStatus,
          assigned_users: assigned,
        }

        if (finalCompanyId) payload.company = finalCompanyId
        if (finalAreaId) payload.area = finalAreaId

        if (editingProject) {
          // Update
          const updated = await pb.collection('projects').update(editingProject.id, payload, {
            expand: 'client,contract,company,area,assigned_users',
          })

          toast({
            title: 'Projeto atualizado com sucesso!',
            description: `As alterações em "${updated.name}" foram salvas.`,
          })
        } else {
          // Create
          const created = await pb.collection('projects').create(payload, {
            expand: 'client,contract,company,area,assigned_users',
          })

          toast({
            title: 'Projeto criado com sucesso!',
            description: `O projeto "${created.name}" já está disponível na grade.`,
          })
        }

        await loadProjects()
        setModalOpen(false)
      } else {
        // Offline persistence in IndexedDB with pending queue
        const clientObj = clients.find((c) => c.id === formClientId)
        const contractObj = contracts.find((c) => c.id === formContractId)

        const offlineItem: OfflineProjectItem = {
          id: editingProject ? editingProject.id : 'proj_' + Date.now(),
          name: formName.trim(),
          client: clientObj?.name || 'Cliente EPA',
          code: formEpaCode.trim(),
          location: formLocation.trim() || 'Área Operacional',
          status: formStatus,
          progress: Number(formProgress) || 0,
          contract: contractObj?.code || 'CT-2025',
          team: ['Annik Almeida', 'Carlos Oliveira'],
          rawClient: formClientId,
          rawContract: formContractId,
          rawCompany: formCompanyId,
          rawArea: formAreaId,
          assignedUsersIds: formAssignedUsers,
          syncStatus: editingProject ? 'pending_update' : 'pending_create',
          lastModified: Date.now(),
        }

        await offlineStorage.saveProject(offlineItem)

        if (editingProject) {
          setProjectsList((prev) =>
            prev.map((item) => (item.id === editingProject.id ? offlineItem : item)),
          )
          toast({
            title: 'Projeto salvo localmente (offline)',
            description:
              'As alterações serão sincronizadas com o servidor assim que a conexão retornar.',
          })
        } else {
          setProjectsList((prev) => [offlineItem, ...prev])
          toast({
            title: 'Projeto criado localmente (offline)',
            description: 'Será enviado ao servidor PocketBase na próxima sincronização.',
          })
        }
        setModalOpen(false)
      }
    } catch (err: any) {
      console.error('Error saving project:', err)
      toast({
        title: 'Erro ao salvar projeto',
        description:
          err.data?.message ||
          err.message ||
          'Verifique se o código EPA já está cadastrado ou se há campos inválidos.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = projectsList.filter((p) => !p.deleted && !p.archived).length
  const archivedCount = projectsList.filter((p) => !p.deleted && Boolean(p.archived)).length
  const deletedCount = projectsList.filter((p) => Boolean(p.deleted)).length

  const filtered = projectsList.filter((p) => {
    let matchesTab = false
    if (tabFilter === 'deleted') {
      matchesTab = Boolean(p.deleted)
    } else if (tabFilter === 'archived') {
      matchesTab = !p.deleted && Boolean(p.archived)
    } else {
      matchesTab = !p.deleted && !p.archived
    }

    const matchesSearch = `${p.name} ${p.client} ${p.code} ${p.location} ${p.deletedReason || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
    const matchesStatus =
      tabFilter === 'deleted' ? true : statusFilter === 'all' || p.status === statusFilter
    return matchesTab && matchesSearch && matchesStatus
  })

  const deleteModalJSX = deleteModalProject && (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto">
        <div className="flex items-center gap-3 text-red-600">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 dark:bg-red-950/50">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Excluir Projeto {deleteModalProject.code}
            </h3>
            <p className="text-xs text-slate-500">Exclusão com método de segurança e auditoria</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Você está prestes a excluir o projeto{' '}
          <b className="text-slate-900 dark:text-white">
            "{deleteModalProject.name}" ({deleteModalProject.code})
          </b>
          .
        </p>

        <div className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
          🛡️ <b>Registro e Arquivamento:</b> O projeto não desaparecerá do banco de dados. Ele será
          marcado como excluído logicamente e ficará arquivado na aba <b>"Excluídos"</b> (visível
          apenas para Administradores), preservando o histórico e dados vinculados para trilha de
          auditoria.
        </div>

        <div className="mt-4 space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Justificativa da Exclusão{' '}
            <span className="text-red-500">* (obrigatória e fundamentada)</span>
          </label>
          <textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Informe uma justificativa válida explicando o motivo da exclusão..."
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>
              {isValidDeletionJustification(deleteReason)
                ? '✓ Justificativa válida'
                : 'Informe uma justificativa real para a exclusão'}
            </span>
            <span>{deleteReason.length} caracteres</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={() => {
              setDeleteModalProject(null)
              setDeleteReason('')
            }}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={isDeleting}
            onClick={confirmDeleteProject}
            className="bg-red-600 hover:bg-red-700 text-white min-w-[130px] disabled:opacity-50"
          >
            {isDeleting ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Excluindo...
              </span>
            ) : (
              'Confirmar Exclusão'
            )}
          </Button>
        </div>
      </div>
    </div>
  )

  if (selected) {
    return (
      <>
        <ProjectDetail
          project={selected}
          onBack={() => {
            setSelected(null)
            loadProjects()
          }}
          onEdit={() => openEditProjectModal(selected)}
          onDelete={() => setDeleteModalProject(selected)}
          onToggleArchive={() => handleToggleArchiveProject(selected)}
          actionLoading={actionLoadingId === selected.id}
          onOpenRdo={onOpenRdo}
          onOpenField={onOpenField}
        />
        {deleteModalJSX}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            readOnly
            placeholder="Filtro de busca global..."
            className="bg-white pl-9 dark:bg-slate-950 dark:border-slate-800"
          />
        </div>

        {isAdmin && (
          <Button
            onClick={openNewProjectModal}
            className="w-full sm:w-fit bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px] shadow-sm font-semibold text-xs"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo projeto
          </Button>
        )}
      </div>

      {/* Abas Ativos vs Arquivados vs Excluídos */}
      <div className="flex items-center gap-2 border-b pb-2 dark:border-slate-800 flex-wrap">
        <button
          onClick={() => setTabFilter('active')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
            tabFilter === 'active'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
          )}
        >
          <Building2 className="h-4 w-4" />
          Projetos Ativos ({activeCount})
        </button>
        {user?.role !== 'technician' && (
          <button
            onClick={() => setTabFilter('archived')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
              tabFilter === 'archived'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
            )}
          >
            <Archive className="h-4 w-4" />
            Arquivados ({archivedCount})
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setTabFilter('deleted')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition',
              tabFilter === 'deleted'
                ? 'bg-red-700 text-white shadow-sm'
                : 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
            )}
          >
            <Trash2 className="h-4 w-4" />
            Excluídos ({deletedCount})
          </button>
        )}
      </div>

      {tabFilter === 'archived' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <b>Visualização de Arquivados:</b> Estes projetos estão arquivados para histórico.
              Você pode desarquivá-los a qualquer momento para retorná-los à listagem operacional.
            </span>
          </div>
        </div>
      )}

      {tabFilter === 'deleted' && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 shrink-0 text-red-600" />
            <span>
              <b>Itens Excluídos pelo Administrador:</b> Projetos excluídos logicamente permanecem
              preservados para auditoria junto à justificativa do responsável.
            </span>
          </div>
        </div>
      )}

      {/* Filter and stats row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <b className="text-slate-800 dark:text-slate-100">{filtered.length}</b> projeto(s){' '}
          {tabFilter === 'deleted'
            ? 'excluído(s)'
            : tabFilter === 'archived'
              ? 'arquivado(s)'
              : 'ativo(s)'}{' '}
          visíveis para seu perfil
        </p>
        <div className="flex rounded-lg border bg-white p-1 text-xs dark:bg-slate-900 dark:border-slate-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition',
              statusFilter === 'all'
                ? 'bg-slate-100 dark:bg-slate-800 font-semibold text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition',
              statusFilter === 'active'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Ativos
          </button>
          <button
            onClick={() => setStatusFilter('paused')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition',
              statusFilter === 'paused'
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Pausados
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={cn(
              'rounded-md px-3 py-1.5 font-medium transition',
              statusFilter === 'completed'
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold'
                : 'text-slate-500 hover:text-slate-900',
            )}
          >
            Concluídos
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm font-medium text-slate-500">Carregando projetos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="epa-card p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="mt-4 text-base font-semibold">Nenhum projeto encontrado</h3>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin
              ? 'Clique em "Novo projeto" acima para cadastrar a primeira obra.'
              : 'Não há projetos atribuídos ao seu usuário no momento.'}
          </p>
          {isAdmin && (
            <Button
              onClick={openNewProjectModal}
              className="mt-5 bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Novo Projeto Agora
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => (
            <div
              key={project.id}
              className="epa-card group relative overflow-hidden text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
            >
              <div
                className={cn(
                  'h-1.5 bg-gradient-to-r',
                  project.status === 'active'
                    ? 'from-emerald-700 to-teal-400'
                    : project.status === 'paused'
                      ? 'from-amber-500 to-orange-400'
                      : 'from-blue-600 to-indigo-400',
                )}
              />
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-semibold',
                        project.status === 'active'
                          ? 'active-glow bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : project.status === 'paused'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                      )}
                    >
                      {project.status === 'active'
                        ? '● Ativo'
                        : project.status === 'paused'
                          ? 'Ⅱ Pausado'
                          : '✓ Concluído'}
                    </span>
                    {isAdmin && !project.deleted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleArchiveProject(project)
                        }}
                        disabled={actionLoadingId === project.id}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                        title={project.archived ? 'Desarquivar projeto' : 'Arquivar projeto'}
                      >
                        {actionLoadingId === project.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : project.archived ? (
                          <ArchiveRestore className="h-3.5 w-3.5 text-amber-600" />
                        ) : (
                          <Archive className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {isAdmin && !project.deleted && (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditProjectModal(project)
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                          title="Editar projeto"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteModalProject(project)
                          }}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                          title="Excluir projeto (apenas Admin com justificativa)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {project.deleted && (
                      <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Excluído
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-4 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  {project.code}
                </p>
                <h3 className="mt-1 min-h-12 text-base font-semibold leading-6 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                  {project.name}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{project.client}</p>

                <div className="mt-4 flex items-center gap-2 border-t pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{project.location}</span>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-slate-500">Progresso geral</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        project.status === 'paused'
                          ? 'bg-amber-500'
                          : project.status === 'completed'
                            ? 'bg-blue-600'
                            : 'bg-emerald-600',
                      )}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-2 border-t dark:border-slate-800">
                  <div className="flex -space-x-2">
                    {project.team.slice(0, 3).map((member) => (
                      <span
                        key={member}
                        title={member}
                        className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-[9px] font-bold text-slate-600 dark:border-slate-900 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {member
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)}
                      </span>
                    ))}
                    {project.team.length > 3 && (
                      <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-emerald-100 text-[9px] font-bold text-emerald-800 dark:border-slate-900 dark:bg-emerald-950 dark:text-emerald-300">
                        +{project.team.length - 3}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(project)}
                    className={cn(
                      'text-xs font-semibold',
                      project.deleted
                        ? 'text-red-700 hover:bg-red-50 dark:text-red-400'
                        : project.archived
                          ? 'text-amber-700 hover:bg-amber-50 dark:text-amber-400'
                          : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-400 dark:hover:bg-slate-800',
                    )}
                  >
                    {project.deleted
                      ? 'Ver arquivado (Excluído)'
                      : project.archived
                        ? 'Ver arquivado'
                        : 'Abrir projeto'}
                    <ArrowRight className="ml-1 h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRIAR / EDITAR PROJETO */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto sm:my-8">
            <div className="flex items-center justify-between border-b pb-4 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {editingProject ? 'Editar Projeto / Obra' : 'Novo Projeto / Obra EPA'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Preencha os dados cadastrais, cliente, contrato e equipe atribuída.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmitProject} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="epa-label">Nome do Projeto / Obra *</label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex.: Recuperação Ambiental Lote A"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="epa-label">Código EPA *</label>
                  <Input
                    value={formEpaCode}
                    onChange={(e) => setFormEpaCode(e.target.value)}
                    placeholder="Ex.: EPA-RSL-A01"
                    required
                    className="mt-1 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="epa-label">Localização da Obra *</label>
                  <Input
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Ex.: Refinaria Sul — Área Industrial"
                    required
                    className="mt-1"
                  />
                </div>

                {/* Cliente */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="epa-label">Cliente *</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickClient(!showQuickClient)}
                      className="text-[10px] text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      + Novo cliente
                    </button>
                  </div>
                  {showQuickClient ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={quickClientName}
                        onChange={(e) => setQuickClientName(e.target.value)}
                        placeholder="Nome do cliente..."
                        className="h-9 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateQuickClient}
                        className="h-9 bg-emerald-700 text-white text-xs"
                      >
                        Salvar
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={formClientId}
                      onChange={(e) => setFormClientId(e.target.value)}
                      className="epa-input mt-1"
                      required
                    >
                      <option value="">Selecione um cliente</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Contrato */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="epa-label">Contrato *</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickContract(!showQuickContract)}
                      className="text-[10px] text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      + Novo contrato
                    </button>
                  </div>
                  {showQuickContract ? (
                    <div className="mt-1 flex gap-2">
                      <Input
                        value={quickContractCode}
                        onChange={(e) => setQuickContractCode(e.target.value)}
                        placeholder="Ex.: CT-EPA-2025-018"
                        className="h-9 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateQuickContract}
                        className="h-9 bg-emerald-700 text-white text-xs"
                      >
                        Salvar
                      </Button>
                    </div>
                  ) : (
                    <select
                      value={formContractId}
                      onChange={(e) => setFormContractId(e.target.value)}
                      className="epa-input mt-1"
                      required
                    >
                      <option value="">Selecione um contrato</option>
                      {contracts.map((ct) => (
                        <option key={ct.id} value={ct.id}>
                          {ct.code}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Empresa Executora */}
                <div>
                  <label className="epa-label">Empresa Executora</label>
                  <select
                    value={formCompanyId}
                    onChange={(e) => setFormCompanyId(e.target.value)}
                    className="epa-input mt-1"
                  >
                    <option value="">Selecione a empresa</option>
                    {companies.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Área Operacional */}
                <div>
                  <label className="epa-label">Área Operacional</label>
                  <select
                    value={formAreaId}
                    onChange={(e) => setFormAreaId(e.target.value)}
                    className="epa-input mt-1"
                  >
                    <option value="">Selecione a área</option>
                    {areas.map((ar) => (
                      <option key={ar.id} value={ar.id}>
                        {ar.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="epa-label">Status do Projeto *</label>
                  <select
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as 'active' | 'paused' | 'completed')
                    }
                    className="epa-input mt-1"
                  >
                    <option value="active">Ativo (Em operação)</option>
                    <option value="paused">Pausado (Aguardando)</option>
                    <option value="completed">Concluído (Finalizado)</option>
                  </select>
                </div>

                {/* Progresso */}
                <div>
                  <label className="epa-label">Progresso Concluído (%)</label>
                  <div className="flex items-center gap-3 mt-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={formProgress}
                      onChange={(e) => setFormProgress(Number(e.target.value))}
                      className="w-24 font-mono"
                    />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={formProgress}
                      onChange={(e) => setFormProgress(Number(e.target.value))}
                      className="flex-1 accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Equipe atribuída (RBAC) */}
              <div className="rounded-xl border p-4 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="epa-label text-slate-800 dark:text-slate-200">
                      Equipe Atribuída ao Projeto (Controle de Acesso)
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Usuários selecionados terão acesso para emitir RDOs e Planilhas nesta obra.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {formAssignedUsers.length} selecionado(s)
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pt-2">
                  {usersList.length === 0 ? (
                    <p className="text-xs text-slate-400 col-span-2">Nenhum usuário cadastrado.</p>
                  ) : (
                    usersList.map((u) => {
                      const isAssigned = formAssignedUsers.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => handleToggleAssignedUser(u.id)}
                          className={cn(
                            'flex items-center justify-between rounded-lg border p-2.5 text-left text-xs transition',
                            isAssigned
                              ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium dark:bg-emerald-950/40 dark:text-emerald-200'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/50',
                          )}
                        >
                          <div>
                            <p className="font-semibold">{u.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              {u.role === 'admin'
                                ? 'Administrador'
                                : u.role === 'technician'
                                  ? 'Técnico'
                                  : 'Operador'}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'grid h-5 w-5 place-items-center rounded border',
                              isAssigned
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800',
                            )}
                          >
                            {isAssigned && <Check className="h-3 w-3" />}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px]"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando projeto...
                    </span>
                  ) : editingProject ? (
                    'Salvar Alterações'
                  ) : (
                    'Criar Projeto'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModalJSX}
    </div>
  )
}

function ProjectDetail({
  project,
  onBack,
  onEdit,
  onDelete,
  onToggleArchive,
  actionLoading,
  onOpenRdo,
  onOpenField,
}: {
  project: ProjectItem
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleArchive: () => void
  actionLoading: boolean
  onOpenRdo: () => void
  onOpenField: () => void
}) {
  const { user } = useAuth()
  const role = user?.role
  const isOperator = role === 'operator'
  const isTechnician = role === 'technician'
  const isAdmin = role === 'admin'

  const [projectRdos, setProjectRdos] = useState<any[]>([])
  const [projectSheets, setProjectSheets] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true)
      try {
        if (navigator.onLine && pb.authStore.isValid) {
          const [rdosRec, sheetsRec] = await Promise.all([
            pb.collection('reports_rdo').getFullList({
              filter: `project = "${project.id}"`,
              sort: '-report_date',
            }),
            pb.collection('field_spreadsheets').getFullList({
              filter: `project = "${project.id}"`,
              sort: '-date',
            }),
          ])
          setProjectRdos(
            rdosRec.map((r) => ({
              id: r.id,
              title: `RDO #${String(r.number).padStart(3, '0')} · ${r.activity_title || 'Sem título'}`,
              date: r.report_date ? r.report_date.slice(0, 10) : 'Hoje',
              status: r.status,
              type: 'RDO',
            })),
          )
          setProjectSheets(
            sheetsRec.map((s) => ({
              id: s.id,
              title: `Planilha de Campo · ${s.area || 'Área'}`,
              date: s.date ? s.date.slice(0, 10) : 'Hoje',
              status: s.status,
              type: 'Campo',
            })),
          )
        } else {
          // Static fallback
          const mRdos = staticRdos.filter((r) => r.projectId === project.id)
          const mSheets = staticFieldSheets.filter((s) => s.projectId === project.id)
          setProjectRdos(
            mRdos.map((r) => ({
              id: r.id,
              title: `RDO #${String(r.number).padStart(3, '0')} · ${r.activity}`,
              date: r.date,
              status: r.status,
              type: 'RDO',
            })),
          )
          setProjectSheets(
            mSheets.map((s) => ({
              id: s.id,
              title: `Planilha de Campo · ${s.area}`,
              date: s.date,
              status: s.status,
              type: 'Campo',
            })),
          )
        }
      } catch (err) {
        console.warn('Project detail history error:', err)
      } finally {
        setLoadingHistory(false)
      }
    }
    fetchHistory()
  }, [project.id])

  const historyItems = [
    ...(isAdmin || isTechnician || isOperator ? projectRdos : []),
    ...(isAdmin || isTechnician || isOperator ? projectSheets : []),
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos projetos
        </button>

        <div className="flex items-center gap-2">
          {isAdmin && !project.deleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleArchive}
              disabled={actionLoading}
              className="text-xs min-h-[38px] dark:border-slate-800"
            >
              {actionLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : project.archived ? (
                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
              ) : (
                <Archive className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
              )}
              {project.archived ? 'Desarquivar Projeto' : 'Arquivar Projeto'}
            </Button>
          )}

          {isAdmin && !project.deleted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="text-xs min-h-[38px] dark:border-slate-800"
              >
                <Edit2 className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
                Editar Projeto
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 min-h-[38px]"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Excluir
              </Button>
            </>
          )}
        </div>
      </div>

      {project.deleted && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 dark:border-red-800 dark:bg-red-950/40 space-y-2">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-red-900 dark:text-red-200 text-sm">
                Projeto Excluído pelo Administrador
              </p>
              <p className="text-xs text-red-700 dark:text-red-300">
                Excluído em:{' '}
                {project.deletedAt
                  ? new Date(project.deletedAt).toLocaleString('pt-BR')
                  : 'Data registrada no servidor'}{' '}
                {project.deletedByName ? `· por ${project.deletedByName}` : ''}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white/80 p-3.5 text-xs text-slate-800 dark:bg-slate-900/80 dark:text-slate-200 border border-red-200 dark:border-red-900">
            <span className="font-semibold text-red-800 dark:text-red-300">
              Justificativa registrada:{' '}
            </span>
            <span className="italic">
              {project.deletedReason || '(Sem justificativa fornecida)'}
            </span>
          </div>
        </div>
      )}

      {project.archived && !project.deleted && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                Projeto Arquivado
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Este projeto está em modo de leitura nos arquivos. Você pode desarquivá-lo para
                reativar operações normais.
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              size="sm"
              onClick={onToggleArchive}
              disabled={actionLoading}
              className="bg-amber-700 hover:bg-amber-800 text-white text-xs"
            >
              {actionLoading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <ArchiveRestore className="h-3.5 w-3.5 mr-1" />
              )}
              Desarquivar
            </Button>
          )}
        </div>
      )}

      <section className="epa-card overflow-hidden">
        <div className="bg-gradient-to-br from-[#044741] to-[#086B63] p-6 text-white md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-[10px]">
                  {project.code}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[10px]',
                    project.status === 'active'
                      ? 'bg-emerald-400/20 text-emerald-100'
                      : project.status === 'paused'
                        ? 'bg-amber-400/20 text-amber-100'
                        : 'bg-blue-400/20 text-blue-100',
                  )}
                >
                  ●{' '}
                  {project.status === 'active'
                    ? 'Projeto ativo'
                    : project.status === 'paused'
                      ? 'Pausado'
                      : 'Concluído'}
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
        {(isAdmin || isTechnician || isOperator) && (
          <MiniStat
            label="RDOs emitidos"
            value={String(projectRdos.length)}
            helper="relatórios cadastrados"
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
            value={String(projectSheets.length)}
            helper="medições registradas"
            icon={FileSpreadsheet}
          />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
        <section className="epa-card overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 dark:border-slate-800">
            <div>
              <h3 className="font-semibold text-sm">Histórico operacional</h3>
              <p className="text-xs text-slate-500">RDOs e planilhas vinculados a esta obra</p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
          <div className="divide-y dark:divide-slate-800">
            {loadingHistory ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-emerald-600 mb-2" />
                Carregando histórico...
              </div>
            ) : historyItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum histórico operacional cadastrado para esta obra ainda.
              </div>
            ) : (
              historyItems.map((item) => (
                <button
                  key={item.id}
                  onClick={item.type === 'RDO' ? onOpenRdo : onOpenField}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
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
          <h3 className="font-semibold text-sm">Equipe atribuída</h3>
          <p className="mt-1 text-xs text-slate-500">Acesso restrito a este projeto (RBAC)</p>
          <div className="mt-5 space-y-4">
            {project.team.map((member, index) => (
              <div key={member} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-[10px] font-bold dark:bg-slate-800 dark:text-slate-300">
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
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
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
