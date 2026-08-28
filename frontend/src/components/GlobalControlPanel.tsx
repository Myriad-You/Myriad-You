/**
 * 全局控制面板(静态官网精简版)- Apple 风格智能岛
 *
 * 从原 GlobalControlPanel 剥离,仅保留两项功能:
 * - 语言切换(zh-CN / en-US / ja-JP,走 I18nContext)
 * - 主题切换(浅色 / 深色 / 跟随系统 循环)
 *
 * 收起态保留原视觉:轮播问候语 / 天气 / 一言动态内容,
 * 数据全部来自无后端的公共 API(utils/weather.ts、utils/quote.ts)。
 * 已移除:音乐播放器、通知中心、用户/登录区、壁纸切换、系统配置入口。
 */

import type { CSSProperties } from 'react'
import type { QuoteData } from '../utils/quote'
import type { WeatherData } from '../utils/weather'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { siteName } from '../content/site'
import { useI18n } from '../contexts/I18nContext'
import { useAnimationLevel } from '../hooks/useAnimationLevel'
import { usePerformanceProfile } from '../hooks/usePerformanceProfile'
import { getGreeting, getRandomQuote } from '../utils/dynamicContent'
import { useThemeMode } from '../utils/themeSubscriber'
import { getWeatherInfo, WEATHER_ICON_ASSETS } from '../utils/weather'
import {
  initialPanelState,
  isPanelMorphing,
  isPanelOpen,
  panelReducer,
  resolvePanelMotion,
  settleTimeoutMs,
  showsDynamicContent,
  showsOverlay,
  showsOverlayBlur,
  showsPanelContent,
} from './ControlPanel/panelTransition'
import { WeatherAssetIcon } from './weather/WeatherAssetIcon'
import './GlobalControlPanel.css'

/** 与 CSS `@media (hover: hover)` 同一套：只认鼠标，避免触屏粘滞 hover。 */
function isHoverCapablePointer(pointerType: string): boolean {
  return pointerType === 'mouse'
}

// ============================================================================
// 图标资源(public/ 静态资源)
// ============================================================================

const GREETING_ICON_ASSETS = {
  sunrise: '/icons/greeting/sunrise.webp',
  sun: WEATHER_ICON_ASSETS.sunny,
  cloudSun: WEATHER_ICON_ASSETS.partlyCloudy,
  sunset: '/icons/greeting/sunset.webp',
  moon: '/icons/greeting/night.webp',
} as const

const CONTROL_PANEL_ICON_ASSETS = {
  appearanceLight: WEATHER_ICON_ASSETS.sunny,
  appearanceDark: GREETING_ICON_ASSETS.moon,
  language: '/icons/control-panel/language.webp',
} as const

const DYNAMIC_ICON_ASSETS = {
  quote: '/icons/dynamic/quote.webp',
} as const

// ============================================================================
// 主题切换(与原组件一致的循环逻辑)
// ============================================================================

/** 外观偏好:浅色 / 深色 / 跟随系统 */
type ThemePreference = 'light' | 'dark' | 'auto'

const THEME_CYCLE: ThemePreference[] = ['light', 'dark', 'auto']

function getStoredThemePreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'auto'
  const stored = localStorage.getItem('theme')
  return stored === 'light' || stored === 'dark' ? stored : 'auto'
}

/** 应用主题 class 并同步 meta theme-color */
function applyThemeClass(dark: boolean) {
  const html = document.documentElement
  if (dark) {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }

  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    const primaryColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#94a3b8'
    metaThemeColor.setAttribute('content', primaryColor)
  }
}

function resolveDark(preference: ThemePreference): boolean {
  if (preference === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return preference === 'dark'
}

// ============================================================================
// 动态内容
// ============================================================================

type DynamicContentType = 'greeting' | 'weather' | 'quote'

interface DynamicContent {
  type: DynamicContentType
  icon: React.ReactNode
  text: string
  subtext?: string
  showSubtext?: boolean
}

const GlobalControlPanel: React.FC = () => {
  const { locale, setLocale, t } = useI18n()
  const isDark = useThemeMode()
  const anim = useAnimationLevel()
  const perf = usePerformanceProfile()

  const [panel, dispatchPanel] = useReducer(panelReducer, initialPanelState)
  const [isHovering, setIsHovering] = useState(false)
  const isExpandedRef = useRef(false)
  const morphingRef = useRef(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const expandedContentRef = useRef<HTMLDivElement>(null)

  const motion = useMemo(
    () =>
      resolvePanelMotion({
        level: anim.level,
        reduceMotion: perf.reduceMotion,
        isMobile: perf.isMobile,
      }),
    [anim.level, perf.reduceMotion, perf.isMobile],
  )
  const [activeMotion, setActiveMotion] = useState(motion)
  useEffect(() => {
    if (!isPanelMorphing(panel)) setActiveMotion(motion)
  }, [motion, panel.phase])
  const motionRef = useRef(activeMotion)
  useLayoutEffect(() => {
    motionRef.current = activeMotion
  }, [activeMotion])
  const motionVars = useMemo(
    () => ({ '--gcp-morph': `${activeMotion.morphMs}ms` }) as CSSProperties,
    [activeMotion],
  )

  const isExpanded = isPanelOpen(panel)
  const showPanelContent = showsPanelContent(panel)
  const showDynamicContent = showsDynamicContent(panel)
  const showOverlay = showsOverlay(panel)

  useLayoutEffect(() => {
    isExpandedRef.current = isExpanded
    morphingRef.current = isPanelMorphing(panel)
  }, [isExpanded, panel.phase])

  // ─── 动态轮播内容 ───
  const [dynamicContents, setDynamicContents] = useState<DynamicContent[]>([])
  const [currentContentIndex, setCurrentContentIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [quoteData, setQuoteData] = useState<QuoteData | null>(null)

  // ─── 主题 ───
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    getStoredThemePreference,
  )

  const cycleTheme = useCallback(() => {
    const next =
      THEME_CYCLE[
        (THEME_CYCLE.indexOf(themePreference) + 1) % THEME_CYCLE.length
      ]
    setThemePreference(next)
    localStorage.setItem('theme', next)
    applyThemeClass(resolveDark(next))
  }, [themePreference])

  // 跟随系统主题(auto 档):系统外观变化时无需手动处理,
  // index.astro 的主题脚本已监听 matchMedia 并切换 class,
  // useThemeMode 订阅 class 变化自动更新图标。

  // ─── 天气文本翻译辅助 ───
  const getWeatherText = useCallback(
    (code: number): string => {
      const weatherT = t.weather ?? {}
      if (code === 0 || code === 1) return weatherT.sunny ?? 'Sunny'
      if (code === 2 || code === 3) return weatherT.cloudy ?? 'Cloudy'
      if (code === 45 || code === 48) return weatherT.foggy ?? 'Foggy'
      if (code >= 51 && code <= 67) return weatherT.rainy ?? 'Rainy'
      if (code >= 80 && code <= 82) return weatherT.rainy ?? 'Rainy'
      if (code >= 71 && code <= 77) return weatherT.snowy ?? 'Snowy'
      if (code >= 85 && code <= 86) return weatherT.snowy ?? 'Snowy'
      if (code >= 95 && code <= 99)
        return weatherT.thunderstorm ?? 'Thunderstorm'
      return weatherT.unavailable ?? 'Unknown'
    },
    [t.weather],
  )

  const renderAssetIcon = useCallback(
    (icon: string) => (
      <WeatherAssetIcon
        icon={icon}
        className="h-6 w-6 object-contain drop-shadow-sm"
        fallbackClassName="dynamic-icon-emoji"
      />
    ),
    [],
  )

  // ─── 构建动态内容(问候语 + 天气 + 一言,全部零后端) ───
  const loadDynamicContents = useCallback(() => {
    const contents: DynamicContent[] = []

    // 1. 问候语(始终显示)
    const greetingTranslations = {
      morning: t.greeting?.morning ?? 'Good morning',
      forenoon: t.greeting?.forenoon ?? t.greeting?.morning ?? 'Good morning',
      noon: t.greeting?.noon ?? 'Good afternoon',
      afternoon: t.greeting?.afternoon ?? 'Good afternoon',
      dusk: t.greeting?.dusk ?? t.greeting?.evening ?? 'Good evening',
      evening: t.greeting?.evening ?? 'Good evening',
      night: t.greeting?.night ?? 'Good night',
    }
    const greeting = getGreeting(undefined, greetingTranslations, locale)
    const greetingIcon =
      greeting.icon === 'sunrise'
        ? GREETING_ICON_ASSETS.sunrise
        : greeting.icon === 'sunset'
          ? GREETING_ICON_ASSETS.sunset
          : greeting.icon === 'moon'
            ? GREETING_ICON_ASSETS.moon
            : greeting.icon === 'cloud-sun'
              ? GREETING_ICON_ASSETS.cloudSun
              : GREETING_ICON_ASSETS.sun
    contents.push({
      type: 'greeting',
      icon: renderAssetIcon(greetingIcon),
      text: greeting.text || greetingTranslations.afternoon,
      subtext: greeting.time,
    })

    // 2. 天气(使用已缓存数据,首次加载由下方 effect 触发)
    if (weatherData) {
      contents.push({
        type: 'weather',
        icon: renderAssetIcon(weatherData.icon),
        text: `${weatherData.temperature} ${getWeatherText(weatherData.weatherCode)}`,
        subtext: weatherData.city || undefined,
        showSubtext: true,
      })
    }

    // 3. 一言
    if (quoteData) {
      contents.push({
        type: 'quote',
        icon: renderAssetIcon(DYNAMIC_ICON_ASSETS.quote),
        text: quoteData.text,
        subtext: quoteData.author || undefined,
        showSubtext: false,
      })
    }

    setDynamicContents(contents)
  }, [t, locale, weatherData, quoteData, getWeatherText, renderAssetIcon])

  useEffect(() => {
    loadDynamicContents()
  }, [loadDynamicContents])

  // 首次加载天气 / 一言(失败后静默,轮播只剩问候语)
  useEffect(() => {
    let cancelled = false
    void getWeatherInfo()
      .then((weather) => {
        if (!cancelled && weather) setWeatherData(weather)
      })
      .catch(() => {})
    void getRandomQuote(locale)
      .then((quote) => {
        if (!cancelled && quote?.text) setQuoteData(quote)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // 仅首次挂载加载;语言切换由 loadDynamicContents 重新翻译问候语/天气文本
  }, [])

  // ─── 动态内容轮播(淡入淡出;展开/悬停/页面隐藏时暂停) ───
  const validContents = dynamicContents.filter((c) => c.text)

  useEffect(() => {
    if (validContents.length > 0 && currentContentIndex >= validContents.length) {
      setCurrentContentIndex(0)
    }
  }, [validContents.length, currentContentIndex])

  useEffect(() => {
    if (validContents.length === 0 || isExpanded || isHovering) {
      setIsTransitioning(false)
      return
    }

    let cycleTimerId: number | null = null
    let swapTimerId: number | null = null
    let revealTimerId: number | null = null
    let cancelled = false

    const clearTimers = () => {
      if (cycleTimerId !== null) clearTimeout(cycleTimerId)
      if (swapTimerId !== null) clearTimeout(swapTimerId)
      if (revealTimerId !== null) clearTimeout(revealTimerId)
      cycleTimerId = swapTimerId = revealTimerId = null
    }

    const cycle = () => {
      if (cancelled || document.hidden) return
      setIsTransitioning(true)
      swapTimerId = window.setTimeout(() => {
        swapTimerId = null
        if (cancelled) return
        setCurrentContentIndex((prev) => (prev + 1) % validContents.length)
        revealTimerId = window.setTimeout(() => {
          revealTimerId = null
          if (!cancelled) setIsTransitioning(false)
        }, 80)
        const nextDelay = Math.round(15000 * (anim.durationScale || 1))
        cycleTimerId = window.setTimeout(cycle, nextDelay)
      }, 300)
    }

    const startDelay = Math.round(6000 * (anim.durationScale || 1))
    cycleTimerId = window.setTimeout(cycle, startDelay)

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimers()
        setIsTransitioning(false)
      } else if (!cancelled) {
        clearTimers()
        setIsTransitioning(false)
        const restartDelay = Math.round(2000 * (anim.durationScale || 1))
        cycleTimerId = window.setTimeout(cycle, restartDelay)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearTimers()
      setIsTransitioning(false)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [validContents.length, isExpanded, isHovering, anim.durationScale])

  // 相位推进：由外壳真实的过渡结束事件驱动，定时器只作兜底。
  // 收缩内容淡出 → 外壳 morph → 展开内容淡入 → 遮罩，共用同一条时间线。
  useEffect(() => {
    if (!isPanelMorphing(panel)) return
    const el = triggerRef.current
    const generation = panel.generation
    const active = motionRef.current

    window.dispatchEvent(new CustomEvent('gcp-animation-start'))

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.dispatchEvent(new CustomEvent('gcp-animation-end'))
      dispatchPanel({ type: 'settle', generation })
    }

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'width') finish()
    }
    if (active.spatial && el) {
      el.addEventListener('transitionend', handleTransitionEnd)
    }
    const fallback = window.setTimeout(finish, settleTimeoutMs(active))

    return () => {
      window.clearTimeout(fallback)
      el?.removeEventListener('transitionend', handleTransitionEnd)
      if (!settled) {
        window.dispatchEvent(new CustomEvent('gcp-animation-end'))
      }
    }
  }, [panel.phase, panel.generation])

  const expandPanel = useCallback(() => {
    isExpandedRef.current = true
    dispatchPanel({ type: 'open' })
  }, [])

  const handleClosePanel = useCallback(() => {
    if (!isExpandedRef.current) return
    isExpandedRef.current = false
    dispatchPanel({ type: 'close' })
  }, [])

  const handleTogglePanel = useCallback(() => {
    if (isExpandedRef.current) {
      handleClosePanel()
    } else {
      expandPanel()
    }
  }, [handleClosePanel, expandPanel])

  // 展开态写入 html.gcp-panel-open(CSS 用它处理层级/指针事件)
  useEffect(() => {
    const root = document.documentElement
    if (isExpanded) {
      root.classList.add('gcp-panel-open')
    } else {
      root.classList.remove('gcp-panel-open')
    }
    return () => root.classList.remove('gcp-panel-open')
  }, [isExpanded])

  // ESC 关闭
  useEffect(() => {
    if (!isExpanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClosePanel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isExpanded, handleClosePanel])

  // ─── 展开高度测量 ───
  // 内容宽度由 CSS 固定为终值。morph 期间只写一次目标高度，避免异步内容
  // 在过渡中途顶跳外壳；结束后 ResizeObserver 再跟进。
  useLayoutEffect(() => {
    const triggerEl = triggerRef.current
    if (!triggerEl) return

    if (!isExpanded) {
      triggerEl.style.height = '3rem'
      return
    }
    const contentEl = expandedContentRef.current
    if (!contentEl) return

    let didInitial = false
    const measure = (opts?: { force?: boolean }) => {
      if (morphingRef.current && didInitial && !opts?.force) return
      const styles = getComputedStyle(triggerEl)
      const pad =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom)
      const needed = Math.ceil(contentEl.scrollHeight + pad)
      triggerEl.style.height = `${needed}px`
      didInitial = true
    }
    measure()

    const resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(contentEl)

    const handleAnimationEnd = () => {
      measure({ force: true })
    }
    const handleRemeasure = () => measure()
    window.addEventListener('gcp-animation-end', handleAnimationEnd)
    window.addEventListener('gcp-remeasure', handleRemeasure)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('gcp-animation-end', handleAnimationEnd)
      window.removeEventListener('gcp-remeasure', handleRemeasure)
    }
  }, [isExpanded, locale])

  // ─── 渲染 ───
  const currentContent =
    validContents.length > 0
      ? validContents[currentContentIndex % validContents.length]
      : null

  const collapsedIndicator = (
    <svg
      className="dynamic-arrow"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  )

  return (
    <>
      {/* 顶部控制栏 - 智能岛 */}
      <div className="global-control-bar">
        <div className="control-bar-content">
          <div
            ref={triggerRef}
            className={[
              'control-bar-trigger',
              isExpanded ? 'expanded' : '',
              isPanelMorphing(panel) ? 'gcp-animating' : '',
              panel.phase === 'closing' ? 'gcp-closing' : '',
              activeMotion.spatial ? '' : 'gcp-no-morph',
              activeMotion.blurDuringMorph ? '' : 'gcp-freeze-blur',
            ]
              .filter(Boolean)
              .join(' ')}
            style={motionVars}
            onPointerEnter={(e) => {
              if (isHoverCapablePointer(e.pointerType)) setIsHovering(true)
            }}
            onPointerLeave={() => setIsHovering(false)}
          >
            {/* 动态轮播内容 - 仅在有有效内容时显示 */}
            {currentContent && (
              <div
                className={`dynamic-content-wrapper ${!showDynamicContent || isTransitioning ? 'hidden' : ''}`}
                onClick={handleTogglePanel}
              >
                <span className="dynamic-icon">{currentContent.icon}</span>
                <div className="dynamic-text">
                  <span className="dynamic-text-main">
                    {currentContent.text}
                  </span>
                  {currentContent.subtext &&
                    (currentContent.showSubtext ??
                      currentContent.type === 'weather') && (
                      <span className="dynamic-text-sub">
                        {currentContent.subtext}
                      </span>
                    )}
                </div>
                {collapsedIndicator}
              </div>
            )}

            {/* 无有效内容时仍保持可点击区域。不按 isExpanded 卸载：
                交给 showDynamicContent 走与外壳同一条时间线的淡出/淡入 */}
            {!currentContent && (
              <div
                className={`dynamic-content-wrapper empty-state ${!showDynamicContent ? 'hidden' : ''}`}
                onClick={handleTogglePanel}
              >
                {collapsedIndicator}
              </div>
            )}

            {/* 展开的控制面板内容 */}
            <div
              ref={expandedContentRef}
              className={`expanded-panel-content ${showPanelContent ? 'visible' : ''}`}
            >
              {/* 头部 - 站点名 + 关闭按钮 */}
              <div className="control-panel-header">
                <span className="control-item-title">{siteName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.currentTarget.blur()
                    handleClosePanel()
                  }}
                  className="control-close-btn"
                  aria-label={t.common.close}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* 控制项网格 - 仅主题 + 语言 */}
              <div className="control-items-grid">
                {/* 主题切换 - 循环:浅色 → 深色 → 自动;图标反映当前实际外观 */}
                <div className="control-item control-item-compact">
                  <div className="control-item-info">
                    <div className="control-item-icon icon-theme">
                      <WeatherAssetIcon
                        icon={
                          isDark
                            ? CONTROL_PANEL_ICON_ASSETS.appearanceDark
                            : CONTROL_PANEL_ICON_ASSETS.appearanceLight
                        }
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="control-item-title">
                        {t.controlPanel.appearance}
                      </h4>
                      <p className="control-item-desc">
                        {themePreference === 'auto'
                          ? t.controlPanel.auto
                          : themePreference === 'dark'
                            ? t.controlPanel.dark
                            : t.controlPanel.light}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={cycleTheme}
                    className="control-action-btn"
                    aria-label={t.controlPanel.themeSwitch}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                </div>

                {/* 语言切换 - 循环 zh-CN → en-US → ja-JP */}
                <div className="control-item control-item-compact">
                  <div className="control-item-info">
                    <div className="control-item-icon icon-language">
                      <WeatherAssetIcon
                        icon={CONTROL_PANEL_ICON_ASSETS.language}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div>
                      <h4 className="control-item-title">
                        {t.controlPanel.language}
                      </h4>
                      <p className="control-item-desc">
                        {locale === 'zh-CN'
                          ? '简体中文'
                          : locale === 'ja-JP'
                            ? '日本語'
                            : 'English'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const locales = ['zh-CN', 'en-US', 'ja-JP'] as const
                      const currentIndex = locales.indexOf(locale)
                      const nextIndex = (currentIndex + 1) % locales.length
                      setLocale(locales[nextIndex])
                    }}
                    onWheel={(e) => {
                      e.preventDefault()
                      const locales = ['zh-CN', 'en-US', 'ja-JP'] as const
                      const currentIndex = locales.indexOf(locale)
                      const nextIndex =
                        e.deltaY > 0
                          ? (currentIndex + 1) % locales.length
                          : (currentIndex - 1 + locales.length) % locales.length
                      setLocale(locales[nextIndex])
                    }}
                    className="language-switch-btn"
                    aria-label={t.controlPanel.languageSwitch}
                  >
                    <span className="language-code">
                      {locale === 'zh-CN'
                        ? '中'
                        : locale === 'ja-JP'
                          ? '日'
                          : 'En'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={[
          'control-panel-overlay',
          showOverlay ? 'visible' : '',
          activeMotion.blurDuringMorph ? '' : 'defer-blur',
          showsOverlayBlur(panel, activeMotion) ? 'blurred' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={motionVars}
        onClick={handleClosePanel}
      />
    </>
  )
}

export default GlobalControlPanel
