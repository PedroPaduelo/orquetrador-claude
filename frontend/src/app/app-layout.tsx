import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/shared/components/layout/sidebar'
import { PanelLeft } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          'shrink-0 border-r border-border/50 bg-card/30 transition-all duration-300 overflow-hidden',
          collapsed ? 'w-0 border-r-0' : 'w-60'
        )}
      >
        <Sidebar onCollapse={() => setCollapsed(true)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="shrink-0 border-b border-border/50 px-2 py-1.5">
            <button
              onClick={() => setCollapsed(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Expandir menu"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
