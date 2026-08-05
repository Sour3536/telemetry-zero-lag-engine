import {
  BarChart3,
  LayoutDashboard,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { NavItemId, SidebarProps } from '../types/telemetry'

export type { NavItemId, SidebarProps }

interface NavItem {
  id: NavItemId
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { id: 'worker-logs', label: 'Worker Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({
  activeItem = 'overview',
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="glass-panel-strong flex min-w-0 flex-col border-r border-white/8 px-2 py-4 sm:px-3 sm:py-5">
      <p className="mb-2 hidden px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted sm:block">
        Navigation
      </p>
      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeItem === id
          return (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => onNavigate?.(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors duration-150 sm:justify-start sm:px-3 ${
                isActive
                  ? 'bg-elevated/80 font-medium text-ink'
                  : 'text-ink-soft hover:bg-elevated/50 hover:text-ink'
              }`}
            >
              {isActive ? (
                <span
                  className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
              ) : null}
              <Icon
                className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : 'text-ink-muted'}`}
                aria-hidden="true"
              />
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
