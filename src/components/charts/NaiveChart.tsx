import { useLayoutEffect, useRef } from 'react'
import type { TelemetryPacket } from '../../types/telemetry'

export interface NaiveChartProps {
  /** Latest telemetry batch from React state — redraws on every update. */
  data: TelemetryPacket[]
  throughput: number
  memoryUsageMb: number
}

interface ChartPoint {
  cpuTemp: number
  throughput: number
  memory: number
}

const HISTORY_LIMIT = 120
const PAD = { top: 28, right: 16, bottom: 28, left: 44 }

const SERIES = [
  { key: 'cpuTemp' as const, label: 'CPU Temp', color: '#f07178', max: 100 },
  { key: 'throughput' as const, label: 'Throughput', color: '#7dd3fc', max: 20_000 },
  { key: 'memory' as const, label: 'Memory', color: '#3ecfbe', max: 128 },
]

function averageMetric(packets: TelemetryPacket[], metricName: string): number {
  let sum = 0
  let count = 0
  for (const packet of packets) {
    if (packet.metricName === metricName) {
      sum += packet.value
      count += 1
    }
  }
  return count > 0 ? sum / count : 0
}

function drawSmoothSeries(
  ctx: CanvasRenderingContext2D,
  values: number[],
  maxValue: number,
  color: string,
  plotW: number,
  plotH: number,
): void {
  if (values.length < 2) return

  const points: { x: number; y: number }[] = values.map((value, index) => {
    const x =
      PAD.left +
      (index / Math.max(values.length - 1, 1)) * plotW
    const normalized = Math.min(1, Math.max(0, value / maxValue))
    const y = PAD.top + plotH - normalized * plotH
    return { x, y }
  })

  ctx.beginPath()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.moveTo(points[0].x, points[0].y)

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i]
    const next = points[i + 1]
    const midX = (current.x + next.x) / 2
    const midY = (current.y + next.y) / 2
    ctx.quadraticCurveTo(current.x, current.y, midX, midY)
  }

  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()

  // Soft fill under the curve (intentional extra paint work per tick).
  ctx.lineTo(last.x, PAD.top + plotH)
  ctx.lineTo(points[0].x, PAD.top + plotH)
  ctx.closePath()
  ctx.fillStyle = `${color}22`
  ctx.fill()
}

/**
 * Main-thread canvas chart. Intentionally redraws on every React state tick
 * (useLayoutEffect) with no rAF throttling — maximizes UI jank under load.
 */
export function NaiveChart({
  data,
  throughput,
  memoryUsageMb,
}: NaiveChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const historyRef = useRef<ChartPoint[]>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Synchronous redraw whenever React commits new telemetry props.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const cpuTemp = averageMetric(data, 'temp.celsius')
    const memFromPackets = averageMetric(data, 'mem.rss')
    const memory =
      memoryUsageMb > 0 ? memoryUsageMb : memFromPackets

    if (data.length > 0 || throughput > 0 || memory > 0) {
      historyRef.current.push({
        cpuTemp: cpuTemp > 0 ? cpuTemp : historyRef.current.at(-1)?.cpuTemp ?? 40,
        throughput,
        memory,
      })
      if (historyRef.current.length > HISTORY_LIMIT) {
        historyRef.current.splice(
          0,
          historyRef.current.length - HISTORY_LIMIT,
        )
      }
    }

    const dpr = window.devicePixelRatio || 1
    const cssWidth = container.clientWidth
    const cssHeight = 260
    canvas.width = Math.max(1, Math.floor(cssWidth * dpr))
    canvas.height = Math.max(1, Math.floor(cssHeight * dpr))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssWidth, cssHeight)

    const plotW = cssWidth - PAD.left - PAD.right
    const plotH = cssHeight - PAD.top - PAD.bottom

    // Background grid
    ctx.fillStyle = '#151820'
    ctx.fillRect(0, 0, cssWidth, cssHeight)

    ctx.strokeStyle = 'rgba(255,255,255,0.06)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i += 1) {
      const y = PAD.top + (plotH / 4) * i
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(PAD.left + plotW, y)
      ctx.stroke()
    }

    ctx.fillStyle = '#6b7383'
    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace'
    ctx.fillText('0', 8, PAD.top + plotH + 4)
    ctx.fillText('max', 4, PAD.top + 10)

    const history = historyRef.current
    for (const series of SERIES) {
      drawSmoothSeries(
        ctx,
        history.map((point) => point[series.key]),
        series.max,
        series.color,
        plotW,
        plotH,
      )
    }

    // Legend
    let legendX = PAD.left
    ctx.font = '12px "DM Sans", ui-sans-serif, system-ui, sans-serif'
    for (const series of SERIES) {
      ctx.fillStyle = series.color
      ctx.fillRect(legendX, 8, 10, 10)
      ctx.fillStyle = '#9aa3b2'
      ctx.fillText(series.label, legendX + 14, 17)
      legendX += ctx.measureText(series.label).width + 36
    }
  }, [data, throughput, memoryUsageMb])

  return (
    <section
      aria-label="Naive live telemetry chart"
      className="glass-panel glass-sheen relative overflow-hidden rounded-xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3.5 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Naive Live Chart
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            Canvas 2D redraw on every React state tick — no rAF throttle.
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-ink-muted">
          BATCH · {data.length.toLocaleString()}
        </span>
      </div>
      <div ref={containerRef} className="min-w-0 p-2 sm:p-3">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-lg"
          role="img"
          aria-label="Multi-series line chart of CPU temperature, throughput, and memory"
        />
      </div>
    </section>
  )
}
