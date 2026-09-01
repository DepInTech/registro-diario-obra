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
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'

type RealtimeRecord = RecordModel & { status?: string }

export default function Index() {
  const [page, setPage] = useState<Page>('dashboard')
  const [query, setQuery] = useState('')
  const { toast } = useToast()
  useRealtime<RealtimeRecord>('reports_rdo', ({ action, record }) => {
    if (action === 'update' && (record.status === 'approved' || record.status === 'returned'))
      toast({
        title: record.status === 'approved' ? 'RDO aprovado' : 'RDO devolvido',
        description:
          record.status === 'approved'
            ? 'O relatório foi aprovado e bloqueado.'
            : 'Há novas solicitações de correção.',
      })
  })
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])
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
