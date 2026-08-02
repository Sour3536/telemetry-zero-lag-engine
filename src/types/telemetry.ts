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
