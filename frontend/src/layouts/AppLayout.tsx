/**
 * React 版主布局组件(静态官网版)
 * 包含全局控制栏(语言/主题)、壁纸背景层、表面主题应用器、站点页脚。
 * 无后端健康检查、无设置弹窗单例、无导航岛。
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import GlobalControlPanel from '../components/GlobalControlPanel'
import { SiteFooter } from '../components/SiteFooter'
import { SurfaceThemeApplier } from '../components/SurfaceThemeApplier'
import { ToastContainer } from '../components/ToastContainer'

import {
  isExlight,
  isReducedAnimation,
  useAnimationLevel,
} from '../hooks/useAnimationLevel'
import { useEvocativeWallpaper } from '../hooks/useEvocativeWallpaper'
import { useScrollOptimization } from '../hooks/useScrollOptimization'
import { useWallpaper } from '../hooks/useWallpaper'
import { ensureCfgAccentSync } from '../utils/cfgAccent'
import {
  applyColorPalette,
  extractColorsFromImage,
} from '../utils/colorExtractor'
import { startFpsMonitor, stopFpsMonitor } from '../utils/performance'
import {
  getColorFromCache,
  saveColorToCache,
  shouldApplyColorExtraction,
} from '../utils/wallpaperColorCache'
import { wallpaperState } from '../utils/wallpaperState'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  // ℹ️ 性能优化: 移动端/低端设备禁用背景动画
  const anim = useAnimationLevel()

  // 🔧 帧率优化：启用滚动优化和 FPS 监控
  useScrollOptimization({ enabled: true })

  // 启动/停止 FPS 监控
  useEffect(() => {
    startFpsMonitor()
    return () => stopFpsMonitor()
  }, [])

  // 设置强调色 --cfg-accent：与 Hero adaptive 同源，随主题/壁纸重算
  useEffect(() => {
    ensureCfgAccentSync()
  }, [])

  // 壁纸管理 Hook(本地静态配置)
  const { loadWallpaper: loadWallpaperFromHook } = useWallpaper()

  // Evocative 壁纸动效配置状态（合并为单一对象，减少 hook 开销）
  const [evocativeConfig, setEvocativeConfig] = useState({
    parallax: true,
    dynamicBlur: false,
    ripple: false,
    fps: 30,
    rippleQuality: 0.85,
    blur: 3,
  })

  // 🎨 Evocative 壁纸动效统一 Hook
  // 仅 exlight / prefers-reduced-motion 强制关；light 档仍尊重用户开关
  const evocativeForceOff = isExlight(anim)
  useEvocativeWallpaper('wallpaper', {
    parallax: {
      enabled: evocativeConfig.parallax && !evocativeForceOff,
      enableGyroscope: true,
      enableMouse: true,
      maxOffset: 8,
      scale: 1.02,
    },
    dynamicBlur: {
      enabled: evocativeConfig.dynamicBlur && !evocativeForceOff,
      baseBlur: evocativeConfig.blur,
      unblurZone: 0.4,
      blurZone: 0.6,
    },
    ripple: {
      enabled: evocativeConfig.ripple && !evocativeForceOff,
    },
    // light 档略降帧率/画质，减轻中档机负担但仍可感知动效
    fps: evocativeForceOff
      ? 30
      : isReducedAnimation(anim)
        ? Math.min(evocativeConfig.fps, 30)
        : evocativeConfig.fps,
    rippleQuality: evocativeForceOff
      ? 0.5
      : isReducedAnimation(anim)
        ? Math.min(evocativeConfig.rippleQuality, 0.7)
        : evocativeConfig.rippleQuality,
  })

  // 🎨 壁纸颜色提取 —— 缓存 → 验证 → 提取 → 应用
  const extractAndApplyColors = useCallback(async (url: string) => {
    if (!wallpaperState.isUrlActive(url)) return

    // 先检查缓存
    const cachedColors = getColorFromCache(url)
    if (cachedColors) {
      if (wallpaperState.isUrlActive(url)) applyColorPalette(cachedColors)
      return
    }

    // 检查是否为有效壁纸（包含一致性验证）
    const checkResult = await shouldApplyColorExtraction(url)
    if (!checkResult.shouldApply) return

    try {
      const colors = await extractColorsFromImage(url, {
        context: 'wallpaper',
      })
      if (wallpaperState.isUrlActive(url)) {
        applyColorPalette(colors)
        saveColorToCache(url, colors)
      }
    } catch (error) {
      console.error('颜色提取失败:', error)
    }
  }, [])

  // 加载壁纸和颜色（使用 Hook）
  const loadWallpaper = useCallback(async () => {
    const wallpaperResult = await loadWallpaperFromHook()
    if (!wallpaperResult) return

    // 更新 Evocative 动效配置（与壁纸图是否加载成功解耦）
    const ev = wallpaperResult.evocative
    setEvocativeConfig({
      parallax: ev?.parallax ?? true,
      dynamicBlur: ev?.dynamicBlur ?? false,
      ripple: ev?.ripple ?? false,
      fps: ev?.fps ?? 30,
      rippleQuality: ev?.rippleQuality ?? 0.85,
      blur: wallpaperResult.blur,
    })

    if (wallpaperResult.actualUrl) {
      await extractAndApplyColors(wallpaperResult.actualUrl)
    }
  }, [loadWallpaperFromHook, extractAndApplyColors])

  // 初始化：加载壁纸（仅首次挂载执行）
  // 先挂上呼吸占位，等图片预加载完成后再渐显壁纸（见 useWallpaper.applyWallpaperToDOM）
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    // 防止重复初始化
    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    // 首次进入：若壁纸尚未可见，挂上呼吸占位（勿写进 React className）
    const bg = document.getElementById('bg-container')
    const wallpaperEl = document.getElementById('wallpaper')
    if (
      bg &&
      wallpaperEl &&
      !wallpaperEl.classList.contains('wallpaper-visible')
    ) {
      bg.classList.add('wallpaper-awaiting')
    }

    console.debug('[AppLayout] Initializing wallpaper load...')
    ;(async () => {
      try {
        await loadWallpaper()
        console.debug('[AppLayout] Wallpaper load completed')
      } catch (error) {
        console.error('[AppLayout] Wallpaper load failed:', error)
      }
    })()
  }, [])

  return (
    <>
      {/* 表面主题应用器：全站写入 html[data-surface]，渲染 null */}
      <SurfaceThemeApplier />

      {/* 全局控制栏(语言/主题)
          relative z-9999：抬到 host chrome 顶层 stacking context */}
      <div id="global-control-panel-root" className="relative z-9999">
        <GlobalControlPanel />
      </div>

      {/* 背景层叠（勿给 #wallpaper 设 z-index，否则会盖住涟漪 canvas 与 #bg-gradient 底部遮罩）：
          呼吸占位 → 壁纸 → 涟漪(JS insert) → 底部渐变遮罩 → 网格
          wallpaper-awaiting 仅由 useWallpaper JS 切换，不要写死在 className（避免 re-render 盖掉） */}
      <div
        id="bg-container"
        className="fixed inset-0 -z-10 overflow-hidden"
      >
        {/* 首次加载呼吸占位：独立层，z-0，不占 ::before/::after */}
        <div
          id="wallpaper-awaiting-fx"
          className="pointer-events-none absolute inset-0 z-0"
          aria-hidden="true"
        />
        <div
          id="wallpaper"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        ></div>
        <div
          id="bg-gradient"
          className="pointer-events-none absolute inset-0 z-[2] bg-linear-to-b from-transparent from-35% via-white/40 via-55% to-white/90 to-85% transition-opacity duration-500 ease-out"
        ></div>
        {!isExlight(anim) && (
          <div className="pointer-events-none absolute inset-0 z-[3] bg-grid-pattern opacity-[0.02]"></div>
        )}
      </div>

      {/* 全局 Toast 通知 */}
      <ToastContainer />

      {/* 主内容区域 */}
      <main className="relative z-10">{children}</main>

      {/* 站点底部信息(单页官网,始终按首页模式渲染) */}
      <SiteFooter isHomePage />
    </>
  )
}

export default AppLayout
