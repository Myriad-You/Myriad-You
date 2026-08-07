import { useCallback, useEffect, useState } from 'react'
import apiService from '../services/api'
import { dedupedFetch } from './requestDedup'

export type ModuleVisibilityLevel = 'all' | 'authenticated' | 'admin'
export type ModuleVisibilityKey =
  | 'library'
  | 'brew'
  | 'reports'
  | 'life'
  | 'tapp'
  | 'agent'

/** 游客：仅控制是否展示助手入口（无后端能力档） */
export type AgentGuestUsageLevel = 'none' | 'visible'
/** 普通用户 Agent 使用档 */
export type AgentUserUsageLevel = 'none' | 'chat' | 'standard' | 'elevated'

export interface AgentUsagePreferences {
  guest: AgentGuestUsageLevel
  user: AgentUserUsageLevel
}

export interface ModuleVisibilityPreferences {
  modules: Record<ModuleVisibilityKey, ModuleVisibilityLevel>
  /** Agent 游客/普通用户使用权限（管理员始终完整） */
  agentUsage: AgentUsagePreferences
}

interface ModuleVisibilityResponse {
  success: boolean
  preferences?: ModuleVisibilityPreferences
  message?: string
}

/** Keep in sync with crates/myriad-module-visibility MODULE_VISIBILITY_KEYS. */
export const MODULE_VISIBILITY_KEYS: ModuleVisibilityKey[] = [
  'library',
  'brew',
  'reports',
  'life',
  'tapp',
  'agent',
]

export const MODULE_VISIBILITY_LEVELS: ModuleVisibilityLevel[] = [
  'all',
  'authenticated',
  'admin',
]

export const AGENT_GUEST_USAGE_LEVELS: AgentGuestUsageLevel[] = [
  'none',
  'visible',
]

export const AGENT_USER_USAGE_LEVELS: AgentUserUsageLevel[] = [
  'none',
  'chat',
  'standard',
  'elevated',
]

export const MODULE_VISIBILITY_UPDATED_EVENT =
  'module-visibility-preferences-updated'

export const DEFAULT_AGENT_USAGE_PREFERENCES: AgentUsagePreferences = {
  guest: 'none',
  user: 'standard',
}

export const DEFAULT_MODULE_VISIBILITY_PREFERENCES: ModuleVisibilityPreferences =
  {
    modules: {
      library: 'all',
      brew: 'all',
      reports: 'all',
      // Retired SPA route (/life); keep key for API compatibility, hide from guests
      life: 'admin',
      tapp: 'all',
      agent: 'all',
    },
    agentUsage: { ...DEFAULT_AGENT_USAGE_PREFERENCES },
  }

function isVisibilityLevel(value: unknown): value is ModuleVisibilityLevel {
  return (
    value === 'all' || value === 'authenticated' || value === 'admin'
  )
}

function isGuestUsageLevel(value: unknown): value is AgentGuestUsageLevel {
  return value === 'none' || value === 'visible'
}

function isUserUsageLevel(value: unknown): value is AgentUserUsageLevel {
  return (
    value === 'none' ||
    value === 'chat' ||
    value === 'standard' ||
    value === 'elevated'
  )
}

export function normalizeModuleVisibilityPreferences(
  preferences?: Partial<ModuleVisibilityPreferences> & {
    agentUsage?: Partial<AgentUsagePreferences>
  },
): ModuleVisibilityPreferences {
  const usage = preferences?.agentUsage
  return {
    modules: MODULE_VISIBILITY_KEYS.reduce(
      (acc, key) => {
        const value = preferences?.modules?.[key]
        acc[key] = isVisibilityLevel(value)
          ? value
          : DEFAULT_MODULE_VISIBILITY_PREFERENCES.modules[key]
        return acc
      },
      {} as Record<ModuleVisibilityKey, ModuleVisibilityLevel>,
    ),
    agentUsage: {
      guest: isGuestUsageLevel(usage?.guest)
        ? usage.guest
        : DEFAULT_AGENT_USAGE_PREFERENCES.guest,
      user: isUserUsageLevel(usage?.user)
        ? usage.user
        : DEFAULT_AGENT_USAGE_PREFERENCES.user,
    },
  }
}

export function areModuleVisibilityPreferencesEqual(
  left: ModuleVisibilityPreferences,
  right: ModuleVisibilityPreferences,
) {
  const modulesEqual = MODULE_VISIBILITY_KEYS.every(
    (key) => left.modules[key] === right.modules[key],
  )
  return (
    modulesEqual &&
    left.agentUsage.guest === right.agentUsage.guest &&
    left.agentUsage.user === right.agentUsage.user
  )
}

export function canAccessModuleVisibility(
  visibility: ModuleVisibilityLevel,
  viewer: { isAuthenticated: boolean; isAdmin: boolean },
) {
  if (visibility === 'all') return true
  if (visibility === 'authenticated') return viewer.isAuthenticated
  return viewer.isAdmin
}

/**
 * Agent 是否应对当前观众展示/可用。
 * 综合「页面可见性」与 Tapp `ai:chat`（权限页预设模板的真相源）：
 * - 管理员：仅受可见性约束
 * - 游客：可见性允许 + guest_perm_ai_chat
 * - 普通用户：可见性允许 + user_perm_ai_chat
 *
 * 兼容：若未传入 elevatedAiChat，回退旧 agentUsage 字段（迁移期）
 */
export function canUseAgent(
  preferences: ModuleVisibilityPreferences,
  viewer: { isAuthenticated: boolean; isAdmin: boolean },
  elevatedAiChat?: { user?: boolean; guest?: boolean },
): boolean {
  if (
    !canAccessModuleVisibility(preferences.modules.agent, viewer)
  ) {
    return false
  }
  if (viewer.isAdmin) return true
  if (!viewer.isAuthenticated) {
    if (elevatedAiChat !== undefined) {
      return elevatedAiChat.guest === true
    }
    return preferences.agentUsage.guest === 'visible'
  }
  if (elevatedAiChat !== undefined) {
    return elevatedAiChat.user === true
  }
  return preferences.agentUsage.user !== 'none'
}

export function getModuleVisibilityKeyForPath(
  pathname: string,
): ModuleVisibilityKey | null {
  if (pathname === '/library' || pathname.startsWith('/library/')) {
    return 'library'
  }
  if (pathname === '/brew' || pathname.startsWith('/brew/')) {
    return 'brew'
  }
  if (pathname === '/reports' || pathname.startsWith('/reports/')) {
    return 'reports'
  }
  if (pathname === '/life' || pathname.startsWith('/life/')) {
    return 'life'
  }
  if (pathname === '/tapp' || pathname.startsWith('/tapp/')) {
    return 'tapp'
  }
  return null
}

export async function fetchModuleVisibilityPreferences() {
  // cacheTTL: 0 → 只合并并发中的重复请求（启动时多处同时读取），
  // 不缓存结果，保证每次独立读取都拿到最新偏好
  const response = await dedupedFetch(
    '/config/module-visibility',
    () =>
      apiService.get<ModuleVisibilityResponse>('/config/module-visibility'),
    { cacheTTL: 0 },
  )
  return normalizeModuleVisibilityPreferences(response.preferences)
}

export async function updateModuleVisibilityPreferences(
  preferences: ModuleVisibilityPreferences,
) {
  const normalized = normalizeModuleVisibilityPreferences(preferences)
  const response = await apiService.put<ModuleVisibilityResponse>(
    '/config/module-visibility',
    normalized,
  )
  if (!response.success) {
    throw new Error(response.message || 'Failed to save module visibility')
  }
  return normalizeModuleVisibilityPreferences(response.preferences)
}

export function dispatchModuleVisibilityPreferencesUpdated(
  preferences: ModuleVisibilityPreferences,
) {
  window.dispatchEvent(
    new CustomEvent(MODULE_VISIBILITY_UPDATED_EVENT, {
      detail: normalizeModuleVisibilityPreferences(preferences),
    }),
  )
}

export function useModuleVisibilityPreferences() {
  const [preferences, setPreferences] = useState<ModuleVisibilityPreferences>(
    DEFAULT_MODULE_VISIBILITY_PREFERENCES,
  )
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      setIsLoading(true)
      const nextPreferences = await fetchModuleVisibilityPreferences()
      setPreferences(nextPreferences)
    } catch {
      setPreferences(DEFAULT_MODULE_VISIBILITY_PREFERENCES)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()

    const handleUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ModuleVisibilityPreferences>).detail
      setPreferences(normalizeModuleVisibilityPreferences(detail))
      setIsLoading(false)
    }

    window.addEventListener(MODULE_VISIBILITY_UPDATED_EVENT, handleUpdated)
    return () => {
      window.removeEventListener(MODULE_VISIBILITY_UPDATED_EVENT, handleUpdated)
    }
  }, [reload])

  return { preferences, isLoading, reload }
}
