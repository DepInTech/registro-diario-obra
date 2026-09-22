import { useState, useEffect } from 'react'
import {
  Edit2,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  X,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
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

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<Role>('technician')
  const [active, setActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation dialog state
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Action status spinner per user
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

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
            name: r.name || 'Sem nome',
            email: r.email,
            role: (r.role as Role) || 'technician',
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
    setPasswordConfirm('')
    setShowPassword(false)
    setRole('technician')
    setActive(true)
    setFormError(null)
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
    setPasswordConfirm('')
    setShowPassword(false)
    setRole(u.role)
    setActive(u.active)
    setFormError(null)
    setModalOpen(true)
  }

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*'
    let pwd = ''
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setPassword(pwd)
    setPasswordConfirm(pwd)
    setShowPassword(true)
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

    setActionLoadingId(u.id)
    try {
      const nextActive = !u.active
      if (navigator.onLine && pb.authStore.isValid) {
        await pb.collection('users').update(u.id, { active: nextActive })
      }
      setUsersList((prev) =>
        prev.map((item) => (item.id === u.id ? { ...item, active: nextActive } : item)),
      )
      toast({
        title: nextActive ? 'Usuário ativado com sucesso' : 'Usuário desativado com sucesso',
        description: `O acesso de ${u.name} foi ${nextActive ? 'reativado' : 'suspenso'}.`,
      })
    } catch (err: any) {
      const parsed = getErrorMessage(err)
      toast({
        title: 'Erro ao alterar status',
        description: parsed || 'Não foi possível alterar a ativação do usuário.',
        variant: 'destructive',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    const u = deletingUser

    if (!isAdmin) {
      toast({
        title: 'Você não possui permissão para esta função',
        variant: 'destructive',
      })
      setDeletingUser(null)
      return
    }
    if (u.id === currentUser?.id) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não pode excluir sua própria conta.',
        variant: 'destructive',
      })
      setDeletingUser(null)
      return
    }

    setIsDeleting(true)
    try {
      if (navigator.onLine && pb.authStore.isValid) {
        await pb.collection('users').delete(u.id)
      }
      setUsersList((prev) => prev.filter((item) => item.id !== u.id))
      toast({
        title: 'Usuário excluído',
        description: `O cadastro de ${u.name} foi removido com sucesso.`,
      })
      setDeletingUser(null)
    } catch (err: any) {
      const parsed = getErrorMessage(err)
      toast({
        title: 'Erro ao excluir usuário',
        description: parsed || 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedEmail) {
      setFormError('Por favor, preencha o nome e o e-mail.')
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      setFormError('Formato de e-mail inválido. Utilize um e-mail corporativo ou válido.')
      return
    }

    // If creating, require at least 8 chars password
    if (!editingUser) {
      const effectivePassword = password || 'Skip@Pass123'
      if (effectivePassword.length < 8) {
        setFormError('A senha deve conter no mínimo 8 caracteres.')
        return
      }
      if (password && passwordConfirm && password !== passwordConfirm) {
        setFormError('As senhas não coincidem.')
        return
      }
    } else {
      // Editing
      if (password) {
        if (password.length < 8) {
          setFormError('A nova senha deve ter no mínimo 8 caracteres.')
          return
        }
        if (passwordConfirm && password !== passwordConfirm) {
          setFormError('As senhas digitadas não coincidem.')
          return
        }
      }
    }

    setSubmitting(true)

    try {
      if (editingUser) {
        // Edit existing
        const payload: Record<string, any> = {
          name: trimmedName,
          email: trimmedEmail,
          role,
          active,
        }
        if (password) {
          payload.password = password
          payload.passwordConfirm = passwordConfirm || password
        }
        if (navigator.onLine && pb.authStore.isValid) {
          await pb.collection('users').update(editingUser.id, payload)
        }
        setUsersList((prev) =>
          prev.map((item) =>
            item.id === editingUser.id
              ? { ...item, name: trimmedName, email: trimmedEmail, role, active }
              : item,
          ),
        )
        toast({
          title: 'Usuário atualizado com sucesso',
          description: `Os dados de ${trimmedName} foram salvos.`,
        })
      } else {
        // Create new
        const finalPassword = password || 'Skip@Pass123'
        const payload: Record<string, any> = {
          name: trimmedName,
          email: trimmedEmail,
          password: finalPassword,
          passwordConfirm: passwordConfirm || finalPassword,
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
            name: trimmedName,
            email: trimmedEmail,
            role,
            active,
            lastAccess: 'Hoje',
          },
          ...prev,
        ])
        toast({
          title: 'Novo usuário criado com sucesso',
          description: `O acesso para ${trimmedName} (${role}) foi configurado.`,
        })
      }
      setModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao cadastrar/atualizar usuário:', err)
      const parsed = getErrorMessage(err)
      let readableMsg = parsed
      if (err?.data?.data?.email?.message) {
        readableMsg = 'Este e-mail já está em uso por outro usuário ou é inválido.'
      } else if (err?.data?.data?.password?.message) {
        readableMsg = 'A senha informada não atende aos requisitos mínimos.'
      } else if (err?.status === 400 && !readableMsg) {
        readableMsg = 'Verifique se o e-mail já foi cadastrado ou se a senha atende ao padrão.'
      } else if (err?.status === 403) {
        readableMsg = 'Permissão negada. Apenas Administradores podem gerenciar usuários.'
      }
      setFormError(readableMsg || 'Erro inesperado ao salvar os dados.')
      toast({
        title: editingUser ? 'Erro ao atualizar usuário' : 'Erro ao cadastrar usuário',
        description: readableMsg || 'Não foi possível salvar o usuário. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const roleBadge = (r: Role) => {
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          Administrador
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
        Técnico
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestão de Usuários & Acessos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controle de permissões e credenciais (Administrador e Técnico)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={loading}
            className="min-h-[44px] text-xs"
            title="Recarregar lista"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
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
      </div>

      <section className="epa-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-2 text-sm text-slate-500">Carregando usuários...</span>
          </div>
        ) : usersList.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-medium">Nenhum usuário encontrado.</p>
            {isAdmin && (
              <Button onClick={openNewModal} size="sm" className="mt-3 bg-emerald-700 text-white">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Cadastrar primeiro usuário
              </Button>
            )}
          </div>
        ) : (
          <div className="table-scroll-container">
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
                  const initials =
                    (u.name || 'U')
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase() || 'U'

                  const isMe = u.id === currentUser?.id
                  const isActionLoading = actionLoadingId === u.id

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
                            {isMe && (
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                (Sua conta conectada)
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
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
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
                              className="h-8 w-8 p-0 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Editar dados e senha"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(u)}
                              disabled={isMe || isActionLoading}
                              className={`h-8 w-8 p-0 text-xs ${
                                u.active
                                  ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                  : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={
                                isMe
                                  ? 'Não é permitido desativar seu próprio usuário'
                                  : u.active
                                    ? 'Desativar acesso do usuário'
                                    : 'Ativar acesso do usuário'
                              }
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : u.active ? (
                                <UserX className="h-3.5 w-3.5" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser(u)}
                              disabled={isMe}
                              className="h-8 w-8 p-0 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                              title={
                                isMe
                                  ? 'Não é permitido excluir sua própria conta'
                                  : 'Excluir usuário do sistema'
                              }
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
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto sm:my-8">
            <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
              <div>
                <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                  {editingUser ? 'Editar Usuário' : 'Novo Usuário EPA'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingUser
                    ? 'Altere os dados cadastrais, cargo ou redefina a senha.'
                    : 'Cadastre um novo colaborador para acesso ao sistema.'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setModalOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="epa-label">Nome Completo *</label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="Ex.: Bruno Santana"
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="epa-label">E-mail Corporativo *</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="usuario@grupoepa.com.br"
                  required
                  className="mt-1"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="epa-label">
                    {editingUser ? 'Nova Senha (opcional)' : 'Senha de Acesso *'}
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
                  >
                    <KeyRound className="h-3 w-3" />
                    Gerar senha forte
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (formError) setFormError(null)
                    }}
                    placeholder={
                      editingUser
                        ? 'Deixe em branco para manter a senha atual'
                        : 'Mínimo de 8 caracteres (ou gere acima)'
                    }
                    className="mt-1 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!editingUser && !password && (
                  <p className="text-[11px] text-slate-500">
                    Se não informada, será usada a senha padrão:{' '}
                    <code className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      Skip@Pass123
                    </code>
                  </p>
                )}
              </div>

              {(password || !editingUser) && (
                <div>
                  <label className="epa-label">
                    {editingUser ? 'Confirmar Nova Senha' : 'Confirmar Senha'}
                  </label>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value)
                      if (formError) setFormError(null)
                    }}
                    placeholder="Repita a senha informada"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="epa-label">Perfil de Acesso (RBAC) *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="epa-input mt-1"
                >
                  <option value="technician">Técnico (Planilha de Campo e RDO)</option>
                  <option value="admin">
                    Administrador (Controle Total, Análise, PDF/Excel e Gestão)
                  </option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Define o nível de permissão às telas e ações do sistema EPA.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3 dark:border-slate-800">
                <div>
                  <p className="text-xs font-semibold">Conta Ativa</p>
                  <p className="text-[10px] text-slate-500">
                    Permite autenticação e acesso às rotas
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[40px]"
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </span>
                  ) : editingUser ? (
                    'Atualizar Usuário'
                  ) : (
                    'Cadastrar Usuário'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 sm:p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900 my-auto">
            <div className="flex items-center gap-3 text-red-600">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-red-100 dark:bg-red-950">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">
                Confirmar Exclusão
              </h3>
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
              Tem certeza que deseja remover o usuário <b>{deletingUser.name}</b> (
              {deletingUser.email})? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteUser}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Excluindo...
                  </span>
                ) : (
                  'Excluir'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
