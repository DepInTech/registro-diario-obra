import { cn } from '@/lib/utils'

export function EpaLogo({
  compact = false,
  monochrome = false,
  className,
}: {
  compact?: boolean
  monochrome?: boolean
  className?: string
}) {
  const color = monochrome ? '#111827' : '#1B4332'
  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)} aria-label="Grupo EPA">
      <svg viewBox="0 0 64 64" className="h-10 w-10 shrink-0" role="img" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill={color} />
        <path d="M32 10 23 21h5l-9 9h7l-10 12h12v10h8V42h12L38 30h7l-9-9h5L32 10Z" fill="white" />
        <path
          d="M13 24c4-6 9-10 15-12M51 24c-4-6-9-10-15-12M16 47c4 4 8 6 12 7M48 47c-4 4-8 6-12 7"
          stroke="white"
          strokeWidth="2"
          fill="none"
        />
      </svg>
      {!compact && (
        <div className="leading-none">
          <div
            className={cn(
              'text-[10px] font-semibold uppercase tracking-[0.28em]',
              monochrome ? 'text-gray-700' : 'text-emerald-700',
            )}
          >
            Grupo
          </div>
          <div className="text-2xl font-black tracking-tight" style={{ color }}>
            EPA
          </div>
        </div>
      )}
    </div>
  )
}
