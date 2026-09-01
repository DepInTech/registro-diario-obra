import { useState, useEffect } from 'react'
import {
  Check,
  Edit2,
  Mail,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  X,
  Loader2,
  Lock,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { users as staticUsers, type Role } from '@/data/epa'

interface UserItem {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  lastAccess?: string
}

export function UsersPage() {
  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('operator')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { user: currentUser } = useAuth()
  const { toast } = useToast()

  const isAdmin = currentUser?.role === 'admin'

  const loadUsers = async () => {
    setLoading(true)
    try {
      if (navigator.onLine && pb.authStore.isValid) {
        const records = await pb.collection('users').getFullList({ sort: '-created' })
        setUsersList(
          records.map((r) => ({
            id: r.id,
            name: r.name,
            email: r.email,
            role: (r.role as Role) || 'operator',
            active: r.active !== false,
            lastAccess: r.updated ? new Date(r.updated).toLocaleDateString('pt-BR') : 'Hoje',
          })),
        )
      } else {
        setUsersList(
          staticUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            active: u.active,
            lastAccess: 'Hoje',
          })),
        )
      }
    } catch (err) {
      console.warn('Load users fallback:', err)
      setUsersList(
        staticUsers.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          lastAccess: 'Hoje',
        })),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const openNewModal = () => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        description: 'Apenas Administradores podem cadastrar novos usuários.',
        variant: 'destructive',
      })
      return
    }
    setEditingUser(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole('operator')
    setActive(true)
    setModalOpen(true)
  }

  const openEditModal = (u: UserItem) => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        description: 'Apenas Administradores podem editar usuários.',
        variant: 'destructive',
      })
      return
    }
    setEditingUser(u)
    setName(u.name)
    setEmail(u.email)
    setPassword('')
    setRole(u.role)
    setActive(u.active)
    setModalOpen(true)
  }

  const handleToggleActive = async (u: UserItem) => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        variant: 'destructive',
      })
      return
    }
    if (u.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode desativar seu próprio usuário.',
        variant: 'destructive',
      })
      return
    }

    try {
      const nextActive = !u.active
      if (navigator.onLine && pb.authStore.isValid) {
        await pb.collection('users').update(u.id, { active: nextActive })
      }
      setUsersList((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, active: nextActive } : item)),
      )
      toast({
        title: nextActive ? 'Usuário ativado' : 'Usuário desativado',
        description: `O acesso de ${u.name} foi ${nextActive ? 'reativado' : 'suspenso'}.`,
      })
    } catch {
      toast({
        title: 'Erro ao alterar status',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteUser = async (u: UserItem) => {
    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        variant: 'destructive',
      })
      return
    }
    if (u.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode excluir sua própria conta.',
        variant: 'destructive',
      })
      return
    }

    if (!confirm(`Tem certeza que deseja excluir o usuário ${u.name}?`)) return

    try {
      if (navigator.onLine && pb.authStore.isValid) {
        await pb.collection('users').delete(u.id)
      }
      setUsersList((prev) => prev.filter((item) => item.id !== u.id))
      toast({
        title: 'Usuário excluído',
        description: `O cadastro de ${u.name} foi removido com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao excluir usuário',
        variant: 'destructive',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }
    setSubmitting(true)

    try {
      if (editingUser) {
        // Edit existing
        const payload: Record<string, any> = {
          name: name.trim(),
          email: email.trim(),
          role,
          active,
        }
        if (password) {
          payload.password = password
          payload.passwordConfirm = password
        }
        if (navigator.onLine && pb.authStore.isValid) {
          await pb.collection('users').update(editingUser.id, payload)
        }
        setUsersList((prev) =>
          prev.map((item) =>
            item.id === editingUser.id
              ? { ...item, name: name.trim(), email: email.trim(), role, active }
              : item,
          ),
        )
        toast({ title: 'Usuário atualizado com sucesso' })
      } else {
        // Create new
        const payload: Record<string, any> = {
          name: name.trim(),
          email: email.trim(),
          password: password || 'Skip@Pass',
          passwordConfirm: password || 'Skip@Pass',
          role,
          active,
        }
        let newId = 'user_' + Date.now()
        if (navigator.onLine && pb.authStore.isValid) {
          const rec = await pb.collection('users').create(payload)
          newId = rec.id
        }
        setUsersList((prev) => [
          {
            id: newId,
            name: name.trim(),
            email: email.trim(),
            role,
            active,
            lastAccess: 'Hoje',
          },
          ...prev,
        ])
        toast({ title: 'Novo usuário criado com sucesso' })
      }
      setModalOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar usuário',
        description: err.message || 'Verifique se o e-mail já existe.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const roleBadge = (r: Role) => {
    if (r === 'admin') {
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Administrador
        </span>
      )
    }
    if (r === 'technician') {
      return (
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Técnico
        </span>
      )
    }
    return (
      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">
        Operador
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestão de Usuários & Acessos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle de permissões (Administrador, Técnico e Operador)
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={openNewModal}
            className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        )}
      </div>

      <section className="epa-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-slate-500">Carregando usuários...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[.1em] text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Usuário / Nome</th>
                  <th className="px-5 py-3.5">E-mail</th>
                  <th className="px-5 py-3.5">Perfil (Role)</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Último Acesso</th>
                  {isAdmin && <th className="px-5 py-3.5 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-800">
                {usersList.map((u) => {
                  const initials = u.name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border border-emerald-100 dark:border-emerald-900">
                            <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">{u.name}</p>
                            {u.id === currentUser?.id && (
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                (Você)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {u.email}
                      </td>
                      <td className="px-5 py-4">{roleBadge(u.role)}</td>
                      <td className="px-5 py-4">
                        {u.active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">{u.lastAccess}</td>
                      {isAdmin && (
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(u)}
                              className="h-8 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar usuário"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(u)}
                              disabled={u.id === currentUser?.id}
                              className={`h-8 text-xs ${u.active ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
                            >
                              {u.active ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(u)}
                              disabled={u.id === currentUser?.id}
                              className="h-8 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                              title="Excluir usuário"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Criar / Editar Usuário */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <h3 className="font-semibold text-base">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário EPA'}
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="epa-label">Nome Completo *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Bruno Santana"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="epa-label">E-mail *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@grupoepa.com.br"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="epa-label">
                  {editingUser ? 'Nova Senha (opcional)' : 'Senha de Acesso *'}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? 'Deixe em branco para manter' : 'Skip@Pass'}
                  className="mt-1"
                />
              </div>

              <div>
                <label className="epa-label">Perfil de Acesso (RBAC) *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="epa-input"
                >
                  <option value="operator">Operador (Preenchimento RDO e Planilha)</option>
                  <option value="technician">Técnico (Supervisão e RDO)</option>
                  <option value="admin">Administrador (Total + PDF/Excel + Usuários)</option>
                </select>
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold">Conta Ativa</p>
                  <p className="text-[10px] text-slate-500">Permite autenticação no sistema</p>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600 rounded"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-2 border-t dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : (
                    'Salvar Usuário'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
