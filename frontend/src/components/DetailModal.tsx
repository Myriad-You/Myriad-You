/**
 * 通用详情弹窗
 *
 * createPortal 到 document.body,动画由 framer-motion(经 @lib/motionShim
 * 懒加载)驱动:桌面端弹簧缩放,移动端底部滑出;退出动画由 AnimatePresence
 * 托管。布局/视觉样式复用 styles/modals.css 的 .modal-overlay-portal /
 * .modal-content(加 .modal-motion 关闭其中的 CSS 透明度过渡,避免和
 * motion 的逐帧内联样式打架)。
 *
 * 支持 ESC / 点击遮罩关闭。
 */

import { LuX } from '@lib/icons'
import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../contexts/I18nContext'

interface DetailModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/** 桌面端:弹簧进场,快速收起到 slightly 缩小下沉 */
const desktopVariants = {
  initial: { opacity: 0, scale: 0.92, y: 20 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 28 },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
}

/** 移动端:底部滑出 */
const mobileVariants = {
  initial: { opacity: 0.8, y: '100%' },
  animate: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 40 },
  },
  exit: {
    opacity: 0.8,
    y: '100%',
    transition: { duration: 0.25, ease: [0.4, 0, 1, 1] },
  },
}

export function DetailModal({
  open,
  onClose,
  title,
  children,
}: DetailModalProps) {
  const { t } = useI18n()
  const titleId = useRef(
    `detail-modal-title-${Math.random().toString(36).slice(2, 9)}`,
  )

  // 关闭瞬间父组件会把 title/children 清空(openSection 置 null),
  // 缓存上一份内容,保证退出动画期间弹窗内容不提前消失
  const lastContentRef = useRef<{ title: string; children: React.ReactNode }>({
    title,
    children,
  })
  if (open) {
    lastContentRef.current = { title, children }
  }
  const renderTitle = open ? title : lastContentRef.current.title
  const renderChildren = open ? children : lastContentRef.current.children

  // ESC 关闭 + 锁定背景滚动
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 640px)').matches
  const variants = isMobile ? mobileVariants : desktopVariants

  return createPortal(
    // mode="sync" 仅为触发 shim 懒加载真实 AnimatePresence(其默认行为即 sync)
    <AnimatePresence mode="sync">
      {open && (
        <motion.div
          key="detail-modal-overlay"
          className="modal-overlay-portal modal-motion"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
          onClick={handleOverlayClick}
          role="presentation"
        >
          <motion.div
            key="detail-modal-content"
            className="modal-content p-6 md:p-8"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId.current}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2
                id={titleId.current}
                className="text-xl font-semibold text-(--text-primary) md:text-2xl"
              >
                {renderTitle}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.close}
                className="shrink-0 rounded-full p-1.5 text-(--text-secondary) transition-colors hover:bg-black/5 hover:text-(--text-primary) dark:hover:bg-white/10"
              >
                <LuX className="h-5 w-5" />
              </button>
            </div>
            <div className="text-(--text-secondary)">{renderChildren}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default DetailModal
