/**
 * 发布倒计时小组件
 * Glass风格设计，距目标发布日期的剩余天数主视觉 + 时分秒细分
 * 目标日期默认来自 content/site.ts 的 releaseConfig，可被小组件 config 覆盖
 */

import type { WidgetComponentProps } from '../WidgetGrid'
import { FaRocket } from '@lib/icons'

import { motionShim as motion } from '@lib/motionShim'
import { memo, useMemo, useState } from 'react'
import { releaseConfig } from '../../content/site'
import { useI18n } from '../../contexts/I18nContext'
import { useHomeVisibilityInterval } from '../../hooks/animation'
import { useAnimationLevel } from '../../hooks/useAnimationLevel'
import { useWidgetSize } from '../../hooks/useWidgetSize'
import { FitText } from './shared/FitText'
import { GlowBackground } from './shared/GlowBackground'
import { WidgetShell } from './shared/WidgetShell'

/** 小组件 config 可选覆盖项 */
interface CountdownWidgetConfig {
  /** 发布目标日期(ISO 8601 字符串) */
  targetDate?: string
  /** 事件名称(缺省走 i18n) */
  eventName?: string
}

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** 目标日期已过 */
  past: boolean
}

function computeRemaining(targetMs: number, now: number): Remaining {
  const diff = targetMs - now
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, past: true }
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    past: false,
  }
}

/** 两位补零 */
function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

export const CountdownWidget = memo(
  ({ config, isEditMode, isPreview }: WidgetComponentProps) => {
    // 如果是预览模式，强制 scale 为 1，因为外部容器已经进行了缩放
    const { containerRef, scale, fontScale } = useWidgetSize(
      config.size,
      isPreview ? 1 : undefined,
    )
    const anim = useAnimationLevel()
    const { t, locale } = useI18n()

    const widgetConfig = config.config as CountdownWidgetConfig | undefined
    const targetMs = useMemo(() => {
      const parsed = Date.parse(widgetConfig?.targetDate ?? releaseConfig.targetDate)
      return Number.isNaN(parsed) ? Date.parse(releaseConfig.targetDate) : parsed
    }, [widgetConfig?.targetDate])
    const eventName = widgetConfig?.eventName ?? t.countdownWidget.eventName

    const [now, setNow] = useState(() => Date.now())

    // 🔧 首页可见性感知定时器，页面隐藏时自动暂停跳动
    useHomeVisibilityInterval(
      () => setNow(Date.now()),
      1000,
      !isEditMode && !isPreview,
    )

    const remaining = useMemo(() => computeRemaining(targetMs, now), [targetMs, now])

    // 目标日期格式化
    const formattedTarget = useMemo(
      () =>
        new Date(targetMs).toLocaleDateString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      [targetMs, locale],
    )

    const is4x2 = config.size === '4x2'

    const renderIcon = (size: number) => (
      <FaRocket
        aria-hidden="true"
        className="block shrink-0 text-gray-700 dark:text-white/60 drop-shadow-sm"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    )

    // 主视觉：剩余天数(或已发布状态)，两种尺寸共用
    const renderMain = (daysMax: number) => (
      <motion.div
        className="flex items-baseline min-w-0"
        style={{ gap: `${8 * scale}px` }}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.34, 1.56, 0.64, 1] }}
      >
        {remaining.past ? (
          <FitText
            className="font-black text-gray-800 dark:text-gray-100 flex-1 min-w-0"
            max={daysMax * 0.6}
            min={16 * fontScale}
          >
            {t.countdownWidget.released}
          </FitText>
        ) : (
          <>
            {/* 天数是数字与语言无关，固定大号；单位收在基线右侧 */}
            <div
              className="font-black text-gray-800 dark:text-gray-100 leading-none shrink-0 tracking-tight"
              style={{ fontSize: `${daysMax}px` }}
            >
              {remaining.days}
            </div>
            <FitText
              className="flex-1 text-gray-600 dark:text-gray-400 font-medium min-w-0"
              max={14 * fontScale}
              min={10 * fontScale}
            >
              {t.countdownWidget.daysUnit}
            </FitText>
          </>
        )}
      </motion.div>
    )

    // 2x2 布局 - 简化版：图标 + 天数主视觉 + 事件名/目标日期
    if (!is4x2) {
      return (
        <WidgetShell
          containerRef={containerRef}
          scale={scale}
          padding={{ x: 14, y: 12 }}
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
          <motion.div
            className="shrink-0"
            style={{ marginBottom: `${6 * scale}px` }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            {renderIcon(20 * fontScale)}
          </motion.div>

          {renderMain(40 * fontScale)}

          {/* 底部信息组：事件名 + 目标日期，次级信息收在底部 */}
          <motion.div
            className="shrink-0 mt-auto min-w-0"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <FitText
              as="div"
              className="font-bold text-gray-700 dark:text-gray-200"
              max={12 * fontScale}
              min={10 * fontScale}
            >
              {eventName}
            </FitText>
            <FitText
              as="div"
              className="text-gray-500 dark:text-gray-400"
              max={10 * fontScale}
              min={9 * fontScale}
            >
              {formattedTarget}
            </FitText>
          </motion.div>
        </WidgetShell>
      )
    }

    // 4x2 布局 - 完整版：左侧天数主视觉，右侧时/分/秒细分
    const timeSegments: { value: string; unit: string }[] = [
      { value: pad2(remaining.hours), unit: t.countdownWidget.hoursUnit },
      { value: pad2(remaining.minutes), unit: t.countdownWidget.minutesUnit },
      { value: pad2(remaining.seconds), unit: t.countdownWidget.secondsUnit },
    ]

    return (
      <WidgetShell
        containerRef={containerRef}
        scale={scale}
        padding={16}
        contentClassName="flex flex-row"
        contentStyle={{ gap: `${20 * scale}px` }}
        background={
          <GlowBackground
            color="var(--color-primary)"
            animLevel={anim.level}
            shouldAnimate={anim.loop}
            variant="single"
            size="lg"
          />
        }
      >
        {/* 左侧：图标 + 天数主视觉 + 事件/日期 (42%) */}
        <div className="flex flex-col justify-between min-w-0" style={{ width: '42%' }}>
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div
              className="flex items-center"
              style={{ marginBottom: `${8 * scale}px` }}
            >
              {renderIcon(24 * fontScale)}
            </div>
            {renderMain(46 * fontScale)}
          </motion.div>

          <motion.div
            className="shrink-0 min-w-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <FitText
              as="div"
              className="font-bold text-gray-700 dark:text-gray-200"
              max={13 * fontScale}
              min={10 * fontScale}
            >
              {eventName}
            </FitText>
            <FitText
              as="div"
              className="text-gray-500 dark:text-gray-400"
              max={10 * fontScale}
              min={9 * fontScale}
            >
              {formattedTarget}
            </FitText>
          </motion.div>
        </div>

        {/* 右侧：时/分/秒细分格 (58%) */}
        <div
          className="flex-1 flex items-stretch min-w-0"
          style={{ gap: `${10 * scale}px` }}
        >
          {timeSegments.map((segment, index) => (
            <motion.div
              key={segment.unit}
              className="flex-1 min-w-0 rounded-lg bg-white/60 dark:bg-white/3 backdrop-blur-sm shadow-lg flex flex-col items-center justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + index * 0.08 }}
            >
              <div
                className="font-black text-gray-800 dark:text-gray-100 leading-none tracking-tight"
                style={{ fontSize: `${28 * fontScale}px` }}
              >
                {segment.value}
              </div>
              <div
                className="text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                style={{
                  fontSize: `${9 * fontScale}px`,
                  marginTop: `${4 * scale}px`,
                }}
              >
                {segment.unit}
              </div>
            </motion.div>
          ))}
        </div>
      </WidgetShell>
    )
  },
)

CountdownWidget.displayName = 'CountdownWidget'
