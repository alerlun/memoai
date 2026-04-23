import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LangProvider } from './hooks/useLang'
import { ThemeProvider } from './hooks/useTheme'
import AuthPage from './pages/AuthPage'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import UploadPage from './pages/UploadPage'
import StudyPage from './pages/StudyPage'
import SettingsPage from './pages/SettingsPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AchievementsPage from './pages/AchievementsPage'
import CommandPalette from './components/CommandPalette'

/* Redirect authenticated users away from /auth */
function PublicRoute({ children }) {
  const { user } = useAuth()
  return !user ? children : <Navigate to="/" replace />
}

/* Protect dashboard routes — redirect to /auth if not signed in */
function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/auth" replace />
}

/* Smart root: show landing page for visitors, dashboard for signed-in users */
function RootRoute() {
  const { user } = useAuth()
  return user ? <HomePage /> : <LandingPage />
}

function AppRoutes() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (user) setCmdOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [user])

  return (
    <>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <Routes>
      {/* Root — landing or dashboard */}
      <Route path="/" element={<RootRoute />} />

      {/* Auth */}
      <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

      {/* Protected app routes */}
      <Route path="/upload"     element={<PrivateRoute><UploadPage /></PrivateRoute>} />
      <Route path="/study/:id"  element={<PrivateRoute><StudyPage /></PrivateRoute>} />
      <Route path="/settings"      element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="/achievements" element={<PrivateRoute><AchievementsPage /></PrivateRoute>} />

      {/* Public legal pages */}
      <Route path="/terms"   element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  )
}
