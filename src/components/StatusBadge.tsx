import { AlertCircle, CheckCircle2, Clock3, Send } from 'lucide-react'
import type { Status } from '@/data/epa'
import { statusLabel } from '@/data/epa'
import { cn } from '@/lib/utils'

const config = {
  draft: {
    icon: Clock3,
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  },
  submitted: {
    icon: Send,
    className:
      'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  approved: {
    icon: CheckCircle2,
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  returned: {
    icon: AlertCircle,
    className:
      'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
}

export function StatusBadge({ status, compact = false }: { status: Status; compact?: boolean }) {
  const item = config[status]
  const Icon = item.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        item.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {compact ? statusLabel[status].slice(0, 5) : statusLabel[status]}
    </span>
  )
}
