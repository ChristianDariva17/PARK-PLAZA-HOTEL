import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* Sistema de diseño global y tokens Hotel Park Plaza ★★★★★ */
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { HotelProvider } from './state/HotelContext.jsx'

// Asegura el tema visual y optimización de renderizado en el documento
if (typeof document !== 'undefined' && !document.documentElement.getAttribute('data-theme')) {
  document.documentElement.setAttribute('data-theme', 'luxury');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <HotelProvider>
        <App />
      </HotelProvider>
    </AuthProvider>
  </StrictMode>,
)

