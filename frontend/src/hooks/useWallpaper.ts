/**
 * 壁纸管理 Hook(静态官网版)
 *
 * 数据源为 content/site.ts 的 wallpaperConfig,运行时零后端请求。
 * 保留原有视觉流程:呼吸占位 → 预加载 → 双帧渐显,并同步
 * wallpaperState 全局状态,供 AppLayout 做壁纸取色联动。
 *
 * @module useWallpaper
 */

import { useCallback } from 'react'
import { wallpaperConfig } from '../content/site'
import { loadImagePooled } from '../utils/objectPool'
import {
  effectiveWallpaperBlur,
  wallpaperState,
} from '../utils/wallpaperState'

// ============================================================================
// 类型定义
// ============================================================================

interface LoadWallpaperResult {
  /** 实际应用的壁纸 URL(加载失败时为空字符串) */
  actualUrl: string
  /** 模糊度 */
  blur: number
  /** URL 是否成功加载并应用 */
  verified: boolean
  /** Evocative 壁纸动效配置 */
  evocative: {
    parallax: boolean
    dynamicBlur: boolean
    ripple: boolean
    fps: number
    rippleQuality: number
  }
}

// ============================================================================
// 常量
// ============================================================================

/** 图片加载超时时间 */
const IMAGE_LOAD_TIMEOUT = 15000

/** 壁纸元素ID */
const WALLPAPER_ELEMENT_ID = 'wallpaper'

// ============================================================================
// 工具函数
// ============================================================================

function setWallpaperAwaiting(active: boolean) {
  const bg = document.getElementById('bg-container')
  if (!bg) return
  bg.classList.toggle('wallpaper-awaiting', active)
}

/**
 * 应用壁纸到 DOM 并更新全局状态
 * 首次加载:预加载完成后双帧渐显,背景层用呼吸占位避免白屏突兀。
 * @returns 成功返回图片 URL,失败返回 null
 */
async function applyWallpaperToDOM(
  imageUrl: string,
  blur: number,
): Promise<string | null> {
  const wallpaperEl = document.getElementById(WALLPAPER_ELEMENT_ID)
  if (!wallpaperEl) {
    console.warn('壁纸元素不存在')
    return null
  }

  // 标记加载状态 + 呼吸占位
  wallpaperState.setLoading(true)
  setWallpaperAwaiting(true)
  wallpaperEl.classList.remove('wallpaper-visible')

  try {
    // 预加载图片(使用对象池)
    const loaded = await loadImagePooled(imageUrl, {
      timeout: IMAGE_LOAD_TIMEOUT,
    })
    if (!loaded) {
      wallpaperState.setError('图片加载失败')
      return null
    }

    // 应用到 DOM(先不可见,再渐显)
    wallpaperEl.style.backgroundImage = `url(${imageUrl})`
    wallpaperEl.style.filter = `blur(${effectiveWallpaperBlur(blur)}px)`

    // 更新全局状态
    wallpaperState.updateState(imageUrl, blur)

    // 等两帧再淡入,保证 background-image 已提交绘制
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    wallpaperEl.classList.add('wallpaper-visible')
    setWallpaperAwaiting(false)

    return imageUrl
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    wallpaperState.setError(message)
    return null
  } finally {
    wallpaperState.setLoading(false)
    // 首屏加载失败时保持呼吸占位
    if (!wallpaperEl.classList.contains('wallpaper-visible')) {
      setWallpaperAwaiting(true)
    }
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

/**
 * 壁纸管理 Hook
 * 返回 loadWallpaper:从静态配置读取壁纸并应用,附带 Evocative 动效配置。
 */
export function useWallpaper() {
  const loadWallpaper =
    useCallback(async (): Promise<LoadWallpaperResult | null> => {
      const evocative = {
        parallax: wallpaperConfig.evocative.parallax,
        dynamicBlur: wallpaperConfig.evocative.dynamicBlur,
        ripple: wallpaperConfig.evocative.ripple,
        fps: wallpaperConfig.evocative.fps,
        rippleQuality: wallpaperConfig.evocative.rippleQuality,
      }
      const blur = wallpaperConfig.blur

      // 未配置壁纸:仅返回动效开关,背景保持纯色 + 渐变
      if (!wallpaperConfig.url) {
        return { actualUrl: '', blur, verified: false, evocative }
      }

      const appliedUrl = await applyWallpaperToDOM(wallpaperConfig.url, blur)
      return {
        actualUrl: appliedUrl ?? '',
        blur,
        verified: appliedUrl !== null,
        evocative,
      }
    }, [])

  return { loadWallpaper }
}

export default useWallpaper
