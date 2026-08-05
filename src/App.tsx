import { useState } from 'react'
import { ControlPanel } from './components/controls/ControlPanel'
import { Header } from './components/Header'
import { MetricsGrid } from './components/metrics/MetricsGrid'
import { Sidebar } from './components/Sidebar'
import type {
  NavItemId,
  SimulationControls,
  SystemMetrics,
} from './types/telemetry'

const INITIAL_METRICS: SystemMetrics = {
  fps: 58,
  eventCount: 10_000,
  memoryUsageMb: 42.6,
  mainThreadLatencyMs: 3.2,
}

const INITIAL_CONTROLS: SimulationControls = {
  targetEventRate: 10_000,
  engineMode: 'naive',
  batchSize: 64,
  isRunning: false,
}

const PAGE_COPY: Record<NavItemId, { title: string; description: string }> = {
  overview: {
    title: 'Overview',
    description: 'Live system health for the zero-lag telemetry pipeline.',
  },
  benchmarks: {
    title: 'Benchmarks',
    description: 'Compare naive, worker, and offscreen engine modes under load.',
  },
  'worker-logs': {
    title: 'Worker Logs',
    description: 'Inspect off-main-thread events and processing traces.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure engine mode, sampling, and stream options.',
  },
}

function App() {
  const [activeNav, setActiveNav] = useState<NavItemId>('overview')
  const [metrics] = useState<SystemMetrics>(INITIAL_METRICS)
  const [controls, setControls] = useState<SimulationControls>(INITIAL_CONTROLS)
  const page = PAGE_COPY[activeNav]

  return (
    <div className="grid min-h-svh grid-cols-[64px_minmax(0,1fr)] grid-rows-[auto_1fr] bg-canvas font-sans text-ink sm:grid-cols-[220px_minmax(0,1fr)]">
      <Header engineMode={controls.engineMode} />
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <main className="min-w-0 overflow-auto bg-[radial-gradient(ellipse_at_top,#1c2433_0%,var(--color-canvas)_55%)] p-4 sm:p-6 md:p-8">
        <div className="mb-5 flex min-w-0 items-end justify-between gap-3 sm:mb-6 sm:gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink sm:text-xl">
              {page.title}
            </h2>
            <p className="mt-1 line-clamp-2 max-w-xl text-sm text-ink-soft">
              {page.description}
            </p>
          </div>
          {activeNav === 'overview' ? (
            <p className="hidden shrink-0 font-mono text-[11px] text-ink-muted md:block">
              SAMPLE RATE · 16ms
            </p>
          ) : null}
        </div>

        {activeNav === 'overview' && (
          <div className="min-w-0 space-y-4 sm:space-y-6">
            <MetricsGrid metrics={metrics} />
            <ControlPanel controls={controls} onChange={setControls} />
          </div>
        )}
        {activeNav !== 'overview' && (
          <div className="glass-panel rounded-xl border-dashed px-4 py-14 text-center sm:px-6 sm:py-16">
            <p className="text-sm text-ink-soft">
              {page.title} view coming next — scaffolding is ready.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
