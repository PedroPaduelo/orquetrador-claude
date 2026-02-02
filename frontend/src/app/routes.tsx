import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from './app-layout'
import { Skeleton } from '@/shared/components/ui/skeleton'

// Lazy load pages
const WorkflowsPage = lazy(() => import('@/features/workflows'))
const ConversationsPage = lazy(() => import('@/features/conversations'))
const ConversationDetailPage = lazy(() => import('@/features/conversations/[id]'))
const SmartNotesPage = lazy(() => import('@/features/smart-notes'))
const TranscriptionPage = lazy(() => import('@/features/transcription'))

// Page loader
function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

// Lazy wrapper
function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Main layout */}
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/conversations" replace />} />

        <Route
          path="workflows"
          element={
            <Lazy>
              <WorkflowsPage />
            </Lazy>
          }
        />

        <Route
          path="conversations"
          element={
            <Lazy>
              <ConversationsPage />
            </Lazy>
          }
        />

        <Route
          path="conversations/:id"
          element={
            <Lazy>
              <ConversationDetailPage />
            </Lazy>
          }
        />

        <Route
          path="smart-notes"
          element={
            <Lazy>
              <SmartNotesPage />
            </Lazy>
          }
        />

        <Route
          path="transcription"
          element={
            <Lazy>
              <TranscriptionPage />
            </Lazy>
          }
        />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
