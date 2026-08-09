import type { TelemetryPacket } from '../types/telemetry'

/** Control messages sent from the main thread → worker. */
export type TelemetryWorkerInboundMessage =
  | { type: 'START_STREAM'; rate?: number; batchSize?: number }
  | { type: 'STOP_STREAM' }
  | { type: 'UPDATE_RATE'; rate: number }
  | { type: 'SET_BATCH_SIZE'; batchSize: number }

/** Data / status messages sent from the worker → main thread. */
export type TelemetryWorkerOutboundMessage =
  | {
      type: 'BATCH'
      packets: TelemetryPacket[]
      producedAt: number
      packetCount: number
    }
  | {
      type: 'STATUS'
      running: boolean
      rate: number
      batchSize: number
    }
  | {
      type: 'ERROR'
      message: string
    }
