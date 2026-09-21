import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Sistema de diseño global y tokens Hotel Park Plaza ★★★★★ */
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { startClientTelemetry } from './observability/clientTelemetry.js'

// Asegura el tema visual y optimización de renderizado en el documento
if (typeof document !== 'undefined' && !document.documentElement.getAttribute('data-theme')) {
  document.documentElement.setAttribute('data-theme', 'luxury');
}

if (import.meta.env.VITE_CLIENT_TELEMETRY !== 'false') startClientTelemetry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
