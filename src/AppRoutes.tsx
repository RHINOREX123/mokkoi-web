import { Suspense, lazy, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import XrayLanding from './pages/XrayLanding'
import { legacyLoading } from './pages/legacyLoading'

// X-ray pages other than the landing load on demand.
const XrayDocPage = lazy(() => import('./pages/XrayDocPage'))
const XrayOrderPage = lazy(() => import('./pages/XrayOrderPage'))
const XrayReportPage = lazy(() => import('./pages/XrayReportPage'))
const XrayAdminPage = lazy(() => import('./pages/XrayAdminPage'))

// Legacy mobile-builder routes, kept reachable during the pivot. Lazy so the
// landing page doesn't ship the canvas app.
const App = lazy(() => import('./App'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AuthGuard = lazy(() => import('./components/AuthGuard'))
const PublicViewPage = lazy(() => import('./pages/PublicViewPage'))
const PreviewPage = lazy(() => import('./pages/PreviewPage'))
const PricingPage = lazy(() => import('./components/PricingPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminGuard = lazy(() => import('./components/AdminGuard'))
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'))
const RuntimePoc = lazy(() => import('./pages/RuntimePoc'))
const PlanModePreview = lazy(() => import('./pages/PlanModePreview'))
const RootPage = lazy(() => import('./pages/LegacyRedirects').then((m) => ({ default: m.RootPage })))
const ProjectsRedirect = lazy(() => import('./pages/LegacyRedirects').then((m) => ({ default: m.ProjectsRedirect })))

/** Legacy routes keep their black loading screen; X-ray routes get a blank paper one. */
const legacy = (el: ReactNode) => <Suspense fallback={legacyLoading}>{el}</Suspense>
const xray = (el: ReactNode) => <Suspense fallback={<div className="xr" />}>{el}</Suspense>

export default function AppRoutes() {
  return (
    <Routes>
          <Route path="/" element={<XrayLanding />} />
          <Route path="/order" element={xray(<XrayOrderPage />)} />
          <Route path="/r/:token" element={xray(<XrayReportPage />)} />
          <Route path="/admin/xray" element={xray(<XrayAdminPage />)} />
          <Route path="/support" element={xray(<XrayDocPage page="support" />)} />
          <Route path="/terms" element={xray(<XrayDocPage page="terms" />)} />
          <Route path="/privacy" element={xray(<XrayDocPage page="privacy" />)} />
          <Route path="/refunds" element={xray(<XrayDocPage page="refunds" />)} />
  
          {/* Previous mobile-builder home (dashboard / old landing), kept reachable during the pivot. */}
          <Route path="/legacy" element={legacy(<RootPage />)} />
          <Route path="/auth" element={legacy(<AuthPage />)} />
          <Route path="/pricing" element={legacy(<PricingPage />)} />
          <Route path="/projects" element={legacy(<ProjectsRedirect />)} />
          <Route path="/app/:projectId" element={legacy(<AuthGuard><App /></AuthGuard>)} />
          <Route path="/app" element={<Navigate to="/" replace />} />
          <Route path="/view/:projectId" element={legacy(<PublicViewPage />)} />
          <Route path="/preview/:projectId/:screenId" element={legacy(<PreviewPage />)} />
          <Route path="/settings" element={legacy(<AuthGuard><SettingsPage /></AuthGuard>)} />
          <Route path="/admin" element={legacy(<AdminGuard><AdminDashboard /></AdminGuard>)} />
          <Route path="/runtime-poc" element={legacy(<RuntimePoc />)} />
          {/* Dev-only Plan Mode component preview. Tree-shaken from prod
              builds via the import.meta.env.DEV gate. */}
          {import.meta.env.DEV && (
            <Route path="/__plan-mode-preview" element={legacy(<PlanModePreview />)} />
          )}
          <Route path="/docs" element={legacy(<ComingSoonPage title="Docs" blurb="Full developer docs are on the way. In the meantime, hop into the app and start building — it's pretty self-explanatory." />)} />
          <Route path="/blog" element={legacy(<ComingSoonPage title="Blog" blurb="We're writing. Follow along for build logs, launches, and what we're learning." />)} />
          <Route path="/changelog" element={legacy(<ComingSoonPage title="Changelog" blurb="Every update, every fix. Public changelog coming soon." />)} />
          <Route path="/about" element={legacy(<ComingSoonPage title="About Mokkoi" blurb="We're building the fastest way to go from idea to mobile app. More about the team and mission soon." />)} />
        </Routes>
  )
}
