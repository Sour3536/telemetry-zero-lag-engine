import type {
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
} from '../types/telemetry'

export type TelemetryWorker = Worker & {
  postMessage: (message: WorkerIncomingMessage) => void
}

/**
 * Vite-compatible Web Worker factory for the telemetry stream.
 *
 * Uses the standard module worker URL pattern so Vite can code-split and
 * bundle `telemetry.worker.ts` as a dedicated worker chunk.
 */
export function createTelemetryWorker(): TelemetryWorker {
  return new Worker(
    new URL('../workers/telemetry.worker.ts', import.meta.url),
    { type: 'module' },
  ) as TelemetryWorker
}

/** Narrow an unknown worker event payload to WorkerOutgoingMessage. */
export function isWorkerOutgoingMessage(
  data: unknown,
): data is WorkerOutgoingMessage {
  if (!data || typeof data !== 'object' || !('type' in data)) return false
  const type = (data as { type: unknown }).type
  return (
    type === 'TELEMETRY_BATCH' ||
    type === 'WORKER_STATS' ||
    type === 'ERROR'
  )
}
