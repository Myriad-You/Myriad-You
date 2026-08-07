/**
 * 导航岛自动隐藏 Hook
 * 管理滚动隐藏、鼠标边缘唤回、无操作超时、响应式断点等行为
 */

import { useEffect } from 'react'

const INACTIVITY_DELAY = 5000
const SCROLL_THRESHOLD = 50
const PAGE_TOP_THRESHOLD = 100
const EDGE_THRESHOLD = 100

const TRANSFORM_SHOW_DESKTOP = 'translateY(-50%)'
const TRANSFORM_SHOW_MOBILE = 'translateX(-50%)'
const TRANSFORM_HIDE_DESKTOP = 'translateY(-50%) translateX(-20px)'
const TRANSFORM_HIDE_MOBILE = 'translateX(-50%) translateY(20px)'

export function useNavAutoHide(selector = '.nav-container') {
  useEffect(() => {
    const navContainer = document.querySelector(selector) as HTMLElement
    if (!navContainer) return

    // ===== 状态 =====
    let lastScrollY = window.scrollY
    let rafId = 0
    let inactivityTimeoutId = 0
    let isHovering = false
    let isNavVisible = true
    let hiddenByScroll = false
    let cachedIsDesktop = window.innerWidth >= 768
    let cachedWindowHeight = window.innerHeight

    // ===== CSS 样式应用 =====
    // transition 只设一次，后续切换只修改变化的属性，避免 cssText 全量重写触发样式重算
    navContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease'

    const applyVisibility = (visible: boolean) => {
      const transform = visible
        ? cachedIsDesktop
          ? TRANSFORM_SHOW_DESKTOP
          : TRANSFORM_SHOW_MOBILE
        : cachedIsDesktop
          ? TRANSFORM_HIDE_DESKTOP
          : TRANSFORM_HIDE_MOBILE

      navContainer.style.opacity = visible ? '1' : '0'
      navContainer.style.transform = transform
      navContainer.style.pointerEvents = visible ? 'auto' : 'none'
    }

    // ===== 核心显示/隐藏 =====
    const showNav = () => {
      if (isNavVisible) return
      isNavVisible = true
      hiddenByScroll = false
      applyVisibility(true)
    }

    const hideNav = () => {
      if (!isNavVisible || isHovering) return
      isNavVisible = false
      applyVisibility(false)
    }

    const hideNavByScroll = () => {
      if (!isNavVisible || isHovering) return
      isNavVisible = false
      hiddenByScroll = true
      applyVisibility(false)
    }

    // ===== 无操作计时器 =====
    const clearInactivityTimer = () => {
      if (inactivityTimeoutId) {
        clearTimeout(inactivityTimeoutId)
        inactivityTimeoutId = 0
      }
    }

    const startInactivityTimer = () => {
      clearInactivityTimer()
      if (isNavVisible) {
        inactivityTimeoutId = window.setTimeout(hideNav, INACTIVITY_DELAY)
      }
    }

    // ===== 滚动处理 =====
    const processScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY
      const isDown = delta > 0

      if (
        isDown &&
        delta > SCROLL_THRESHOLD &&
        currentScrollY > PAGE_TOP_THRESHOLD
      ) {
        clearInactivityTimer()
        hideNavByScroll()
      } else if (!isDown || currentScrollY < PAGE_TOP_THRESHOLD) {
        showNav()
        startInactivityTimer()
      }

      lastScrollY = currentScrollY
      rafId = 0
    }

    const handleScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(processScroll)
      }
    }

    // ===== 鼠标移动处理 =====
    let pendingMouseMove: MouseEvent | null = null
    let mouseRafId = 0

    const processMouseMove = () => {
      if (!pendingMouseMove) return
      const e = pendingMouseMove
      pendingMouseMove = null
      mouseRafId = 0

      const isNearEdge = cachedIsDesktop
        ? e.clientX < EDGE_THRESHOLD
        : e.clientY > cachedWindowHeight - EDGE_THRESHOLD

      if (isNearEdge) {
        showNav()
        startInactivityTimer()
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      pendingMouseMove = e
      if (!mouseRafId) {
        mouseRafId = requestAnimationFrame(processMouseMove)
      }
    }

    // ===== 交互处理 =====
    const handleInteraction = () => {
      if (!hiddenByScroll) {
        showNav()
        startInactivityTimer()
      }
    }

    // ===== 导航岛悬停 =====
    const handleNavEnter = () => {
      isHovering = true
      clearInactivityTimer()
      showNav()
    }

    const handleNavLeave = () => {
      isHovering = false
      startInactivityTimer()
    }

    // ===== 响应式处理 =====
    const mediaQuery = window.matchMedia('(min-width: 768px)')
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      cachedIsDesktop = e.matches
      if (isNavVisible) {
        applyVisibility(true)
      }
    }

    const handleResize = () => {
      cachedWindowHeight = window.innerHeight
    }

    // ===== 初始化 & 事件注册 =====
    applyVisibility(true)

    const controller = new AbortController()
    const { signal } = controller
    const passive = { passive: true, signal }

    window.addEventListener('scroll', handleScroll, passive)
    window.addEventListener('mousemove', handleMouseMove, passive)
    window.addEventListener('keydown', handleInteraction, passive)
    window.addEventListener('click', handleInteraction, passive)
    window.addEventListener('touchstart', handleInteraction, passive)
    window.addEventListener('resize', handleResize, passive)
    navContainer.addEventListener('mouseenter', handleNavEnter, { signal })
    navContainer.addEventListener('mouseleave', handleNavLeave, { signal })
    mediaQuery.addEventListener('change', handleMediaChange, { signal })

    handleMediaChange(mediaQuery)
    startInactivityTimer()

    return () => {
      controller.abort()
      if (rafId) cancelAnimationFrame(rafId)
      if (mouseRafId) cancelAnimationFrame(mouseRafId)
      clearInactivityTimer()
    }
  }, [selector])
}
