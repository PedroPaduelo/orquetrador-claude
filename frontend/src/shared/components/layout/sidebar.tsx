import { NavLink, useNavigate } from 'react-router-dom'
import {
  MessageSquare,
  Workflow,
  LayoutDashboard,
  Activity,
  Zap,
  Server,
  Sparkles,
  Bot,
  ScrollText,
  Package,
  Webhook,
  Settings,
  LogOut,
  PanelLeftClose,
  Shield,
  FileText,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useAuthStore } from '@/features/auth/store'

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
    to: '/executions',
    icon: Activity,
    label: 'Execucoes',
  },
]

const configItems = [
  {
    to: '/mcp-servers',
    icon: Server,
    label: 'MCP Servers',
  },
  {
    to: '/skills',
    icon: Sparkles,
    label: 'Skills',
  },
  {
    to: '/agents',
    icon: Bot,
    label: 'Agents',
  },
  {
    to: '/rules',
    icon: ScrollText,
    label: 'Rules',
  },
  {
    to: '/plugins',
    icon: Package,
    label: 'Plugins',
  },
  {
    to: '/hooks',
    icon: Webhook,
    label: 'Hooks',
  },
  {
    to: '/webhooks',
    icon: Webhook,
    label: 'Webhooks',
  },
  {
    to: '/step-templates',
    icon: FileText,
    label: 'Templates',
  },
  {
    to: '/settings',
    icon: Settings,
    label: 'Configuracoes',
  },
]

const adminItems = [
  {
    to: '/admin/users',
    icon: Shield,
    label: 'Usuarios',
  },
]

interface SidebarProps {
  onCollapse?: () => void
}

export function Sidebar({ onCollapse }: SidebarProps) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex flex-col h-full w-60">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm shadow-teal-500/20">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-base font-bold tracking-tight">
            <span className="text-gradient">Execut</span>
          </span>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Recolher menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        <div className="space-y-0.5">
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
        </div>

        {/* Config section */}
        <div className="space-y-0.5">
          <div className="border-t border-border/50 mx-3 mb-2" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
            Configuracao
          </p>
          {configItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
        </div>

        {/* Admin section - only for admin role */}
        {user?.role === 'admin' && (
          <div className="space-y-0.5">
            <div className="border-t border-border/50 mx-3 mb-2" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-2">
              Admin
            </p>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
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
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border/50 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
              {(user.name || user.email)[0].toUpperCase()}
            </div>
            <span className="text-[11px] text-muted-foreground truncate flex-1">
              {user.name || user.email}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-150 w-full"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  )
}
