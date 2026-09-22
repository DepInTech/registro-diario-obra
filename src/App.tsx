import Index from '@/pages/Index'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { SyncProvider } from '@/context/SyncContext'
import { AccessibilityLoader } from '@/components/AccessibilityLoader'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <Index />
          <AccessibilityLoader />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
