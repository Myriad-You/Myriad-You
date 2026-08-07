/**
 * 导航上下文 - 支持页面声明式二级导航
 *
 * 设计理念：
 * - 一级导航（主导航按钮）由 AppLayout 统一管理
 * - 二级导航（筛选、标签等）由各页面声明
 * - 支持动画过渡和状态同步
 */

import type { ReactNode } from 'react'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// 二级导航项配置
export interface SecondaryNavItem {
  id: string
  icon: ReactNode
  label: string
  title?: string
  ariaLabel?: string
}

// 二级导航配置
export interface SecondaryNavConfig {
  /** 唯一标识符，对应路由路径 */
  routePath: string
  /** 导航项列表 */
  items: SecondaryNavItem[]
  /** 当前选中的项 ID */
  activeId: string
  /** 选中项变化回调 */
  onChange: (id: string) => void
  /** 是否展开二级导航 */
  expanded: boolean
  /** 展开/收起切换回调 */
  onToggleExpand: () => void
  /** 展开按钮的提示文案 */
  expandHint?: string
}

// 导航上下文值
interface NavigationContextValue {
  /** 当前注册的二级导航配置 */
  secondaryNav: SecondaryNavConfig | null
  /** 注册二级导航（页面调用） */
  registerSecondaryNav: (config: SecondaryNavConfig) => void
  /** 注销二级导航（页面卸载时调用） */
  unregisterSecondaryNav: (routePath: string) => void
  /** 更新二级导航状态 */
  updateSecondaryNav: (
    updates: Partial<Pick<SecondaryNavConfig, 'activeId' | 'expanded'>>,
  ) => void
  /** 动画状态 */
  isAnimating: boolean
  /** 设置动画状态 */
  setIsAnimating: (value: boolean) => void
  /** 渲染模式引用（用于动画期间锁定渲染） */
  renderModeRef: React.RefObject<'normal' | 'secondary'>
  /** 沉浸模式（隐藏导航岛和控制面板） */
  immersiveMode: boolean
  /** 设置沉浸模式 */
  setImmersiveMode: (value: boolean) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [secondaryNav, setSecondaryNav] = useState<SecondaryNavConfig | null>(
    null,
  )
  const [isAnimating, setIsAnimating] = useState(false)
  const [immersiveMode, setImmersiveMode] = useState(false)
  const renderModeRef = useRef<'normal' | 'secondary'>('normal')

  // 注册二级导航
  const registerSecondaryNav = useCallback((config: SecondaryNavConfig) => {
    setSecondaryNav(config)
  }, [])

  // 注销二级导航（导航到子路由时保留，避免二级导航闪烁消失）
  const unregisterSecondaryNav = useCallback((routePath: string) => {
    setSecondaryNav((prev) => {
      if (prev?.routePath === routePath) {
        // 如果当前在子路由（如 /brew/item/xxx），保留二级导航
        if (window.location.pathname.startsWith(`${routePath}/`)) {
          return prev
        }
        return null
      }
      return prev
    })
  }, [])

  // 更新二级导航状态
  const updateSecondaryNav = useCallback(
    (updates: Partial<Pick<SecondaryNavConfig, 'activeId' | 'expanded'>>) => {
      setSecondaryNav((prev) => {
        if (!prev) return null
        return { ...prev, ...updates }
      })
    },
    [],
  )

  const value = useMemo(
    () => ({
      secondaryNav,
      registerSecondaryNav,
      unregisterSecondaryNav,
      updateSecondaryNav,
      isAnimating,
      setIsAnimating,
      renderModeRef,
      immersiveMode,
      setImmersiveMode,
    }),
    [
      secondaryNav,
      registerSecondaryNav,
      unregisterSecondaryNav,
      updateSecondaryNav,
      isAnimating,
      immersiveMode,
    ],
  )

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  )
}

// Hook：使用导航上下文
export function useNavigation() {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}

// Hook：页面声明二级导航
export function useSecondaryNav(config: {
  routePath: string
  items: SecondaryNavItem[]
  defaultActiveId: string
  /** 展开按钮的提示文案 */
  expandHint?: string
}) {
  const {
    secondaryNav,
    registerSecondaryNav,
    unregisterSecondaryNav,
    updateSecondaryNav,
  } = useNavigation()
  // 如果已有相同 routePath 的二级导航（从子路由返回/进入时保留的），复用其 activeId 和 expanded
  const isSameGroup = secondaryNav?.routePath === config.routePath
  const existingActiveId = isSameGroup ? secondaryNav.activeId : null
  const existingExpanded = isSameGroup
    ? (secondaryNav.expanded ?? false)
    : false
  const [activeId, setActiveIdLocal] = useState(
    existingActiveId ?? config.defaultActiveId,
  )
  const [expanded, setExpandedLocal] = useState(existingExpanded)

  // 用 ref 追踪当前值，避免在 state updater 内部调用 updateSecondaryNav
  // （在 updater 中调用另一个组件的 setState 会触发 React 18 的 "setState during render" 警告）
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  const expandedRef = useRef(expanded)
  expandedRef.current = expanded

  // 同步包装：状态变更同步更新到 Context，消除 effect 延迟造成的一帧闪烁
  const setActiveId = useCallback(
    (value: string | ((prev: string) => string)) => {
      const next =
        typeof value === 'function' ? value(activeIdRef.current) : value
      setActiveIdLocal(next)
      updateSecondaryNav({ activeId: next })
    },
    [updateSecondaryNav],
  )

  const setExpanded = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const next =
        typeof value === 'function' ? value(expandedRef.current) : value
      setExpandedLocal(next)
      updateSecondaryNav({ expanded: next })
    },
    [updateSecondaryNav],
  )

  // 选中项变化处理（由导航岛的按钮点击触发）
  const handleChange = useCallback(
    (id: string) => {
      setActiveId(id)
    },
    [setActiveId],
  )

  // 展开/收起切换（由导航岛的 handleExpand/handleCollapse 触发）
  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [setExpanded])

  // 用 ref 保持回调引用稳定，避免注册 effect 因回调变化而重跑
  const handleChangeRef = useRef(handleChange)
  handleChangeRef.current = handleChange
  const handleToggleExpandRef = useRef(handleToggleExpand)
  handleToggleExpandRef.current = handleToggleExpand

  // 注册/注销 — 仅在路由路径或导航项结构变化时执行
  useEffect(() => {
    registerSecondaryNav({
      routePath: config.routePath,
      items: config.items,
      activeId,
      onChange: (id: string) => handleChangeRef.current(id),
      expanded,
      onToggleExpand: () => handleToggleExpandRef.current(),
      expandHint: config.expandHint,
    })

    return () => {
      unregisterSecondaryNav(config.routePath)
    }
  }, [
    config.routePath,
    config.items,
    config.expandHint,
    registerSecondaryNav,
    unregisterSecondaryNav,
  ])

  return {
    activeId,
    setActiveId,
    expanded,
    setExpanded,
    toggleExpand: handleToggleExpand,
  }
}
