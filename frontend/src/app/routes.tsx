import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './app-layout'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ProtectedRoute } from '@/features/auth/protected-route'

// Retry dynamic import — forces page reload on stale chunk 404
function lazyRetry<T extends { default: React.ComponentType }>(
  factory: () => Promise<T>,
): React.LazyExoticComponent<T['default']> {
  return lazy(() =>
    factory().catch(() => {
      const key = 'chunk-reload'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
      }
      return factory()
    }),
  )
}

// Lazy load pages
const LoginPage = lazyRetry(() => import('@/features/auth/login'))
const RegisterPage = lazyRetry(() => import('@/features/auth/register'))
const DashboardPage = lazyRetry(() => import('@/features/dashboard'))
const WorkflowsPage = lazyRetry(() => import('@/features/workflows'))
const WorkflowWizardPage = lazyRetry(() => import('@/features/workflows/wizard'))
const ConversationsPage = lazyRetry(() => import('@/features/conversations'))
const ConversationDetailPage = lazyRetry(() => import('@/features/conversations/[id]'))
const McpServersPage = lazyRetry(() => import('@/features/mcp-servers'))
const SkillsPage = lazyRetry(() => import('@/features/skills'))
const AgentsPage = lazyRetry(() => import('@/features/agents'))
const RulesPage = lazyRetry(() => import('@/features/rules'))
const PluginsPage = lazyRetry(() => import('@/features/plugins'))
const HooksPage = lazyRetry(() => import('@/features/hooks'))
const SettingsPage = lazyRetry(() => import('@/features/settings'))
const AdminPage = lazyRetry(() => import('@/features/admin'))
const WebhooksPage = lazyRetry(() => import('@/features/webhooks'))
const StepTemplatesPage = lazyRetry(() => import('@/features/step-templates'))
const ExecutionsPage = lazyRetry(() => import('@/features/executions'))
const WorkflowChatPage = lazyRetry(() => import('@/features/workflow-chat'))

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
      {/* Public routes */}
      <Route path="/login" element={<Lazy><LoginPage /></Lazy>} />
      <Route path="/register" element={<Lazy><RegisterPage /></Lazy>} />

      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route
          index
          element={
            <Lazy>
              <DashboardPage />
            </Lazy>
          }
        />

        <Route
          path="workflows"
          element={
            <Lazy>
              <WorkflowsPage />
            </Lazy>
          }
        />

        <Route
          path="workflows/new"
          element={
            <Lazy>
              <WorkflowWizardPage />
            </Lazy>
          }
        />

        <Route
          path="workflows/:id/edit"
          element={
            <Lazy>
              <WorkflowWizardPage />
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
          path="executions"
          element={
            <Lazy>
              <ExecutionsPage />
            </Lazy>
          }
        />

        <Route
          path="workflow-chat"
          element={
            <Lazy>
              <WorkflowChatPage />
            </Lazy>
          }
        />

        <Route
          path="mcp-servers"
          element={
            <Lazy>
              <McpServersPage />
            </Lazy>
          }
        />

        <Route
          path="skills"
          element={
            <Lazy>
              <SkillsPage />
            </Lazy>
          }
        />

        <Route
          path="agents"
          element={
            <Lazy>
              <AgentsPage />
            </Lazy>
          }
        />

        <Route
          path="rules"
          element={
            <Lazy>
              <RulesPage />
            </Lazy>
          }
        />

        <Route
          path="plugins"
          element={
            <Lazy>
              <PluginsPage />
            </Lazy>
          }
        />

        <Route
          path="hooks"
          element={
            <Lazy>
              <HooksPage />
            </Lazy>
          }
        />

        <Route
          path="settings"
          element={
            <Lazy>
              <SettingsPage />
            </Lazy>
          }
        />

        <Route
          path="admin/users"
          element={
            <Lazy>
              <AdminPage />
            </Lazy>
          }
        />

        <Route
          path="webhooks"
          element={
            <Lazy>
              <WebhooksPage />
            </Lazy>
          }
        />

        <Route
          path="step-templates"
          element={
            <Lazy>
              <StepTemplatesPage />
            </Lazy>
          }
        />

      </Route>

      {/* Catch all - go to dashboard (protected) */}
      <Route path="*" element={
        <ProtectedRoute>
          <Lazy>
            <DashboardPage />
          </Lazy>
        </ProtectedRoute>
      } />
    </Routes>
  )
}
