import { CheckCircle2, Clock3, RefreshCw, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SheetSyncStatus =
  | 'pending_create'
  | 'pending_update'
  | 'synced'
  | 'failed'
  | 'conflict'
  | undefined

interface SheetSyncBadgeProps {
  syncStatus: SheetSyncStatus
  isGlobalSyncing?: boolean
  syncError?: string
  onRetry?: () => void
  compact?: boolean
  className?: string
}

export function SheetSyncBadge({
  syncStatus,
  isGlobalSyncing = false,
  syncError,
  onRetry,
  compact = false,
  className,
}: SheetSyncBadgeProps) {
  // If global sync is running and item is pending/failed, show Enviando
  const isPending = syncStatus === 'pending_create' || syncStatus === 'pending_update'
  const isFailed = syncStatus === 'failed'
  const isConflict = syncStatus === 'conflict'
  const isSynced =
    syncStatus === 'synced' || (!syncStatus && !isPending && !isFailed && !isConflict)

  if (isGlobalSyncing && (isPending || isFailed)) {
    return (
      <span
        title="Enviando para o servidor..."
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 shadow-sm animate-pulse',
          className,
        )}
      >
        <RefreshCw className="h-3 w-3 animate-spin" />
        <span>Enviando...</span>
      </span>
    )
  }

  if (isConflict) {
    return (
      <span
        title="Conflito detectado com a versão do escritório"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300 shadow-sm',
          className,
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        <span>Conflito</span>
      </span>
    )
  }

  if (isFailed) {
    return (
      <div className={cn('inline-flex items-center gap-1.5', className)}>
        <span
          title={syncError || 'Falha ao sincronizar com o servidor'}
          className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 shadow-sm"
        >
          <AlertTriangle className="h-3 w-3 text-red-600" />
          <span>{compact ? 'Falhou' : 'Falha no envio'}</span>
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRetry()
            }}
            title="Tentar enviar novamente para o servidor"
            className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-1.5 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-700 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/50 shadow-xs transition"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            <span>Tentar novamente</span>
          </button>
        )}
      </div>
    )
  }

  if (isPending) {
    return (
      <span
        title={
          syncStatus === 'pending_create'
            ? 'Rascunho criado offline. Pronto para envio.'
            : 'Alterações offline salvas. Pronto para envio.'
        }
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-sm',
          className,
        )}
      >
        <Clock3 className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        <span>
          {compact
            ? 'Offline'
            : syncStatus === 'pending_create'
              ? 'Rascunho offline'
              : 'Editado offline'}
        </span>
      </span>
    )
  }

  if (isSynced) {
    return (
      <span
        title="Confirmado e sincronizado com o servidor"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shadow-sm',
          className,
        )}
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        <span>Sincronizada</span>
      </span>
    )
  }

  return null
}
