import { Cpu, Gauge, MemoryStick, Zap } from 'lucide-react'
import type { SystemMetrics } from '../../types/telemetry'
import { MetricCard } from './MetricCard'

interface MetricsGridProps {
  metrics: SystemMetrics
}

function fpsValueClass(fps: number): string {
  if (fps < 30) return 'text-danger'
  if (fps > 55) return 'text-success'
  return 'text-warn'
}

function fpsIconClass(fps: number): string {
  if (fps < 30) return 'text-danger'
  if (fps > 55) return 'text-success'
  return 'text-warn'
}

function formatThroughput(eventsPerSec: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(eventsPerSec))
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  const { fps, eventCount, mainThreadLatencyMs, memoryUsageMb } = metrics

  return (
    <section
      aria-label="Live telemetry metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <MetricCard
        title="FPS Counter"
        value={fps.toFixed(0)}
        unit="FPS"
        description="Target 60 FPS · live render loop"
        icon={Gauge}
        valueClassName={fpsValueClass(fps)}
        iconClassName={fpsIconClass(fps)}
      />
      <MetricCard
        title="Throughput"
        value={formatThroughput(eventCount)}
        unit="msg/s"
        description="Events processed per second"
        icon={Zap}
        valueClassName="text-sky-300"
        iconClassName="text-sky-400"
      />
      <MetricCard
        title="Main Thread Blocking"
        value={mainThreadLatencyMs.toFixed(1)}
        unit="ms"
        description="Latency from main-thread stalls"
        icon={Cpu}
        valueClassName="text-violet-300"
        iconClassName="text-violet-400"
      />
      <MetricCard
        title="JS Heap Memory"
        value={memoryUsageMb.toFixed(1)}
        unit="MB"
        description="Current JavaScript heap usage"
        icon={MemoryStick}
        valueClassName="text-accent"
        iconClassName="text-accent"
      />
    </section>
  )
}
