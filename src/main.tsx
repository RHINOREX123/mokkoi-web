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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/projects" element={<AuthGuard><ProjectsPage /></AuthGuard>} />
        <Route path="/app/:projectId" element={<AuthGuard><App /></AuthGuard>} />
        <Route path="/app" element={<Navigate to="/projects" replace />} />
        <Route path="/view/:projectId" element={<PublicViewPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
