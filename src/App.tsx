import { useState } from 'react'
import { Header } from './components/Header'
import { MetricsGrid } from './components/metrics/MetricsGrid'
import { Sidebar, type NavItemId } from './components/Sidebar'
import type { EngineMode, SystemMetrics } from './types/telemetry'

const INITIAL_METRICS: SystemMetrics = {
  fps: 58,
  eventCount: 10_000,
  memoryUsageMb: 42.6,
  mainThreadLatencyMs: 3.2,
}

function App() {
  const [engineMode] = useState<EngineMode>('naive')
  const [activeNav, setActiveNav] = useState<NavItemId>('overview')
  const [metrics] = useState<SystemMetrics>(INITIAL_METRICS)

  return (
    <div className="grid min-h-svh grid-cols-[240px_1fr] grid-rows-[auto_1fr] bg-slate-950 text-slate-100">
      <Header engineMode={engineMode} />
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <main className="overflow-auto p-6">
        {activeNav === 'overview' && <MetricsGrid metrics={metrics} />}
        {activeNav === 'benchmarks' && (
          <p className="text-sm text-slate-400">
            Benchmark runner — compare engine modes.
          </p>
        )}
        {activeNav === 'worker-logs' && (
          <p className="text-sm text-slate-400">
            Worker logs — inspect off-main-thread events.
          </p>
        )}
        {activeNav === 'settings' && (
          <p className="text-sm text-slate-400">
            Settings — configure engine and stream options.
          </p>
        )}
      </main>
    </div>
  )
}

export default App
