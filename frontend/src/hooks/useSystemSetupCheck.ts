import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API_URL } from '../config'
import { showError } from '../utils/toastManager'

export function useSystemSetupCheck() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // The backend serves the SPA via tower-http ServeDir, which 307-redirects
    // /setup -> /setup/. React Router's location.pathname can therefore be either
    // form, so normalise the trailing slash before comparing — otherwise the guard
    // never matches on /setup/ and we redirect in an infinite reload loop.
    if (location.pathname.replace(/\/+$/, '') === '/setup') return

    async function checkSetup() {
      try {
        const response = await fetch(`${API_URL}/api/setup/status`)
        if (!response.ok) return

        const data = await response.json()
        if (data.is_setup_required) {
          console.warn('System not setup, redirecting to setup wizard...')
          // Use hard redirect to avoid conflicts with router/animations during init.
          // Target the canonical '/setup' (Astro trailingSlash: 'never' 404s on
          // '/setup/' in dev). The guard above tolerates the '/setup/' that ServeDir
          // resolves to on the native backend.
          window.location.replace('/setup')
        }
      } catch (error) {
        console.error('Failed to check setup status:', error)
        showError('无法连接到服务器检查系统状态')
      }
    }

    checkSetup()
  }, [location.pathname, navigate])
}
