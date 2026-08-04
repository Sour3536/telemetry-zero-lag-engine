import { Play, Square } from 'lucide-react'
import type { EngineMode } from '../../types/telemetry'

export interface SimulationControls {
  targetEventRate: number
  engineMode: EngineMode
  batchSize: number
  isRunning: boolean
}

interface ControlPanelProps {
  controls: SimulationControls
  onChange: (next: SimulationControls) => void
}

const EVENT_RATE_MIN = 100
const EVENT_RATE_MAX = 20_000
const BATCH_SIZE_MIN = 1
const BATCH_SIZE_MAX = 500

function formatRate(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function SliderField({
  id,
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  hint,
}: {
  id: string
  label: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  hint: string
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-end justify-between gap-2">
        <label htmlFor={id} className="truncate text-sm font-medium text-ink">
          {label}
        </label>
        <span className="shrink-0 font-mono text-xs text-accent">{valueLabel}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="control-slider w-full"
      />
      <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] text-ink-muted">
        <span className="min-w-0 truncate">{hint}</span>
        <span className="shrink-0 font-mono">
          {formatRate(min)} – {formatRate(max)}
        </span>
      </div>
    </div>
  )
}

export function ControlPanel({ controls, onChange }: ControlPanelProps) {
  const { targetEventRate, engineMode, batchSize, isRunning } = controls
  const architectureMode: Extract<EngineMode, 'naive' | 'worker'> =
    engineMode === 'worker' ? 'worker' : 'naive'

  const patch = (partial: Partial<SimulationControls>) => {
    onChange({ ...controls, ...partial })
  }

  return (
    <section
      aria-label="Simulation controls"
      className="glass-panel glass-sheen relative overflow-hidden rounded-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Control Panel
          </h3>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            Tune load generation and architecture before running the sim.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px] font-medium ${
              isRunning
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-white/10 bg-elevated/70 text-ink-muted'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isRunning ? 'animate-pulse bg-success' : 'bg-ink-muted'
              }`}
              aria-hidden="true"
            />
            {isRunning ? 'RUNNING' : 'STOPPED'}
          </span>

          <button
            type="button"
            onClick={() => patch({ isRunning: true })}
            disabled={isRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent-glow px-2.5 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Start
          </button>

          <button
            type="button"
            onClick={() => patch({ isRunning: false })}
            disabled={!isRunning}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/10 px-2.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Stop
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-3.5 sm:gap-5 sm:p-4 lg:grid-cols-2">
        <SliderField
          id="target-event-rate"
          label="Target Event Rate"
          valueLabel={`${formatRate(targetEventRate)} msg/s`}
          min={EVENT_RATE_MIN}
          max={EVENT_RATE_MAX}
          step={100}
          value={targetEventRate}
          onChange={(value) => patch({ targetEventRate: value })}
          hint="Ingress pressure applied to the pipeline"
        />

        <SliderField
          id="batch-size"
          label="Batch Size / Frame Throttle"
          valueLabel={`${batchSize} events/frame`}
          min={BATCH_SIZE_MIN}
          max={BATCH_SIZE_MAX}
          step={1}
          value={batchSize}
          onChange={(value) => patch({ batchSize: value })}
          hint="How many events are flushed per animation frame"
        />

        <div className="min-w-0 space-y-2 lg:col-span-2">
          <div className="flex min-w-0 items-end justify-between gap-2">
            <p
              className="truncate text-sm font-medium text-ink"
              id="architecture-mode-label"
            >
              Architecture Mode
            </p>
            <span className="shrink-0 font-mono text-[11px] text-ink-muted">
              {architectureMode === 'naive' ? 'MAIN THREAD' : 'OFFLOADED'}
            </span>
          </div>

          <div
            role="group"
            aria-labelledby="architecture-mode-label"
            className="grid gap-2 sm:grid-cols-2"
          >
            <button
              type="button"
              onClick={() => patch({ engineMode: 'naive' })}
              aria-pressed={architectureMode === 'naive'}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                architectureMode === 'naive'
                  ? 'border-warn/40 bg-warn-glow text-ink'
                  : 'border-white/8 bg-elevated/40 text-ink-soft hover:border-white/14 hover:text-ink'
              }`}
            >
              <span className="block truncate text-sm font-medium">
                Naive (Main Thread)
              </span>
              <span className="mt-1 line-clamp-2 block text-xs text-ink-muted">
                Process telemetry on the UI thread — baseline for jank.
              </span>
            </button>

            <button
              type="button"
              onClick={() => patch({ engineMode: 'worker' })}
              aria-pressed={architectureMode === 'worker'}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 ${
                architectureMode === 'worker'
                  ? 'border-accent/40 bg-accent-glow text-ink'
                  : 'border-white/8 bg-elevated/40 text-ink-soft hover:border-white/14 hover:text-ink'
              }`}
            >
              <span className="block truncate text-sm font-medium">
                Web Worker (Offloaded)
              </span>
              <span className="mt-1 line-clamp-2 block text-xs text-ink-muted">
                Move parsing and aggregation off the main thread.
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
