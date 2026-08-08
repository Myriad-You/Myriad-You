/**
 * 首页视图组件(静态官网版)
 * 保留原 Myriad 首页视觉:花体大标题、用户信息玻璃卡、小组件网格。
 * 数据源全部改为本地静态配置(content/site.ts),零后端请求。
 * 卡片点击 → DetailModal 详情弹窗。
 */

import type { WidgetConfig, WidgetSize, WidgetType } from '../components/WidgetGrid'
import type { SiteSection } from '../content/site'

import { motionShim as motion } from '@lib/motionShim'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AnimatedView from '../components/AnimatedView'
import DetailModal from '../components/DetailModal'
import WidgetGrid from '../components/WidgetGrid'
import {
  getBuiltinWidgets,
  preloadBuiltinWidgets,
} from '../components/widgets/builtinWidgets'
import {
  getHomeConfig,
  getSections,
} from '../content/site'
import { useI18n } from '../contexts/I18nContext'
import { useHomeScheduler, usePageReady } from '../hooks/animation'
import {
  useResolvedTitleColor,
  useTitleFont,
} from '../hooks/useTitleFont'
import { ensureMotionReady } from '../lib/lazyMotion'
import { OPEN_SECTION_EVENT } from '../utils/sectionEvents'

/** 默认小组件布局:welcome/weather(活体) + 官网板块卡(含 4x2 安装配置生成卡) */
function buildStaticLayout(): WidgetConfig[] {
  const live: WidgetConfig[] = [
    {
      id: 'default-welcome',
      type: 'welcome',
      size: '4x2',
      position: { x: 0, y: 0 },
    },
    {
      id: 'default-weather',
      type: 'weather',
      size: '2x2',
      position: { x: 4, y: 0 },
    },
  ]
  // 板块卡:全部排在第一行,紧跟天气右侧(16 列恰好排满)。
  // 下载安装/界面预览/技术栈 暂时隐藏(要恢复时取消注释即可)
  const cardSpecs: { sectionId: string; x: number; y: number; size?: WidgetSize }[] = [
    { sectionId: 'features', x: 6, y: 0 },
    { sectionId: 'intro', x: 8, y: 0 },
    { sectionId: 'about', x: 10, y: 0 },
    { sectionId: 'config-generator', x: 12, y: 0, size: '4x2' },
    // { sectionId: 'download', x: 8, y: 0 },
    // { sectionId: 'preview', x: 10, y: 0 },
    // { sectionId: 'tech-stack', x: 12, y: 0 },
  ]
  const cards: WidgetConfig[] = cardSpecs.map((spec) => ({
    id: `site-card-${spec.sectionId}`,
    type: 'site-card',
    size: spec.size ?? '2x2',
    position: { x: spec.x, y: spec.y },
    config: { sectionId: spec.sectionId },
  }))
  return [...live, ...cards]
}

export default function Home() {
  // 🆕 初始化首页调度器(Visibility + Resize + RAF + Idle)
  useHomeScheduler()

  const { t } = useI18n()
  const isPageReady = usePageReady()

  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [openSection, setOpenSection] = useState<SiteSection | null>(null)

  // 标题字体 Hook
  const { currentFont, titleFontSize } = useTitleFont()
  // 自适应色:对比度推导,随主题/壁纸色更新
  const titleColorCss = useResolvedTitleColor()

  // 站点文案经 i18n 解析,语言切换时重建
  const sections = useMemo(() => getSections(t), [t])
  const homeConfig = useMemo(() => getHomeConfig(t), [t])
  const dashboardTitle = homeConfig.title

  // Shared built-in catalog
  const AVAILABLE_WIDGETS: WidgetType[] = useMemo(
    () => getBuiltinWidgets(t.widgets),
    [t.widgets],
  )

  // motion 与小组件预热并行;网格入场依赖真 motion,避免 shim 攒帧闪现
  useEffect(() => {
    void ensureMotionReady()
  }, [])

  useEffect(() => {
    async function applyWidgets(list: WidgetConfig[]) {
      await Promise.race([
        Promise.all([
          preloadBuiltinWidgets(list.map((w) => w.type)),
          ensureMotionReady(),
        ]),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ])
      setWidgets(list)
    }
    void applyWidgets(buildStaticLayout())
  }, [])

  // 板块入口统一处理:带 href 的外链卡新标签页打开,其余弹详情窗
  const openSectionOrLink = useCallback((section: SiteSection) => {
    if (section.href) {
      window.open(section.href, '_blank', 'noopener,noreferrer')
      return
    }
    setOpenSection(section)
  }, [])

  // welcome 小组件内部的引导卡点击 → 打开对应板块详情
  useEffect(() => {
    const handler = (event: Event) => {
      const sectionId = (event as CustomEvent<string>).detail
      const section = sections.find((s) => s.id === sectionId)
      if (section) openSectionOrLink(section)
    }
    window.addEventListener(OPEN_SECTION_EVENT, handler)
    return () => window.removeEventListener(OPEN_SECTION_EVENT, handler)
  }, [sections, openSectionOrLink])

  // 网格卡片点击:官网板块卡打开详情弹窗(带 href 的外链卡直接新标签页打开);
  // 活体小组件保持自身交互
  const handleWidgetClick = useCallback(
    (widget: WidgetConfig) => {
      if (widget.type !== 'site-card') return
      const sectionId = (widget.config as { sectionId?: string } | undefined)
        ?.sectionId
      const section = sections.find((s) => s.id === sectionId)
      if (section) openSectionOrLink(section)
    },
    [sections, openSectionOrLink],
  )

  return (
    <AnimatedView className="min-h-screen lg:h-screen lg:overflow-hidden">
      <div className="h-full flex flex-col pt-20 pb-6 px-3 xs:px-4 sm:px-6">
        <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col gap-4 p-2 relative min-h-0">
          {/* 小组件网格区域 - 占满整个可用空间 */}
          <WidgetGrid
            widgets={widgets}
            availableWidgets={AVAILABLE_WIDGETS}
            onWidgetClick={handleWidgetClick}
          >
            {/* 顶部信息条 - 作为 children 传入 WidgetGrid */}
            <div className="relative h-15 shrink-0 z-10 mb-2 p-1">
              <h1 className="sr-only">{dashboardTitle}</h1>
              {/* 背景标题 */}
              <div
                className="absolute left-1 whitespace-nowrap pointer-events-none z-0 hidden md:block transition-opacity duration-300"
                style={{
                  top: `calc(30px - ${7.5 * titleFontSize}rem)`,
                  fontSize: `${6 * titleFontSize}rem`,
                  color: titleColorCss,
                  WebkitTextStroke: `0.5px color-mix(in srgb, ${titleColorCss} 30%, transparent)`,
                  fontFamily: currentFont.family,
                  fontWeight: 700,
                  opacity: dashboardTitle ? 1 : 0,
                }}
              >
                {dashboardTitle}
              </div>

              <motion.div
                className="h-full flex items-center justify-between"
                initial={{ opacity: 0, x: -20 }}
                animate={
                  isPageReady ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }
                }
                transition={{
                  duration: 0.3,
                  ease: 'easeOut',
                  delay: isPageReady ? 0.1 : 0,
                }}
              >
                {/* 用户信息卡片(静态) */}
                <motion.div
                  className="h-full glass rounded-xl px-4 py-1 flex items-center gap-3 shadow-sm relative z-10"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-white/10">
                    <img
                      src={homeConfig.avatar}
                      alt={homeConfig.userName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      decoding="async"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">
                      {homeConfig.userName}
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 max-w-50 truncate leading-tight">
                      {homeConfig.userBio}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </WidgetGrid>
        </div>
      </div>

      {/* 板块详情弹窗 */}
      <DetailModal
        open={openSection !== null}
        onClose={() => setOpenSection(null)}
        title={openSection?.title ?? ''}
      >
        {openSection && (
          <div className="space-y-4">
            {openSection.detail.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed">
                {paragraph}
              </p>
            ))}
            {openSection.detail.list && (
              <ul className="list-disc space-y-1.5 pl-5">
                {openSection.detail.list.map((item) => (
                  <li key={item} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {openSection.detail.links && (
              <div className="flex flex-wrap gap-3 pt-1">
                {openSection.detail.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </DetailModal>
    </AnimatedView>
  )
}
