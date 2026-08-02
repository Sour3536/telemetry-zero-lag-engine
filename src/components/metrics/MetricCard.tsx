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
  valueClassName = 'text-slate-100',
  iconClassName = 'text-slate-400',
}: MetricCardProps) {
  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 p-5 shadow-lg shadow-black/20 backdrop-blur-md">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/5 to-transparent"
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <p className={`mt-2 flex items-baseline gap-1.5 text-3xl font-semibold tabular-nums tracking-tight ${valueClassName}`}>
            <span>{value}</span>
            {unit ? (
              <span className="text-sm font-medium text-slate-500">{unit}</span>
            ) : null}
          </p>
          <p className="mt-2 text-sm leading-snug text-slate-500">{description}</p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/50">
          <Icon className={`h-5 w-5 ${iconClassName}`} aria-hidden="true" />
        </div>
      </div>
    </article>
  )
}
