import { useState } from 'react'
import { Header } from './components/Header'
import { Sidebar, type NavItemId } from './components/Sidebar'
import type { EngineMode } from './types/telemetry'

function App() {
  const [engineMode] = useState<EngineMode>('naive')
  const [activeNav, setActiveNav] = useState<NavItemId>('overview')

  return (
    <div className="grid min-h-svh grid-cols-[240px_1fr] grid-rows-[auto_1fr] bg-slate-950 text-slate-100">
      <Header engineMode={engineMode} />
      <Sidebar activeItem={activeNav} onNavigate={setActiveNav} />
      <main className="overflow-auto p-6">
        <p className="text-sm text-slate-400">
          {activeNav === 'overview' && 'Dashboard overview — telemetry stream ready.'}
          {activeNav === 'benchmarks' && 'Benchmark runner — compare engine modes.'}
          {activeNav === 'worker-logs' && 'Worker logs — inspect off-main-thread events.'}
          {activeNav === 'settings' && 'Settings — configure engine and stream options.'}
        </p>
      </main>
    </div>
  )
}

export default App
