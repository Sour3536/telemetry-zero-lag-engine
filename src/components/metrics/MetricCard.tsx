import type { MetricCardProps } from '../../types/telemetry'

export type { MetricCardProps }

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
    <article className="metric-card glass-sheen group relative overflow-hidden rounded-xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">
            {title}
          </p>
          <p
            className={`mt-2.5 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-2xl font-semibold leading-none tracking-tight sm:text-[1.75rem] ${valueClassName}`}
          >
            <span className="min-w-0 truncate">{value}</span>
            {unit ? (
              <span className="shrink-0 font-sans text-xs font-medium text-ink-muted">
                {unit}
              </span>
            ) : null}
          </p>
          <p className="mt-3 line-clamp-2 text-sm leading-snug text-ink-soft">
            {description}
          </p>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated/70 ring-1 ring-white/8 transition-colors duration-200 group-hover:bg-elevated group-hover:ring-white/12 sm:h-10 sm:w-10">
          <Icon className={`h-4 w-4 ${iconClassName}`} aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}
