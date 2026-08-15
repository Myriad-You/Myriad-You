/**
 * 安装配置生成器弹窗
 *
 * 移植自 tapp-store 的 com.myriad.config-generator:
 * - markup / 样式 / 逻辑全部来自 src/config-generator/(page.html、page.css、main.js
 *   的原样移植,仅移除沙箱宿主 API),这里只做挂载与主题桥接
 * - 弹窗外壳复用 styles/modals.css 的 .modal-overlay-portal / .modal-content,
 *   动画与 DetailModal 一致(framer-motion 经 @lib/motionShim 懒加载)
 * - --tapp-primary / --tapp-primary-rgb 桥接到壁纸主色 --color-primary,
 *   使生成器跟随壁纸取色;明暗主题直接继承 html.dark
 */

import { LuX } from '@lib/icons'
import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  mountConfigGenerator,
  unmountConfigGenerator,
} from '../config-generator/main.js'
import pageCss from '../config-generator/page.css?raw'
import pageHtml from '../config-generator/page.html?raw'
import { useI18n } from '../contexts/I18nContext'
import { usePrimaryColor } from '../utils/colorSubscriber'

interface ConfigGeneratorModalProps {
  open: boolean
  onClose: () => void
}

const STYLE_ELEMENT_ID = 'config-generator-styles'

/**
 * 弹窗挂载修正(追加在 page.css 之后,原文件保持原样):
 * #tapp-content 在 tapp 里是填满视口的绝对定位滚动层;
 * 弹窗内改为文档流撑开高度,滚动交由 .modal-content 承担。
 */
const MOUNT_OVERRIDE_CSS = `
.config-generator-mount #tapp-content {
  position: relative;
  inset: auto;
  overflow: visible;
}
`

/** 生成器样式只注入一次;选择器均为 #tapp-* / .cg-* / .config-* 作用域,不污染全站 */
function ensureGeneratorStyles() {
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.textContent = pageCss + MOUNT_OVERRIDE_CSS
  document.head.appendChild(style)
}

/** '#94a3b8' → '148, 163, 184'(供 rgba(var(--tapp-primary-rgb), α) 使用) */
function toRgbTriplet(color: string): string | null {
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!match) return null
  let hex = match[1]
  if (hex.length === 3)
    hex = hex.split('').map((c) => c + c).join('')
  const value = Number.parseInt(hex, 16)
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`
}

/** 桌面端:弹簧缩放;移动端:底部滑出(与 DetailModal 一致) */
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

export function ConfigGeneratorModal({ open, onClose }: ConfigGeneratorModalProps) {
  const { t } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const primaryColor = usePrimaryColor()

  // 打开时注入样式 + markup 并启动生成器;关闭时卸载并清空
  useEffect(() => {
    if (!open) return
    ensureGeneratorStyles()
    const host = hostRef.current
    if (!host) return
    host.innerHTML = pageHtml
    mountConfigGenerator()
    return () => {
      unmountConfigGenerator()
      host.innerHTML = ''
    }
  }, [open])

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

  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 640px)').matches
  const variants = isMobile ? mobileVariants : desktopVariants

  // 桥接壁纸主色到生成器的 --tapp-primary(其 CSS 变量兜底为 #6366f1)
  const rgbTriplet = toRgbTriplet(primaryColor)
  const themeVars = {
    '--tapp-primary': primaryColor,
    ...(rgbTriplet ? { '--tapp-primary-rgb': rgbTriplet } : {}),
  } as React.CSSProperties

  return createPortal(
    <AnimatePresence mode="sync">
      {open && (
        <motion.div
          key="config-generator-overlay"
          className="modal-overlay-portal modal-motion"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } }}
          exit={{ opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } }}
          onClick={(e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) onClose()
          }}
          role="presentation"
        >
          <motion.div
            key="config-generator-content"
            className="modal-content modal-motion"
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            role="dialog"
            aria-modal="true"
            aria-label={t.site.configGenerator.title}
            style={themeVars}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label={t.common.close}
              className="absolute right-4 top-4 z-20 rounded-full p-1.5 text-(--text-secondary) transition-colors hover:bg-black/5 hover:text-(--text-primary) dark:hover:bg-white/10"
            >
              <LuX className="h-5 w-5" />
            </button>
            {/* relative 容器:page.html 的 #tapp-background 背景层 absolute inset-0 依附于此 */}
            <div ref={hostRef} className="config-generator-mount relative" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default ConfigGeneratorModal
