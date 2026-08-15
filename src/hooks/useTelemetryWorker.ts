import { useEffect, useRef, useState } from 'react'
import type { TelemetryPacket, WorkerStats } from '../types/telemetry'
import {
  createTelemetryWorker,
  isWorkerOutgoingMessage,
  type TelemetryWorker,
} from '../utils/createTelemetryWorker'

export interface UseTelemetryWorkerResult {
  latestBatch: TelemetryPacket[]
  isWorkerRunning: boolean
  workerStats: WorkerStats | null
  lastError: string | null
  start: (rate?: number, batchSize?: number) => void
  stop: () => void
  setRate: (rate: number) => void
  setBatchSize: (batchSize: number) => void
}

/**
 * Manages the telemetry Web Worker lifecycle and exposes stream controls.
 * The worker is always terminated on unmount to avoid leaked threads.
 */
export function useTelemetryWorker(): UseTelemetryWorkerResult {
  const workerRef = useRef<TelemetryWorker | null>(null)

  const [latestBatch, setLatestBatch] = useState<TelemetryPacket[]>([])
  const [isWorkerRunning, setIsWorkerRunning] = useState(false)
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    const worker = createTelemetryWorker()
    workerRef.current = worker

    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerOutgoingMessage(event.data)) return

      switch (event.data.type) {
        case 'TELEMETRY_BATCH':
          setLatestBatch(event.data.packets)
          break
        case 'WORKER_STATS':
          setWorkerStats(event.data.stats)
          setIsWorkerRunning(event.data.stats.running)
          break
        case 'ERROR':
          setLastError(event.data.message)
          console.warn(
            '[useTelemetryWorker]',
            event.data.code,
            event.data.message,
          )
          break
        default: {
          const _exhaustive: never = event.data
          console.warn('[useTelemetryWorker] unhandled message', _exhaustive)
        }
      }
    }

    const onError = (event: ErrorEvent) => {
      setLastError(event.message || 'Telemetry worker crashed')
      setIsWorkerRunning(false)
      console.error('[useTelemetryWorker] worker error', event)
    }

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    return () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const start = (rate?: number, batchSize?: number) => {
    setLastError(null)
    workerRef.current?.postMessage({
      type: 'START',
      rate,
      batchSize,
    })
  }

  const stop = () => {
    workerRef.current?.postMessage({ type: 'STOP' })
    setLatestBatch([])
    setIsWorkerRunning(false)
  }

  const setRate = (rate: number) => {
    workerRef.current?.postMessage({
      type: 'CONFIG_CHANGE',
      rate,
    })
  }

  const setBatchSize = (batchSize: number) => {
    workerRef.current?.postMessage({
      type: 'CONFIG_CHANGE',
      batchSize,
    })
  }

  return {
    latestBatch,
    isWorkerRunning,
    workerStats,
    lastError,
    start,
    stop,
    setRate,
    setBatchSize,
  }
}
