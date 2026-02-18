import { NavLink } from 'react-router-dom'
import {
  MessageSquare,
  Workflow,
  StickyNote,
  LayoutDashboard,
  Zap,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const navItems = [
  {
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    end: true,
  },
  {
    to: '/conversations',
    icon: MessageSquare,
    label: 'Conversas',
  },
  {
    to: '/workflows',
    icon: Workflow,
    label: 'Workflows',
  },
  {
    to: '/smart-notes',
    icon: StickyNote,
    label: 'Smart Notes',
  },
]

export function Sidebar() {
  return (
    <aside className="w-[240px] border-r border-border/50 bg-card/30 flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 gap-2.5 border-b border-border/50">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/20">
          <Zap className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight">
          <span className="text-gradient">Execut</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
          Menu
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary shadow-sm shadow-primary/5'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-[11px] text-muted-foreground">Execut v1.0</span>
        </div>
      </div>
    </aside>
  )
}
