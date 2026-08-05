import { Activity } from 'lucide-react'
import type { EngineMode, HeaderProps } from '../types/telemetry'

export type { HeaderProps }

function statusLabel(mode: EngineMode): string {
  if (mode === 'worker') return 'ENGINE: WORKER MODE'
  if (mode === 'offscreen') return 'ENGINE: OFFSCREEN MODE'
  return 'ENGINE: NAIVE MODE'
}

function statusLabelShort(mode: EngineMode): string {
  if (mode === 'worker') return 'WORKER'
  if (mode === 'offscreen') return 'OFFSCREEN'
  return 'NAIVE'
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22 0 1.6-.01 2.89-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  )
}

export function Header({ engineMode }: HeaderProps) {
  const isWorker = engineMode === 'worker'

  return (
    <header className="glass-panel-strong col-span-full flex min-w-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-6 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-glow ring-1 ring-accent/25">
          <Activity className="h-4 w-4 text-accent" aria-hidden="true" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink">
            Telemetry Zero-Lag Engine
          </h1>
          <p className="hidden truncate text-[11px] text-ink-muted sm:block">
            High-throughput stream observability
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span
          className={`inline-flex max-w-[9.5rem] items-center gap-2 truncate rounded-md border px-2 py-1 font-mono text-[10px] font-medium tracking-wide sm:max-w-none sm:px-2.5 sm:text-[11px] ${
            isWorker
              ? 'border-accent/30 bg-accent-glow text-accent'
              : 'border-warn/30 bg-warn-glow text-warn'
          }`}
          title={statusLabel(engineMode)}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${
              isWorker ? 'bg-accent' : 'bg-warn'
            }`}
            aria-hidden="true"
          />
          <span className="sm:hidden">{statusLabelShort(engineMode)}</span>
          <span className="hidden sm:inline">{statusLabel(engineMode)}</span>
        </span>

        <a
          href="https://github.com/Sour3536/telemetry-zero-lag-engine"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-elevated/70 px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:border-white/16 hover:bg-elevated hover:text-ink sm:px-3"
        >
          <GitHubIcon className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>
  )
}
