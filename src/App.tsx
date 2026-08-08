import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ControlPanel } from './components/controls/ControlPanel'
import { Header } from './components/Header'
import { NaiveChart } from './components/charts/NaiveChart'
import { MetricsGrid } from './components/metrics/MetricsGrid'
import { Sidebar } from './components/Sidebar'
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor'
import type {
  NavItemId,
  SimulationControls,
  SystemMetrics,
  TelemetryPacket,
} from './types/telemetry'
import {
  HIGH_RATE_THRESHOLD,
  NaiveSimulator,
} from './utils/naiveSimulator'

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

const LONG_TASK_MS = 50

interface LongTaskTelemetryEvent {
  type: 'telemetry.long-task'
  source: string
  durationMs: number
  thresholdMs: number
  rate: number
  batchSize: number
  at: string
}

function measureBetween(
  measureName: string,
  startMark: string,
  endMark: string,
): number {
  performance.mark(endMark)
  try {
    performance.measure(measureName, startMark, endMark)
    const entries = performance.getEntriesByName(measureName, 'measure')
    const last = entries[entries.length - 1]
    return last?.duration ?? 0
  } catch {
    return 0
  } finally {
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)
  }
}

function logAppLongTask(event: LongTaskTelemetryEvent): void {
  console.warn('[App] main-thread long task', event)
}

function App() {
  const [activeNav, setActiveNav] = useState<NavItemId>('overview')
  const [throughput, setThroughput] = useState(0)
  const [packets, setPackets] = useState<TelemetryPacket[]>([])
  const [controls, setControls] = useState<SimulationControls>(INITIAL_CONTROLS)

  const perfSnapshot = usePerformanceMonitor(true)

  const simulatorRef = useRef<NaiveSimulator | null>(null)
  const eventsWindowRef = useRef<{ ts: number; count: number }[]>([])
  const controlsRef = useRef(controls)
  const batchSeqRef = useRef(0)
  const longTaskObserverRef = useRef<PerformanceObserver | null>(null)

  controlsRef.current = controls

  const metrics: SystemMetrics = {
    fps: perfSnapshot.fps,
    eventCount: throughput,
    memoryUsageMb: perfSnapshot.memoryUsageMb,
    mainThreadLatencyMs: perfSnapshot.mainThreadLatencyMs,
  }

  // Keep a stable simulator instance; wire onBatch to force sync React updates.
  useEffect(() => {
    const simulator = new NaiveSimulator({
      rate: controls.targetEventRate,
      batchSize: controls.batchSize,
      onBatch: (batch) => {
        const seq = batchSeqRef.current
        batchSeqRef.current += 1
        const startMark = `app:batch-handle-start:${seq}`
        const endMark = `app:batch-handle-end:${seq}`
        const measureName = `app:batch-handle:${seq}`

        performance.mark(startMark)

        // Intentionally flush every batch so React commits immediately on the
        // main thread — no offloading, no deferred/batched UI updates.
        flushSync(() => {
          performance.mark(`app:state-update-start:${seq}`)
          setPackets(batch)

          const now = performance.now()
          const events = eventsWindowRef.current
          events.push({ ts: now, count: batch.length })
          while (events.length > 0 && now - events[0].ts > 1000) {
            events.shift()
          }
          setThroughput(events.reduce((sum, e) => sum + e.count, 0))
          performance.mark(`app:state-update-end:${seq}`)
        })

        try {
          performance.measure(
            `app:state-update:${seq}`,
            `app:state-update-start:${seq}`,
            `app:state-update-end:${seq}`,
          )
        } catch {
          // marks may collide under extreme load; continue profiling path
        } finally {
          performance.clearMarks(`app:state-update-start:${seq}`)
          performance.clearMarks(`app:state-update-end:${seq}`)
          performance.clearMeasures(`app:state-update:${seq}`)
        }

        const duration = measureBetween(measureName, startMark, endMark)
        const { targetEventRate, batchSize } = controlsRef.current

        if (targetEventRate > HIGH_RATE_THRESHOLD && duration >= LONG_TASK_MS) {
          logAppLongTask({
            type: 'telemetry.long-task',
            source: 'App.onBatch.flushSync',
            durationMs: Number(duration.toFixed(2)),
            thresholdMs: LONG_TASK_MS,
            rate: targetEventRate,
            batchSize,
            at: new Date().toISOString(),
          })
        }
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

  // Observe browser long tasks while operating above the high-rate baseline.
  useEffect(() => {
    const shouldObserve =
      controls.isRunning &&
      controls.engineMode === 'naive' &&
      controls.targetEventRate > HIGH_RATE_THRESHOLD

    if (!shouldObserve || typeof PerformanceObserver === 'undefined') {
      return
    }

    let observer: PerformanceObserver
    try {
      observer = new PerformanceObserver((list) => {
        const { targetEventRate, batchSize } = controlsRef.current
        if (targetEventRate <= HIGH_RATE_THRESHOLD) return

        for (const entry of list.getEntries()) {
          logAppLongTask({
            type: 'telemetry.long-task',
            source: `PerformanceObserver:${entry.entryType}`,
            durationMs: Number(entry.duration.toFixed(2)),
            thresholdMs: LONG_TASK_MS,
            rate: targetEventRate,
            batchSize,
            at: new Date().toISOString(),
          })
        }
      })

      observer.observe({
        type: 'longtask',
        buffered: true,
      } as PerformanceObserverInit)

      longTaskObserverRef.current = observer
      console.info(
        `[App] long-task observer armed (rate ${controls.targetEventRate} > ${HIGH_RATE_THRESHOLD} msg/s)`,
      )
    } catch {
      console.info(
        '[App] PerformanceObserver longtask not supported in this browser',
      )
      return
    }

    return () => {
      observer.disconnect()
      longTaskObserverRef.current = null
    }
  }, [
    controls.isRunning,
    controls.engineMode,
    controls.targetEventRate,
  ])

  // Start / stop based on controls — naive path only for now.
  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return

    const shouldRun =
      controls.isRunning && controls.engineMode === 'naive'

    if (shouldRun && !simulator.isRunning()) {
      eventsWindowRef.current = []
      batchSeqRef.current = 0
      performance.mark('app:sim-run-start')
      simulator.start()
    } else if (!shouldRun && simulator.isRunning()) {
      simulator.stop()
      performance.mark('app:sim-run-stop')
      try {
        performance.measure(
          'app:sim-run',
          'app:sim-run-start',
          'app:sim-run-stop',
        )
      } catch {
        // start mark may be absent
      } finally {
        performance.clearMarks('app:sim-run-start')
        performance.clearMarks('app:sim-run-stop')
        performance.clearMeasures('app:sim-run')
      }

      flushSync(() => {
        setPackets([])
        setThroughput(0)
      })
    }
  }, [controls.isRunning, controls.engineMode])

  // Push live rate / batch size into the running simulator (no restart).
  useEffect(() => {
    const simulator = simulatorRef.current
    if (!simulator) return
    simulator.updateRate(controls.targetEventRate)
    simulator.updateBatchSize(controls.batchSize)

    if (controls.targetEventRate > HIGH_RATE_THRESHOLD && controls.isRunning) {
      console.info(
        `[App] high-rate baseline active: ${controls.targetEventRate} msg/s — logging main-thread long tasks ≥ ${LONG_TASK_MS}ms`,
      )
    }
  }, [controls.targetEventRate, controls.batchSize, controls.isRunning])

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
            <NaiveChart
              data={packets}
              throughput={throughput}
              memoryUsageMb={metrics.memoryUsageMb}
            />
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
