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
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="font-mono text-xs text-accent">{valueLabel}</span>
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
      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        <span>{hint}</span>
        <span className="font-mono">
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
      className="relative overflow-hidden rounded-xl border border-line bg-panel"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Control Panel
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Tune load generation and architecture before running the sim.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium ${
              isRunning
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-line bg-elevated text-ink-muted'
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
            className="inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent-glow px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Start
          </button>

          <button
            type="button"
            onClick={() => patch({ isRunning: false })}
            disabled={!isRunning}
            className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            Stop
          </button>
        </div>
      </div>

      <div className="grid gap-6 p-5 lg:grid-cols-2">
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

        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-medium text-ink" id="architecture-mode-label">
              Architecture Mode
            </p>
            <span className="font-mono text-[11px] text-ink-muted">
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
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                architectureMode === 'naive'
                  ? 'border-warn/40 bg-warn-glow text-ink'
                  : 'border-line bg-elevated/50 text-ink-soft hover:border-line-strong hover:text-ink'
              }`}
            >
              <span className="block text-sm font-medium">Naive (Main Thread)</span>
              <span className="mt-1 block text-xs text-ink-muted">
                Process telemetry on the UI thread — baseline for jank.
              </span>
            </button>

            <button
              type="button"
              onClick={() => patch({ engineMode: 'worker' })}
              aria-pressed={architectureMode === 'worker'}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                architectureMode === 'worker'
                  ? 'border-accent/40 bg-accent-glow text-ink'
                  : 'border-line bg-elevated/50 text-ink-soft hover:border-line-strong hover:text-ink'
              }`}
            >
              <span className="block text-sm font-medium">
                Web Worker (Offloaded)
              </span>
              <span className="mt-1 block text-xs text-ink-muted">
                Move parsing and aggregation off the main thread.
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
