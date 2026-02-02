import { Bot } from 'lucide-react'

export function Header() {
  return (
    <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Execut</span>
          <span className="text-sm text-muted-foreground">Claude Orchestrator</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Future: user menu, settings, etc */}
        </div>
      </div>
    </header>
  )
}
