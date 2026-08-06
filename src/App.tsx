import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ControlPanel } from './components/controls/ControlPanel'
import { Header } from './components/Header'
import { MetricsGrid } from './components/metrics/MetricsGrid'
import { Sidebar } from './components/Sidebar'
import type {
  NavItemId,
  SimulationControls,
  SystemMetrics,
  TelemetryPacket,
} from './types/telemetry'
import { NaiveSimulator } from './utils/naiveSimulator'

const INITIAL_METRICS: SystemMetrics = {
  fps: 0,
  eventCount: 0,
  memoryUsageMb: 0,
  mainThreadLatencyMs: 0,
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

function readHeapMb(): number {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number }
  }
  if (!perf.memory) return 0
  return perf.memory.usedJSHeapSize / (1024 * 1024)
}

function App() {
  const [activeNav, setActiveNav] = useState<NavItemId>('overview')
  const [metrics, setMetrics] = useState<SystemMetrics>(INITIAL_METRICS)
  const [packets, setPackets] = useState<TelemetryPacket[]>([])
  const [controls, setControls] = useState<SimulationControls>(INITIAL_CONTROLS)

  const simulatorRef = useRef<NaiveSimulator | null>(null)
  const frameTimestampsRef = useRef<number[]>([])
  const eventsWindowRef = useRef<{ ts: number; count: number }[]>([])

  // Keep a stable simulator instance; wire onBatch to force sync React updates.
  useEffect(() => {
    const simulator = new NaiveSimulator({
      rate: controls.targetEventRate,
      batchSize: controls.batchSize,
      onBatch: (batch) => {
        const workStarted = performance.now()

        // Intentionally flush every batch so React commits immediately on the
        // main thread — no offloading, no deferred/batched UI updates.
        flushSync(() => {
          setPackets(batch)

          const now = performance.now()
          const frames = frameTimestampsRef.current
          frames.push(now)
          while (frames.length > 0 && now - frames[0] > 1000) {
            frames.shift()
          }

          const events = eventsWindowRef.current
          events.push({ ts: now, count: batch.length })
          while (events.length > 0 && now - events[0].ts > 1000) {
            events.shift()
          }
          const throughput = events.reduce((sum, e) => sum + e.count, 0)

          setMetrics({
            fps: frames.length,
            eventCount: throughput,
            memoryUsageMb: readHeapMb(),
            mainThreadLatencyMs: performance.now() - workStarted,
          })
        })
      },
    })

    simulatorRef.current = simulator

    return () => {
      simulator.stop()
      simulatorRef.current = null
    }
    // Simulator is created once; rate/batch updates go through methods below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Start / stop based on controls — naive path only for now.
  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return

    const shouldRun =
      controls.isRunning && controls.engineMode === 'naive'

    if (shouldRun && !simulator.isRunning()) {
      frameTimestampsRef.current = []
      eventsWindowRef.current = []
      simulator.start()
    } else if (!shouldRun && simulator.isRunning()) {
      simulator.stop()
      flushSync(() => {
        setPackets([])
        setMetrics(INITIAL_METRICS)
      })
    }
  }, [controls.isRunning, controls.engineMode])

  // Push live rate / batch size into the running simulator (no restart).
  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return
    simulator.updateRate(controls.targetEventRate)
    simulator.updateBatchSize(controls.batchSize)
  }, [controls.targetEventRate, controls.batchSize])

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
              LAST BATCH · {packets.length.toLocaleString()} pkts
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
