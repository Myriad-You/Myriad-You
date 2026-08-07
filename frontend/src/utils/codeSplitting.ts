/**
 * 代码分割配置
 * React.lazy() 动态导入优化
 */

import type { ComponentType } from 'react'
import { lazy } from 'react'

/**
 * 带加载状态的懒加载组件
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  const Component = lazy(factory)

  // 添加preload方法
  ;(Component as any).preload = factory

  return Component
}

/**
 * 预加载多个路由组件
 */
export function preloadRoutes(routes: string[]): void {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection

  // PageSpeed 的移动端基准会模拟慢网络。省流量或 2G 下不用
  // 非当前路由占用带宽，正常网络仍保留原有预取体验。
  if (
    connection?.saveData ||
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g'
  ) {
    return
  }

  // 使用requestIdleCallback在空闲时预加载
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      routes.forEach((route) => {
        const component = routeComponents[route as keyof typeof routeComponents]
        if (component && (component as any).preload) {
          ;(component as any).preload()
        }
      })
    })
  }
}

/**
 * 路由组件懒加载配置
 */
export const routeComponents = {
  // 首页 - 关键路径,预加载
  home: lazyWithPreload(() => import('../views/Home')),

  // Library - 数据展示页
  library: lazyWithPreload(() => import('../views/Library')),

  // Config - 配置页
  config: lazyWithPreload(() => import('../views/Config')),

  // Setup - 设置向导
  setup: lazyWithPreload(() => import('../views/Setup')),

  // Login - 登录页
  login: lazyWithPreload(() => import('../views/Login')),
}

/**
 * 预加载关键路由
 */
export function preloadCriticalRoutes(): void {
  // 首页加载后预加载Library和Config
  preloadRoutes(['library', 'config'])
}

/**
 * 动态导入CSS
 */
export async function loadCSS(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = reject
    document.head.appendChild(link)
  })
}

/**
 * 动态导入JS
 */
export async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = reject
    document.body.appendChild(script)
  })
}

/**
 * Chunk命名策略配置(在vite.config中使用)
 */
export const chunkStrategy = {
  // 大型依赖单独打包
  vendor: ['react', 'react-dom', 'react-router-dom'],

  // 图表库单独打包
  charts: ['recharts'],

  // UI组件库
  ui: ['motion'],

  // 工具库
  utils: ['date-fns', 'lodash-es'],
}
