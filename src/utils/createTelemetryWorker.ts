/**
 * Vite-compatible Web Worker factory for the telemetry stream.
 *
 * Uses the standard module worker URL pattern so Vite can code-split and
 * bundle `telemetry.worker.ts` as a dedicated worker chunk.
 */
export function createTelemetryWorker(): Worker {
  return new Worker(
    new URL('../workers/telemetry.worker.ts', import.meta.url),
    { type: 'module' },
  )
}
