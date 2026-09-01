import { cn } from '@/lib/utils'

import logoEpa from '@/assets/logo-epa-3e647.png'

export function EpaLogo({
  compact = false,
  monochrome = false,
  className,
}: {
  compact?: boolean
  monochrome?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)} aria-label="Grupo EPA">
      {compact ? (
        <img src={logoEpa} alt="Grupo EPA" className="h-10 w-auto object-contain shrink-0" />
      ) : (
        <div className="flex items-center">
          <img
            src={logoEpa}
            alt="Grupo EPA"
            className="h-11 w-auto max-w-[190px] object-contain shrink-0"
          />
        </div>
      )}
    </div>
  )
}

export { logoEpa }
