import { Activity } from "lucide-react";
import type { EngineMode } from "../types/telemetry";

interface HeaderProps {
  engineMode: EngineMode;
}

function statusLabel(mode: EngineMode): string {
  if (mode === "worker") return "ENGINE: WORKER MODE";
  if (mode === "offscreen") return "ENGINE: OFFSCREEN MODE";
  return "ENGINE: NAIVE MODE";
}

export function Header({ engineMode }: HeaderProps) {
  const isWorker = engineMode === "worker";

  return (
    <header className="col-span-full flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Activity className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        <h1 className="text-base font-semibold tracking-tight text-slate-100">
          Telemetry Zero-Lag Engine
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium tracking-wide ${
            isWorker
              ? "border-sky-500/40 bg-sky-500/10 text-sky-300"
              : "border-amber-500/40 bg-amber-500/10 text-amber-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isWorker ? "bg-sky-400" : "bg-amber-400"
            } animate-pulse`}
            aria-hidden="true"
          />
          {statusLabel(engineMode)}
        </span>

        <a
          href="https://github.com/Sour3536/telemetry-zero-lag-engine"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          {/* <GithubIcon className="h-4 w-4" aria-hidden="true" /> */}
          GitHub
        </a>
      </div>
    </header>
  );
}
