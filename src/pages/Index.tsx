import { useEffect, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import { Layout, type Page } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Projects } from '@/pages/Projects'
import { RdosPage } from '@/pages/Rdos'
import { FieldSpreadsheets } from '@/pages/FieldSpreadsheets'
import { InSituPage } from '@/pages/InSituSpreadsheets'
import { NaMonitoringPage } from '@/pages/NaMonitoringSpreadsheets'
import { UsersPage } from '@/pages/Users'
import { AuditPage } from '@/pages/Audit'
import AreaConfigs from '@/pages/AreaConfigs'
import { LoginPage } from '@/pages/Login'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { REALTIME_RECORD_UPDATE, type RealtimeRecordUpdateDetail } from '@/context/SyncContext'
import { Loader2 } from 'lucide-react'

export default function Index() {
  const [page, setPage] = useState<Page>('dashboard')
  const [query, setQuery] = useState('')
  const { user, isAuthenticated, isLoading } = useAuth()
  const { toast } = useToast()

  // Guard navigation by user role
  const handleNavigate = (targetPage: Page) => {
    const role = user?.role

    if (
      (targetPage === 'users' || targetPage === 'audit' || targetPage === 'area_configs') &&
      role !== 'admin'
    ) {
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
    if ((page === 'users' || page === 'audit' || page === 'area_configs') && role !== 'admin') {
      toast({
        title: 'Você não possui permissão para esta função.',
        description: 'Redirecionando para Visão Geral.',
        variant: 'destructive',
      })
      setPage('dashboard')
    }
  }, [user, page, toast])

  // Escuta os eventos centralizados de realtime emitidos pelo SyncContext
  useEffect(() => {
    const handleRealtimeUpdate = (evt: Event) => {
      const customEvt = evt as CustomEvent<RealtimeRecordUpdateDetail>
      const detail = customEvt.detail
      if (!detail) return

      if (detail.collection === 'reports_rdo' && detail.action === 'update' && detail.record) {
        const status = detail.record.status
        if (status === 'approved' || status === 'returned') {
          toast({
            title: status === 'approved' ? 'RDO aprovado' : 'RDO devolvido',
            description:
              status === 'approved'
                ? 'O relatório foi aprovado e bloqueado.'
                : 'Há novas solicitações de correção.',
          })
        }
      }
    }

    window.addEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    return () => {
      window.removeEventListener(REALTIME_RECORD_UPDATE, handleRealtimeUpdate)
    }
  }, [toast])

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
      {page === 'rdos' && (user?.role === 'admin' || user?.role === 'technician') && (
        <RdosPage query={query} />
      )}
      {page === 'fields' && (user?.role === 'admin' || user?.role === 'technician') && (
        <FieldSpreadsheets query={query} />
      )}
      {page === 'insitu' && (user?.role === 'admin' || user?.role === 'technician') && (
        <InSituPage query={query} />
      )}
      {page === 'na_monitoring' && (user?.role === 'admin' || user?.role === 'technician') && (
        <NaMonitoringPage query={query} />
      )}
      {page === 'users' && user?.role === 'admin' && <UsersPage />}
      {page === 'audit' && user?.role === 'admin' && <AuditPage />}
      {page === 'area_configs' && user?.role === 'admin' && <AreaConfigs />}
      {/* Fallback de navegação se o usuário tiver perfil que não se enquadre na rota */}
      {(page === 'rdos' || page === 'fields' || page === 'insitu' || page === 'na_monitoring') &&
        user?.role !== 'admin' &&
        user?.role !== 'technician' && <Dashboard navigate={handleNavigate} />}
      {(page === 'users' || page === 'audit' || page === 'area_configs') &&
        user?.role !== 'admin' && <Dashboard navigate={handleNavigate} />}
      <Toaster />
    </Layout>
  )
}
