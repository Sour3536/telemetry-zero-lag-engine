import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string
  unit?: string
  description: string
  icon: LucideIcon
  valueClassName?: string
  iconClassName?: string
}

export function MetricCard({
  title,
  value,
  unit,
  description,
  icon: Icon,
  valueClassName = 'text-ink',
  iconClassName = 'text-accent',
}: MetricCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-xl border border-line bg-panel p-5 transition-colors hover:border-line-strong">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {title}
          </p>
          <p
            className={`mt-2.5 flex items-baseline gap-1.5 font-mono text-[1.75rem] font-semibold leading-none tracking-tight ${valueClassName}`}
          >
            <span>{value}</span>
            {unit ? (
              <span className="font-sans text-xs font-medium text-ink-muted">
                {unit}
              </span>
            ) : null}
          </p>
          <p className="mt-3 text-sm leading-snug text-ink-soft">{description}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elevated ring-1 ring-line">
          <Icon className={`h-4 w-4 ${iconClassName}`} aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}
