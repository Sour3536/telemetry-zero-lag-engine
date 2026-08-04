import { useState } from 'react'
import {
  ControlPanel,
  type SimulationControls,
} from './components/controls/ControlPanel'
import { Header } from './components/Header'
import { MetricsGrid } from './components/metrics/MetricsGrid'
import { Sidebar, type NavItemId } from './components/Sidebar'
import type { SystemMetrics } from './types/telemetry'

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
    <div className="grid min-h-svh grid-cols-[240px_1fr] grid-rows-[auto_1fr] bg-canvas font-sans text-ink">
      <Header engineMode={controls.engineMode} />
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <main className="overflow-auto bg-[radial-gradient(ellipse_at_top,_#1c2433_0%,_var(--color-canvas)_55%)] p-6 md:p-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              {page.title}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-ink-soft">{page.description}</p>
          </div>
          {activeNav === 'overview' ? (
            <p className="hidden font-mono text-[11px] text-ink-muted sm:block">
              SAMPLE RATE · 16ms
            </p>
          ) : null}
        </div>

        {activeNav === 'overview' && (
          <div className="space-y-6">
            <MetricsGrid metrics={metrics} />
            <ControlPanel controls={controls} onChange={setControls} />
          </div>
        )}
        {activeNav !== 'overview' && (
          <div className="rounded-xl border border-dashed border-line bg-panel/60 px-6 py-16 text-center">
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
