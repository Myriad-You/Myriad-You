/** Installed Tapp discovery and runtime state controls. */

import type { TappManifest, TappManifestLocales } from '../types'
import { apiRequest } from './TappHttpClient'

export interface TappListItem {
  id: string
  name: string
  version: string
  description?: string
  icon?: string
  iconSvg?: string
  /** manifest.locales 透传，用 resolveManifestText 按当前语言解析 */
  locales?: TappManifestLocales
  status: string
  installedAt: string
  lastRunAt?: string
  isTemporary?: boolean
  isAdminTapp?: boolean
  /** Public install visibility: everyone | admins only */
  visibility?: TappVisibility
}

/** Public (site-owner) install visibility. Private installs ignore this. */
export type TappVisibility = 'all' | 'admin'

export interface TappDetail {
  id: string
  name: string
  version: string
  description?: string
  author?: {
    name: string
    email?: string
    url?: string
  }
  icon?: string
  theme_color?: string
  manifest: TappManifest
  status: string
  granted_permissions: string[]
  installed_at: string
  last_run_at?: string
  user_role?: string
  is_temporary?: boolean
  is_admin_tapp?: boolean
  /** Public install visibility: `all` | `admin` */
  visibility?: TappVisibility
}

export interface RecentTappItem {
  id: string
  name: string
  icon?: string
  iconSvg?: string
  themeColor?: string
  /** manifest.locales 透传，用 resolveManifestText 按当前语言解析 */
  locales?: TappManifestLocales
  lastRunAt: string
  runCount: number
}

export async function listTapps(): Promise<TappListItem[]> {
  return apiRequest('/api/tapps')
}

export async function listTappDetails(): Promise<TappDetail[]> {
  return apiRequest('/api/tapps/details')
}

export async function getRecentTapps(
  limit: number = 10,
): Promise<RecentTappItem[]> {
  return apiRequest(`/api/tapps/recent?limit=${limit}`)
}

export async function getTapp(tappId: string): Promise<TappDetail> {
  return apiRequest(`/api/tapps/${encodeURIComponent(tappId)}`)
}

export async function startTapp(tappId: string): Promise<void> {
  return apiRequest(`/api/tapps/${encodeURIComponent(tappId)}/start`, {
    method: 'POST',
  })
}

export async function stopTapp(tappId: string): Promise<void> {
  return apiRequest(`/api/tapps/${encodeURIComponent(tappId)}/stop`, {
    method: 'POST',
  })
}

/** Update public-install visibility (admin only). */
export async function setTappVisibility(
  tappId: string,
  visibility: TappVisibility,
): Promise<{ id: string; visibility: TappVisibility }> {
  return apiRequest(
    `/api/tapps/${encodeURIComponent(tappId)}/visibility`,
    {
      method: 'POST',
      body: JSON.stringify({ visibility }),
    },
  )
}
