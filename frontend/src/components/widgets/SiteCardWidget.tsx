/**
 * 官网板块卡片小组件 —— 静态官网的板块入口卡
 *
 * 复用小组件卡片壳(WidgetShell + GlowBackground),外观与
 * welcome/weather/quote 等活体小组件一致;内容来自 content/site.ts。
 * 点击交互由 WidgetGrid 统一上抛(打开详情弹窗),组件本身只负责展示。
 */

import type { WidgetComponentProps } from '../WidgetGrid'
import { motionShim as motion } from '@lib/motionShim'
import { memo, useMemo } from 'react'
import { getSections } from '../../content/site'
import { useI18n } from '../../contexts/I18nContext'
import { useAnimationLevel } from '../../hooks/useAnimationLevel'
import { useWidgetSize } from '../../hooks/useWidgetSize'
import { FitText } from './shared/FitText'
import { GlowBackground } from './shared/GlowBackground'
import { WidgetShell } from './shared/WidgetShell'

export const SiteCardWidget = memo(
  ({ config, isPreview }: WidgetComponentProps) => {
    const { containerRef, scale, fontScale } = useWidgetSize(
      config.size,
      isPreview ? 1 : undefined,
    )
    const anim = useAnimationLevel()
    const { t } = useI18n()

    const sectionId = (config.config as { sectionId?: string } | undefined)
      ?.sectionId
    const sections = useMemo(() => getSections(t), [t])
    const section = sections.find((s) => s.id === sectionId) ?? sections[0]
    const Icon = section.icon
    const iconSize = 24 * scale

    return (
      <WidgetShell
        containerRef={containerRef}
        scale={scale}
        padding={12}
        contentClassName="flex flex-col"
        background={
          <GlowBackground
            color="var(--color-primary)"
            animLevel={anim.level}
            shouldAnimate={anim.loop}
            variant="single"
            size="md"
          />
        }
      >
        {/* 顶部:图标 */}
        <motion.div
          className="mb-1"
          initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.34, 1.56, 0.64, 1],
          }}
        >
          <Icon
            style={{
              color: 'var(--color-primary)',
              width: `${iconSize}px`,
              height: `${iconSize}px`,
            }}
          />
        </motion.div>

        {/* 中部:标题 + 摘要 */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          <FitText
            as="h3"
            className="font-black text-gray-800 dark:text-gray-100"
            max={17 * fontScale}
            min={12 * fontScale}
            style={{ marginBottom: `${4 * scale}px` }}
          >
            {section.title}
          </FitText>
          <motion.p
            className="text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2"
            style={{ fontSize: `${10 * fontScale}px`, lineHeight: 1.6 }}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{
              duration: 0.6,
              delay: 0.2,
              ease: [0.34, 1.56, 0.64, 1],
            }}
          >
            {section.summary}
          </motion.p>
        </div>

        {/* 底部:查看详情提示 */}
        <motion.div
          className="text-right font-bold uppercase tracking-wider text-gray-700 dark:text-white/60"
          style={{ fontSize: `${9 * fontScale}px` }}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          →
        </motion.div>
      </WidgetShell>
    )
  },
)

SiteCardWidget.displayName = 'SiteCardWidget'
