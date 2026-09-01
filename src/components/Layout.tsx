import { ReactNode, useState } from 'react'
import {
  Bell,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Home,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type Page = 'dashboard' | 'projects' | 'rdos' | 'fields' | 'users' | 'audit'

const primary = [
  { id: 'dashboard' as Page, label: 'Visão geral', icon: Home },
  { id: 'projects' as Page, label: 'Meus projetos', icon: FolderKanban },
  { id: 'rdos' as Page, label: 'Relatórios RDO', icon: ClipboardList },
  { id: 'fields' as Page, label: 'Planilhas de campo', icon: FileSpreadsheet },
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
  const navigate = (id: Page) => {
    setPage(id)
    setMobileOpen(false)
  }
  const sidebar = (
    <>
      <div className="flex h-[88px] items-center border-b border-white/10 px-6">
        <img
          src="https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/9fd27c13-4b57-4495-a17d-d514629fc46c/logo-epa-f4060.png"
          alt="Grupo EPA"
          className="h-12 w-auto brightness-0 invert"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300/60">
          Operação
        </p>
        <nav className="space-y-1">
          {primary.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              active={page === item.id}
              onClick={() => navigate(item.id)}
            />
          ))}
        </nav>
        <p className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-300/60">
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
      </div>
      <div className="border-t border-white/10 p-4">
        <div className="rounded-xl bg-white/[.06] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            Sistema operacional
          </div>
          <p className="text-[10px] text-emerald-200/50">v2.4.0 · Skip Cloud</p>
        </div>
      </div>
    </>
  )
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col bg-gradient-to-b from-[#063f36] via-[#064e3b] to-[#052f2c] lg:flex">
        {sidebar}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="relative flex h-full w-[280px] flex-col bg-[#064e3b] text-white shadow-2xl">
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
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur md:px-7">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden min-w-0 flex-1 md:block">
            <h1 className="truncate text-lg font-semibold tracking-tight">{titles[page].title}</h1>
            <p className="truncate text-xs text-slate-500">{titles[page].subtitle}</p>
          </div>
          <div className="relative flex-1 md:max-w-[360px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar projeto, RDO..."
              className="h-10 border-slate-200 bg-slate-50 pl-9 focus-visible:ring-emerald-600"
            />
          </div>
          <button className="relative grid h-10 w-10 place-items-center rounded-full text-slate-500 hover:bg-slate-100">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-amber-500" />
          </button>
          <button className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-50">
            <Avatar className="h-9 w-9 border border-emerald-100">
              <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-800">
                AA
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-left xl:block">
              <span className="block text-xs font-semibold">Annik Almeida</span>
              <span className="block text-[10px] text-slate-500">Administrador</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 xl:block" />
          </button>
        </header>
        <main className="mx-auto min-h-[calc(100vh-72px)] max-w-[1600px] px-4 py-5 pb-24 md:px-7 md:py-7 lg:pb-8">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t bg-white lg:hidden">
        {primary.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px]',
                page === item.id ? 'text-emerald-700' : 'text-slate-500',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </nav>
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
