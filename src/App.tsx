import Index from '@/pages/Index'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { SyncProvider } from '@/context/SyncContext'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SyncProvider>
          <Index />
        </SyncProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
