import { useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import { Layout, type Page } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Projects } from '@/pages/Projects'
import { RdosPage } from '@/pages/Rdos'
import { FieldSpreadsheets } from '@/pages/FieldSpreadsheets'
import { UsersPage } from '@/pages/Users'
import { AuditPage } from '@/pages/Audit'
import { LoginPage } from '@/pages/Login'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

type RealtimeRecord = RecordModel & { status?: string }

export default function Index() {
  const [page, setPage] = useState<Page>('dashboard')
  const [query, setQuery] = useState('')
  const { user, isAuthenticated, isLoading } = useAuth()
  const { toast } = useToast()

  // Guard navigation by user role
  const handleNavigate = (targetPage: Page) => {
    const role = user?.role

    if (targetPage === 'fields' && role === 'operator') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'O perfil Operador tem acesso restrito ao RDO.',
        variant: 'destructive',
      })
      setPage('rdos')
      return
    }

    if (targetPage === 'rdos' && role === 'technician') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'O perfil Técnico tem acesso restrito à Planilha de Campo.',
        variant: 'destructive',
      })
      setPage('fields')
      return
    }

    if ((targetPage === 'users' || targetPage === 'audit') && role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Acesso restrito a Administradores.',
        variant: 'destructive',
      })
      setPage('dashboard')
      return
    }

    setPage(targetPage)
  }

  // Effect to ensure user is not on a forbidden route on login or role switch
  useEffect(() => {
    if (!user) return
    const role = user.role
    if (page === 'fields' && role === 'operator') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Redirecionando para Relatórios RDO.',
        variant: 'destructive',
      })
      setPage('rdos')
    } else if (page === 'rdos' && role === 'technician') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Redirecionando para Planilha de Campo.',
        variant: 'destructive',
      })
      setPage('fields')
    } else if ((page === 'users' || page === 'audit') && role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Redirecionando para Visão Geral.',
        variant: 'destructive',
      })
      setPage('dashboard')
    }
  }, [user, page, toast])

  useRealtime<RealtimeRecord>('reports_rdo', ({ action, record }) => {
    if (action === 'update' && (record.status === 'approved' || record.status === 'returned')) {
      toast({
        title: record.status === 'approved' ? 'RDO aprovado' : 'RDO devolvido',
        description:
          record.status === 'approved'
            ? 'O relatório foi aprovado e bloqueado.'
            : 'Há novas solicitações de correção.',
      })
    }
  })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <p className="text-sm font-medium text-slate-300">Carregando Sistema EPA...</p>
        </div>
      </div>
    )
  }

  // Strict route protection: If not authenticated, render Login Page exclusively
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    )
  }

  return (
    <Layout page={page} setPage={handleNavigate} onSearch={setQuery}>
      {page === 'dashboard' && <Dashboard navigate={handleNavigate} />}
      {page === 'projects' && (
        <Projects
          query={query}
          onOpenRdo={() => handleNavigate('rdos')}
          onOpenField={() => handleNavigate('fields')}
        />
      )}
      {page === 'rdos' && (user?.role === 'admin' || user?.role === 'operator') && (
        <RdosPage query={query} />
      )}
      {page === 'fields' && (user?.role === 'admin' || user?.role === 'technician') && (
        <FieldSpreadsheets query={query} />
      )}
      {page === 'users' && user?.role === 'admin' && <UsersPage />}
      {page === 'audit' && user?.role === 'admin' && <AuditPage />}
      <Toaster />
    </Layout>
  )
}
