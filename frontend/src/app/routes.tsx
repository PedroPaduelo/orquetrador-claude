import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './app-layout'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ProtectedRoute } from '@/features/auth/protected-route'

// Lazy load pages
const LoginPage = lazy(() => import('@/features/auth/login'))
const RegisterPage = lazy(() => import('@/features/auth/register'))
const DashboardPage = lazy(() => import('@/features/dashboard'))
const WorkflowsPage = lazy(() => import('@/features/workflows'))
const WorkflowWizardPage = lazy(() => import('@/features/workflows/wizard'))
const ConversationsPage = lazy(() => import('@/features/conversations'))
const ConversationDetailPage = lazy(() => import('@/features/conversations/[id]'))
const McpServersPage = lazy(() => import('@/features/mcp-servers'))
const SkillsPage = lazy(() => import('@/features/skills'))
const AgentsPage = lazy(() => import('@/features/agents'))
const RulesPage = lazy(() => import('@/features/rules'))
const PluginsPage = lazy(() => import('@/features/plugins'))
const HooksPage = lazy(() => import('@/features/hooks'))
const SettingsPage = lazy(() => import('@/features/settings'))
const AdminPage = lazy(() => import('@/features/admin'))
const WebhooksPage = lazy(() => import('@/features/webhooks'))

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
