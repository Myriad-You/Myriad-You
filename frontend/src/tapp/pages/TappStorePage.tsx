/**
 * Tapp 商店正式页面
 *
 * 壳层对齐运行页：顶栏 chrome（返回 / 标题 / 多窗口 / 全屏），不另做移动顶栏。
 * 内容为宿主面板；多窗口走 myriad:host.store。
 */

import {
  FaArrowLeft,
  FaCompress,
  FaExpand,
  FaTh,
} from '@lib/icons'
import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useI18n } from '../../contexts/I18nContext'
import { useNavigation } from '../../contexts/NavigationContext'
import { isExlight, useAnimationLevel } from '../../hooks/useAnimationLevel'
import { usePageSeo } from '../../hooks/usePageSeo'
import { useBreakpoints } from '../../hooks/useSharedEventListener'
import {
  canAccessModuleVisibility,
  useModuleVisibilityPreferences,
} from '../../utils/moduleVisibility'
import { TappIcon } from '../components/TappIcon'
import { TappStore } from '../components/TappStore'
import { TappWindowManager } from '../components/TappWindowManager'
import { HOST_PANEL_STORE_ID } from '../constants/hostPanels'
import { TAPP_ICON_TOKENS } from '../constants/icons'
import { isWebKit } from '../runtime/TappPageSandbox'
import { buildTappStorePageSeo } from '../utils/tappPageSeo'

export function TappStorePage() {
  const [searchParams] = useSearchParams()
  const { isMobile } = useBreakpoints()
  const multiParam = searchParams.get('multi') === 'true' && !isWebKit
  const navigate = useNavigate()

  if (multiParam && !isMobile) {
    return (
      <TappWindowManager
        initialTappId={HOST_PANEL_STORE_ID}
        onBack={() => navigate('/tapp')}
      />
    )
  }

  return <TappStorePageStandard isMobile={isMobile} />
}

function TappStorePageStandard({ isMobile }: { isMobile: boolean }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { setImmersiveMode } = useNavigation()
  const animConfig = useAnimationLevel()
  const noAnimation = isExlight(animConfig)
  const { preferences: moduleVisibility } = useModuleVisibilityPreferences()
  const moduleOpenToAll = canAccessModuleVisibility(
    moduleVisibility.modules.tapp,
    { isAuthenticated: false, isAdmin: false },
  )

  const [isFullscreen, setIsFullscreen] = useState(false)

  usePageSeo(
    useMemo(
      () =>
        buildTappStorePageSeo({
          storeLabel: t.tapp.storeTitle,
          storeDescription: t.tapp.listSubtitle,
          moduleOpenToAll,
        }),
      [t.tapp.storeTitle, t.tapp.listSubtitle, moduleOpenToAll],
    ),
  )

  useEffect(() => {
    setImmersiveMode(isFullscreen)
    return () => setImmersiveMode(false)
  }, [isFullscreen, setImmersiveMode])

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const goBack = useCallback(() => navigate('/tapp'), [navigate])
  const openMulti = useCallback(() => {
    navigate(
      `/tapp/run/${encodeURIComponent(HOST_PANEL_STORE_ID)}?multi=true`,
    )
  }, [navigate])
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((v) => !v)
  }, [])

  const transitions = useMemo(
    () => ({
      chrome: {
        type: 'spring' as const,
        stiffness: 350,
        damping: 32,
        mass: 0.8,
      },
      toolbar: animConfig.spring
        ? { type: 'spring' as const, stiffness: 320, damping: 28 }
        : {
            type: 'tween' as const,
            duration: 0.25 * animConfig.durationScale,
          },
    }),
    [animConfig.spring, animConfig.durationScale],
  )

  // 普通模式内容区：对齐运行页沙箱定位；移动端底部给导航岛留白
  const contentStyle = useMemo((): CSSProperties => {
    if (isFullscreen) {
      return {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1,
      }
    }
    return {
      position: 'absolute',
      top: 'calc(5rem + 44px)',
      right: isMobile ? '0.75rem' : '1rem',
      bottom: isMobile
        ? 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))'
        : '1.5rem',
      left: isMobile ? '0.75rem' : '1rem',
      zIndex: 1,
      maxWidth: '72rem',
      marginLeft: 'auto',
      marginRight: 'auto',
    }
  }, [isFullscreen, isMobile])

  const fsToolbar = (
    <AnimatePresence>
      {isFullscreen && (
        <motion.div
          key="store-fullscreen-toolbar"
          initial={{ opacity: 0, x: -16, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -16, scale: 0.92 }}
          transition={transitions.toolbar}
          className={`fixed top-4 left-4 z-900 transition-opacity duration-300 ${
            isMobile
              ? 'opacity-100'
              : 'opacity-0 hover:opacity-100 focus-within:opacity-100'
          }`}
        >
          <div className="glass flex items-center gap-3 rounded-xl px-3 py-2 shadow-lg">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10">
                <TappIcon
                  icon={TAPP_ICON_TOKENS.store}
                  name={t.tapp.storeTitle}
                  sizeClass="w-4 h-4"
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xs font-semibold leading-tight text-gray-800 dark:text-gray-100">
                  {t.tapp.storeTitle}
                </h1>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  host
                </p>
              </div>
            </div>
            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-700" />
            <div className="flex items-center gap-1">
              <motion.button
                onClick={toggleFullscreen}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-gray-300"
                title={t.tapp.exitFullscreen}
                whileHover={noAnimation ? undefined : { scale: 1.1 }}
                whileTap={noAnimation ? undefined : { scale: 0.9 }}
              >
                <FaCompress className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <div
      data-tapp-store-shell=""
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 40,
      }}
    >
      {isWebKit ? createPortal(fsToolbar, document.body) : fsToolbar}

      {/* 与运行页一致的 chrome（全屏时淡出） */}
      <motion.div
        className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden"
        initial={noAnimation ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{
          opacity: isFullscreen ? 0 : 1,
          y: isFullscreen ? -24 : 0,
          scale: isFullscreen ? 0.96 : 1,
        }}
        transition={noAnimation ? undefined : transitions.chrome}
        style={{ pointerEvents: isFullscreen ? 'none' : undefined }}
      >
        <div className="h-20 shrink-0" />

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-6 sm:px-4 md:px-6">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
            {/* 头部卡片 — 与运行页同一套 glass 顶栏 */}
            <div className="glass pointer-events-auto flex min-h-11 shrink-0 items-center justify-between gap-2 rounded-t-xl px-3 py-2 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <motion.button
                  onClick={goBack}
                  className="shrink-0 rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-gray-300"
                  title={t.tapp.back}
                  aria-label={t.tapp.backToAppList}
                  whileHover={noAnimation ? undefined : { scale: 1.1, x: -2 }}
                  whileTap={noAnimation ? undefined : { scale: 0.9 }}
                >
                  <FaArrowLeft className="h-4 w-4" />
                </motion.button>

                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10">
                    <TappIcon
                      icon={TAPP_ICON_TOKENS.store}
                      name={t.tapp.storeTitle}
                      sizeClass="w-4 h-4"
                    />
                  </div>
                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {t.tapp.storeTitle}
                  </span>
                  <span className="hidden shrink-0 text-[10px] text-gray-400 dark:text-gray-500 sm:inline">
                    host
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {!isMobile && !isWebKit && (
                  <motion.button
                    onClick={openMulti}
                    className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                    title={t.tapp.multiWindow}
                    whileHover={noAnimation ? undefined : { scale: 1.15 }}
                    whileTap={noAnimation ? undefined : { scale: 0.9 }}
                  >
                    <FaTh className="h-3.5 w-3.5" />
                  </motion.button>
                )}
                <motion.button
                  onClick={toggleFullscreen}
                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-700 dark:hover:text-gray-300"
                  title={t.tapp.fullscreen}
                  whileHover={noAnimation ? undefined : { scale: 1.15 }}
                  whileTap={noAnimation ? undefined : { scale: 0.9 }}
                >
                  <FaExpand className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </div>

            {/* 占位，真实内容绝对定位叠在下方 */}
            <div
              className="min-h-0 flex-1 rounded-b-xl"
              aria-hidden
            />
          </div>
        </div>
      </motion.div>

      {/* 商店内容：与运行页沙箱同层，全屏/普通只切定位 */}
      <div
        className={`pointer-events-auto overflow-hidden transition-[border-radius] duration-300 ease-out ${
          isFullscreen
            ? 'rounded-none'
            : 'rounded-b-xl border border-t-0 border-gray-200/50 shadow-sm dark:border-neutral-700/50'
        }`}
        style={contentStyle}
      >
        <div
          className={`h-full overflow-hidden ${
            isFullscreen ? 'bg-[var(--bg-primary)]' : 'glass-surface'
          }`}
        >
          <TappStore className="h-full" embeddedChrome />
        </div>
      </div>
    </div>
  )
}

export default TappStorePage
