import {
  BarChart3,
  LayoutDashboard,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type NavItemId = 'overview' | 'benchmarks' | 'worker-logs' | 'settings'

interface NavItem {
  id: NavItemId
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { id: 'worker-logs', label: 'Worker Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  activeItem?: NavItemId
  onNavigate?: (id: NavItemId) => void
}

export function Sidebar({
  activeItem = 'overview',
  onNavigate,
}: SidebarProps) {
  return (
    <aside className="flex flex-col border-r border-line bg-panel px-3 py-5">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        Navigation
      </p>
      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeItem === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-elevated font-medium text-ink'
                  : 'text-ink-soft hover:bg-elevated/60 hover:text-ink'
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
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
