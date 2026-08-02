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
    <aside className="flex flex-col border-r border-slate-800 bg-slate-950 px-3 py-4">
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeItem === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
