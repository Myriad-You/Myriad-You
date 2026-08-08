/**
 * 主应用入口 —— 静态单页官网
 *
 * 无路由、无后端:只渲染 AppLayout > Home。
 * Providers 精简到首页/小组件实际需要的两个:
 * - I18nProvider(小组件内部大量使用 t())
 * - AnimationPreferenceProvider(动效分级)
 */

import { useEffect } from 'react'
import CustomScrollbar from './components/CustomScrollbar'
import { AnimationPreferenceProvider } from './contexts/AnimationPreferenceContext'
import { I18nProvider } from './contexts/I18nContext'
import { AppLayout } from './layouts/AppLayout'
import Home from './views/Home'
import './styles/fonts.css'
import './styles/theme.css'
import './styles/animations.css'
import './styles/page-transitions.css'
import './styles/utility.css'
import './styles/modals.css'
import './styles/overrides.css'
import './styles/performance.css'

export function App() {
  // 在 React 应用挂载完成后标记就绪状态(双帧延迟确保基础布局已渲染)
  useEffect(() => {
    let innerRafId: number | null = null
    const rafId = requestAnimationFrame(() => {
      innerRafId = requestAnimationFrame(() => {
        // 通知 PageLoader 应用已就绪
        if ((window as any).pageLoader) {
          ;(window as any).pageLoader.markAppReady()
        }
      })
    })

    return () => {
      cancelAnimationFrame(rafId)
      if (innerRafId !== null) cancelAnimationFrame(innerRafId)
    }
  }, [])

  return (
    <I18nProvider>
      <AnimationPreferenceProvider>
        <CustomScrollbar />
        <AppLayout>
          <Home />
        </AppLayout>
      </AnimationPreferenceProvider>
    </I18nProvider>
  )
}

export default App
