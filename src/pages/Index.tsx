import { useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import { Layout, type Page } from '@/components/Layout'
import { Copilot } from '@/components/Copilot'
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
  const { isAuthenticated, isLoading } = useAuth()
  const { toast } = useToast()

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
    <Layout page={page} setPage={setPage} onSearch={setQuery}>
      {page === 'dashboard' && <Dashboard navigate={setPage} />}
      {page === 'projects' && (
        <Projects
          query={query}
          onOpenRdo={() => setPage('rdos')}
          onOpenField={() => setPage('fields')}
        />
      )}
      {page === 'rdos' && <RdosPage query={query} />}
      {page === 'fields' && <FieldSpreadsheets query={query} />}
      {page === 'users' && <UsersPage />}
      {page === 'audit' && <AuditPage />}
      {(page === 'dashboard' || page === 'projects') && <Copilot />}
      <Toaster />
    </Layout>
  )
}
