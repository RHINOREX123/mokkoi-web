import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import ProjectsPage from './pages/ProjectsPage'
import AuthGuard from './components/AuthGuard'
import PublicViewPage from './pages/PublicViewPage'
import PreviewPage from './pages/PreviewPage'
import PricingPage from './components/PricingPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminGuard from './components/AdminGuard'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/projects" element={<AuthGuard><ProjectsPage /></AuthGuard>} />
        <Route path="/app/:projectId" element={<AuthGuard><App /></AuthGuard>} />
        <Route path="/app" element={<Navigate to="/projects" replace />} />
        <Route path="/view/:projectId" element={<PublicViewPage />} />
        <Route path="/preview/:projectId/:screenId" element={<PreviewPage />} />
        <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
