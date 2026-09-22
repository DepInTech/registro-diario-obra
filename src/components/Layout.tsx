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

function formatSyncTime(date: Date | null): string {
  if (!date) return 'Não sincronizado'
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export type Page = 'dashboard' | 'projects' | 'rdos' | 'fields' | 'users' | 'audit'

const allPrimary = [
  { id: 'dashboard' as Page, label: 'Visão geral', icon: Home },
  { id: 'projects' as Page, label: 'Meus projetos', icon: FolderKanban },
  {
    id: 'rdos' as Page,
    label: 'Relatórios RDO',
    icon: ClipboardList,
    allowedRoles: ['admin', 'technician'],
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, logout, hasUnsavedChanges } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const {
    isOnline,
    isSyncing,
    pendingCount,
    failedCount,
    lastSyncTime,
    syncNow,
    retryFailed,
    conflicts,
    resolveConflict,
  } = useSync()

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
  const userRoleLabel = user?.role === 'admin' ? 'Administrador' : 'Técnico'
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
                  !isOnline
                    ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                    : failedCount > 0
                      ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]'
                      : isSyncing
                        ? 'bg-teal-300 animate-pulse'
                        : 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
                )}
              />
              <span className="font-medium">
                {!isOnline
                  ? '🟠 Offline'
                  : failedCount > 0
                    ? '🔴 Erro de Sync'
                    : isSyncing
                      ? 'Sincronizando...'
                      : '🟢 Conectado'}
              </span>
            </div>
            {isOnline && (
              <button
                onClick={() => (failedCount > 0 ? retryFailed() : syncNow())}
                disabled={isSyncing}
                title={
                  failedCount > 0 ? 'Tentar novamente itens que falharam' : 'Sincronizar agora'
                }
                className="text-emerald-300 hover:text-white disabled:opacity-50 transition"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              </button>
            )}
          </div>

          {/* Detailed status lines in sidebar */}
          {failedCount > 0 ? (
            <div className="flex items-center justify-between gap-1 text-[11px] text-rose-200 bg-rose-950/40 border border-rose-500/30 rounded-lg px-2 py-1">
              <span className="truncate">Falhou ({failedCount})</span>
              <button
                onClick={() => retryFailed()}
                disabled={isSyncing}
                className="font-semibold underline hover:text-white shrink-0 disabled:opacity-50"
              >
                Tentar novamente
              </button>
            </div>
          ) : pendingCount > 0 ? (
            <p className="text-[11px] text-amber-200">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-200/80">
              Sincronizado {formatSyncTime(lastSyncTime)}
            </p>
          )}
          <p className="text-[10px] text-emerald-200/50">v2.4.0 · PWA & IndexedDB</p>
        </div>
      </div>
    </>
  )
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar fixa no desktop (>=1024px) */}
      <aside className="epa-sidebar fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-gradient-to-b from-[#04332f] via-[#086B63] to-[#02201d] lg:flex">
        {sidebar}
      </aside>

      {/* Sidebar gaveta recolhível (mobile e tablet <1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="epa-sidebar relative flex h-full w-[280px] max-w-[85vw] flex-col bg-[#086B63] text-white shadow-2xl">
            {sidebar}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 text-white hover:bg-white/10"
            >
              <X />
            </Button>
          </aside>
        </div>
      )}
      <div className="epa-layout-content lg:pl-[252px]">
        <header className="epa-header sticky top-0 z-30 flex h-[72px] w-full items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-6 dark:border-slate-800 dark:bg-slate-900/95">
          {/* SEÇÃO ESQUERDA: botão de menu (<1024px), título/subtítulo, busca desktop */}
          <div className="flex min-w-0 flex-1 items-center gap-3 pr-2 sm:pr-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="h-10 w-10 shrink-0 text-slate-700 lg:hidden dark:text-slate-200"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden min-w-0 flex-1 sm:block md:flex-initial">
              <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">
                {titles[page].title}
              </h1>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {titles[page].subtitle}
              </p>
            </div>

            {/* Busca desktop / tablet */}
            <div className="relative hidden md:block md:w-64 lg:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Buscar projeto, RDO..."
                className="h-10 border-slate-200 bg-slate-50 pl-9 focus-visible:ring-emerald-600 dark:border-slate-800 dark:bg-slate-950"
              />
            </div>
          </div>

          {/* SEÇÃO DIREITA: pílula de sincronização, busca mobile, botão de tema, avatar do usuário */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Sync Status Interactive Pill Indicator */}
            <div className="flex items-center">
              {failedCount > 0 ? (
                <button
                  onClick={() => retryFailed()}
                  disabled={isSyncing}
                  title="Clique para tentar novamente a sincronização dos itens com falha"
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 transition hover:bg-rose-100 sm:px-2.5 dark:border-rose-800/50 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-900/50"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="hidden sm:inline">
                    Falhou ({failedCount}) — Tentar novamente
                  </span>
                  <span className="font-bold sm:hidden">({failedCount})</span>
                  <RefreshCw className={cn('ml-0.5 h-3 w-3', isSyncing && 'animate-spin')} />
                </button>
              ) : pendingCount > 0 ? (
                <button
                  onClick={() => isOnline && syncNow()}
                  disabled={!isOnline || isSyncing}
                  title={
                    isOnline
                      ? 'Clique para sincronizar agora'
                      : 'Alterações pendentes salvas offline'
                  }
                  className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100 sm:px-2.5 dark:border-amber-800/50 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50"
                >
                  {!isOnline ? (
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <RefreshCw
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400',
                        isSyncing && 'animate-spin',
                      )}
                    />
                  )}
                  <span>
                    {pendingCount}{' '}
                    <span className="hidden sm:inline">pendente{pendingCount > 1 ? 's' : ''}</span>
                  </span>
                </button>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition sm:px-2.5',
                    isOnline
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300',
                  )}
                  title={
                    isOnline
                      ? `Todos os dados sincronizados com o servidor às ${formatSyncTime(lastSyncTime)}`
                      : 'Modo offline ativado — salvando no IndexedDB'
                  }
                >
                  {isOnline ? (
                    <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="hidden sm:inline">
                    {isOnline ? `Sincronizado ${formatSyncTime(lastSyncTime)}` : 'Offline'}
                  </span>
                  <span className="text-[11px] sm:hidden">
                    {isOnline ? formatSyncTime(lastSyncTime) : 'Offline'}
                  </span>
                </div>
              )}
            </div>

            {/* Botão de busca mobile (<768px onde a barra de busca fixa fica oculta) */}
            <div className="flex items-center md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className="h-10 w-10 text-slate-600 dark:text-slate-300"
                aria-label="Abrir busca"
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>

            {/* Theme switcher */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
                  className="flex items-center gap-2 rounded-xl p-1.5 transition outline-none hover:bg-slate-100 dark:hover:bg-slate-800"
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
                    <p className="text-sm font-medium leading-none">
                      {user?.name || 'Usuário EPA'}
                    </p>
                    <p className="text-xs leading-none text-slate-500 dark:text-slate-400">
                      {user?.email}
                    </p>
                    <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
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
          </div>
        </header>

        {/* Barra de busca retrátil no celular */}
        {mobileSearchOpen && (
          <div className="border-b border-slate-200 bg-white p-3 sm:hidden dark:border-slate-800 dark:bg-slate-900">
            <div className="relative flex items-center">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Buscar projeto, RDO, planilha..."
                className="h-10 w-full border-slate-200 bg-slate-50 pl-9 pr-9 dark:border-slate-800 dark:bg-slate-950"
              />
              <button
                onClick={() => {
                  setMobileSearchOpen(false)
                  onSearch('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Fechar busca"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1600px] px-3 sm:px-4 py-4 sm:py-5 pb-24 md:px-6 md:py-6 md:pb-8 xl:px-7 xl:py-7">
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
      {/* Barra de abas inferior exclusivamente em celular (< 768px). No tablet e desktop usa o botão hambúrguer / sidebar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:hidden safe-area-pb">
        {visiblePrimary.map((item) => {
          const Icon = item.icon
          const isActive = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] min-h-[48px] active:scale-95 transition-transform',
                isActive
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              <div
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-full transition-colors',
                  isActive && 'bg-emerald-100 dark:bg-emerald-950/60',
                )}
              >
                <Icon className={cn('h-4 w-4', isActive && 'stroke-[2.5]')} />
              </div>
              <span className="truncate max-w-[72px]">{item.label.split(' ')[0]}</span>
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
