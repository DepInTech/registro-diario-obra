import { ReactNode, useState } from 'react'
import {
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Users,
  Wifi,
  WifiOff,
  X,
  AlertTriangle,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useSync } from '@/context/SyncContext'
import { cn } from '@/lib/utils'
import logoEpa from '@/assets/logo-epa-3e647.png'

export type Page = 'dashboard' | 'projects' | 'rdos' | 'fields' | 'users' | 'audit'

const allPrimary = [
  { id: 'dashboard' as Page, label: 'Visão geral', icon: Home },
  { id: 'projects' as Page, label: 'Meus projetos', icon: FolderKanban },
  {
    id: 'rdos' as Page,
    label: 'Relatórios RDO',
    icon: ClipboardList,
    allowedRoles: ['admin', 'operator'],
  },
  {
    id: 'fields' as Page,
    label: 'Planilhas de campo',
    icon: FileSpreadsheet,
    allowedRoles: ['admin', 'technician'],
  },
]
const admin = [
  { id: 'users' as Page, label: 'Gestão de usuários', icon: Users },
  { id: 'audit' as Page, label: 'Logs de auditoria', icon: ShieldCheck },
]
const titles: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Visão geral', subtitle: 'Acompanhe a operação ambiental em tempo real' },
  projects: { title: 'Meus projetos', subtitle: 'Obras e contratos atribuídos à sua equipe' },
  rdos: { title: 'Relatórios Diários de Obra', subtitle: 'Criação, revisão e aprovação de RDOs' },
  fields: { title: 'Planilhas de campo', subtitle: 'Medições operacionais e controles ambientais' },
  users: { title: 'Gestão de usuários', subtitle: 'Acessos, perfis e atribuições por projeto' },
  audit: { title: 'Logs de auditoria', subtitle: 'Rastreabilidade completa de ações no sistema' },
}

export function Layout({
  page,
  setPage,
  children,
  onSearch,
}: {
  page: Page
  setPage: (page: Page) => void
  children: ReactNode
  onSearch: (value: string) => void
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const { user, logout, hasUnsavedChanges } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { isOnline, isSyncing, pendingCount, syncNow, conflicts, resolveConflict } = useSync()

  const navigate = (id: Page) => {
    setPage(id)
    setMobileOpen(false)
  }

  const handleLogoutClick = () => {
    if (hasUnsavedChanges) {
      setLogoutConfirmOpen(true)
    } else {
      logout()
    }
  }

  const isAdmin = user?.role === 'admin'
  const userRoleLabel =
    user?.role === 'admin' ? 'Administrador' : user?.role === 'technician' ? 'Técnico' : 'Operador'
  const userInitials =
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'EP'

  const visiblePrimary = allPrimary.filter((item) => {
    if (!item.allowedRoles) return true
    return item.allowedRoles.includes(user?.role || '')
  })

  const sidebar = (
    <>
      <div className="flex h-[88px] items-center border-b border-white/10 px-6">
        <img src={logoEpa} alt="Grupo EPA" className="h-12 w-auto object-contain drop-shadow-md" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-teal-200/70">
          Operação
        </p>
        <nav className="space-y-1">
          {visiblePrimary.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>
        {isAdmin && (
          <>
            <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-teal-200/70">
              Administração
            </p>
            <nav className="space-y-1">
              {admin.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={page === item.id}
                  onClick={() => navigate(item.id)}
                />
              ))}
            </nav>
          </>
        )}
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[.06] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  isOnline
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
                )}
              />
              <span className="font-medium">{isOnline ? '🟢 Conectado' : '🟠 Offline'}</span>
            </div>
            {isOnline && (
              <button
                onClick={() => syncNow()}
                disabled={isSyncing}
                title="Sincronizar agora"
                className="text-emerald-300 hover:text-white disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              </button>
            )}
          </div>
          {pendingCount > 0 && (
            <p className="text-[11px] text-amber-200">
              {pendingCount} alteraç{pendingCount > 1 ? 'ões' : 'ão'} para sincronizar
            </p>
          )}
          <p className="text-[10px] text-emerald-200/50">v2.4.0 · PWA & IndexedDB</p>
        </div>
      </div>
    </>
  )
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-gradient-to-b from-[#04332f] via-[#086B63] to-[#02201d] lg:flex">
        {sidebar}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-[#086B63] text-white shadow-2xl">
            {sidebar}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 text-white"
            >
              <X />
            </Button>
          </aside>
        </div>
      )}
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-7 dark:border-slate-800 dark:bg-slate-900/95">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden h-10 w-10"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 flex-1 md:block">
            <h1 className="truncate text-lg font-semibold tracking-tight">{titles[page].title}</h1>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {titles[page].subtitle}
            </p>
          </div>

          {/* Online/Offline pill indicator */}
          <div
            className={cn(
              'hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border',
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300',
            )}
            title={
              isOnline
                ? 'Conexão ativa com o servidor'
                : 'Modo offline ativado — salvando no IndexedDB'
            }
          >
            {isOnline ? (
              <Wifi className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            )}
            <span>{isOnline ? 'Online' : 'Offline'}</span>
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {pendingCount}
              </span>
            )}
          </div>

          <div className="relative flex-1 md:max-w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar projeto, RDO..."
              className="h-10 border-slate-200 bg-slate-50 pl-9 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950"
            />
          </div>

          {/* Theme switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-amber-400" />
            ) : (
              <Moon className="h-5 w-5 text-slate-600" />
            )}
          </Button>

          {/* User Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition outline-none"
                aria-label="Menu do usuário"
              >
                <Avatar className="h-9 w-9 border border-emerald-200 dark:border-emerald-800">
                  <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-left xl:block">
                  <span className="block text-xs font-semibold">{user?.name || 'Usuário'}</span>
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                    {userRoleLabel}
                  </span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 dark:border-slate-800 dark:bg-slate-900"
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || 'Usuário EPA'}</p>
                  <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
                    {user?.email}
                  </p>
                  <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {userRoleLabel}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="dark:bg-slate-800" />
              <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                {theme === 'dark' ? (
                  <>
                    <Sun className="mr-2 h-4 w-4 text-amber-400" />
                    <span>Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>Modo Escuro</span>
                  </>
                )}
              </DropdownMenuItem>
              {isOnline && (
                <DropdownMenuItem
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="cursor-pointer"
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="dark:bg-slate-800" />
              <DropdownMenuItem
                onClick={handleLogoutClick}
                className="cursor-pointer text-red-600 focus:text-red-600 dark:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1600px] px-4 py-5 pb-24 md:px-7 md:py-7 lg:pb-8">
          {conflicts.length > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                    Foi encontrada uma alteração conflitante ({conflicts.length})
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    O documento foi modificado em outro dispositivo enquanto você editava offline.
                    Escolha como resolver para preservar seus dados:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {conflicts.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-xl bg-white/80 p-2 border border-amber-200 dark:bg-slate-900 dark:border-amber-800 text-xs"
                      >
                        <span className="font-medium">
                          {c.type === 'rdo'
                            ? `RDO #${(c.localData as any).number}`
                            : 'Planilha de Campo'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveConflict(c, 'keep_local')}
                          className="h-7 text-xs bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                        >
                          Manter Minha Versão
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resolveConflict(c, 'keep_server')}
                          className="h-7 text-xs"
                        >
                          Usar Servidor
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {visiblePrimary.map((item) => {
          const Icon = item.icon
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] min-h-[48px]',
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>

      {/* Unsaved changes logout confirmation dialog */}
      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent className="dark:border-slate-800 dark:bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle>Existem alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você possui edições que ainda não foram salvas. Deseja realmente sair da conta agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLogoutConfirmOpen(false)
                logout()
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Sair mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function NavItem({
  item,
  active,
  onClick,
}: {
  item: { label: string; icon: typeof Home }
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
        active
          ? 'bg-white text-emerald-900 shadow-lg shadow-emerald-950/20'
          : 'text-emerald-50/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon
        className={cn('h-[18px] w-[18px]', active ? 'text-emerald-700' : 'text-emerald-200/70')}
      />
      <span className="font-medium">{item.label}</span>
      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-600" />}
    </button>
  )
}
