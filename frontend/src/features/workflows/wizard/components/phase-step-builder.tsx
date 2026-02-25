import { StepListSidebar } from './step-list-sidebar'
import { StepDetailEditor } from './step-detail-editor'

export function PhaseStepBuilder() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 border rounded-lg overflow-hidden bg-background">
      <StepListSidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <StepDetailEditor />
      </div>
    </div>
  )
}
