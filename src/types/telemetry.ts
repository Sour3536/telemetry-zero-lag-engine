import type { ComponentType, SVGProps } from 'react'

export interface TelemetryPacket {
  timestamp: number
  metricName: string
  value: number
  deviceId: string
}

export interface SystemMetrics {
  fps: number
  eventCount: number
  memoryUsageMb: number
  mainThreadLatencyMs: number
}

export type EngineMode = 'naive' | 'worker' | 'offscreen'

export type ArchitectureMode = Extract<EngineMode, 'naive' | 'worker'>

/** Lucide-compatible icon component used by metric cards. */
export type MetricIcon = ComponentType<
  SVGProps<SVGSVGElement> & { className?: string }
>

export interface MetricCardProps {
  title: string
  value: string
  unit?: string
  description: string
  icon: MetricIcon
  valueClassName?: string
  iconClassName?: string
}

export interface HeaderProps {
  engineMode: EngineMode
}

export interface SimulationControls {
  targetEventRate: number
  engineMode: EngineMode
  batchSize: number
  isRunning: boolean
}

export interface ControlPanelProps {
  controls: SimulationControls
  onChange: (next: SimulationControls) => void
}

export interface MetricsGridProps {
  metrics: SystemMetrics
}

export type NavItemId = 'overview' | 'benchmarks' | 'worker-logs' | 'settings'

export interface SidebarProps {
  activeItem?: NavItemId
  onNavigate?: (id: NavItemId) => void
}
