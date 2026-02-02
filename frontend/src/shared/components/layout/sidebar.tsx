import { NavLink } from 'react-router-dom'
import { MessageSquare, Workflow, StickyNote, Mic, Settings } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

const navItems = [
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
  {
    to: '/transcription',
    icon: Mic,
    label: 'Transcricao',
  },
]

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-muted/30 flex flex-col">
      {/* Logo */}
      <div className="h-14 border-b flex items-center px-4">
        <span className="text-xl font-bold text-primary">Execut</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <Settings className="h-5 w-5" />
          Configuracoes
        </button>
      </div>
    </aside>
  )
}
