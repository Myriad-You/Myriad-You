/**
 * Tapp 卸载确认 — 锚定触发按钮的浮层
 * 行为对齐设置页 SettingTitleGuideEntry：
 * 优先上方 → 左/右/下、贴触发器左缘、滚动平抑跟随、进出场动效、锚点滚出关闭。
 */

import { FaTrash } from '@lib/icons'
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { SettingsButton, ToggleSwitch } from '../../components/settings'
import { useI18n } from '../../contexts/I18nContext'
import '../../components/ConfigForm.css'
import './UninstallConfirmDialog.css'

export interface UninstallConfirmDialogProps {
  isOpen: boolean
  appName: string
  /** 定位锚点（卸载按钮） */
  anchorEl?: HTMLElement | null
  onCancel: () => void
  onConfirm: (keepData: boolean) => Promise<void>
}

const VIEWPORT_PAD = 10
const GAP = 8
/** 每帧向目标靠近的比例（与指南浮窗一致） */
const LERP = 0.12
const SNAP_EPS = 0.45
const EXIT_MS = 260

type Placement = 'top' | 'left' | 'right' | 'bottom'
type FloatPhase = 'closed' | 'open' | 'closing'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max))
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 与 SettingTitleGuideEntry 同策略：
 * 优先上方 → 左 → 右 → 下；贴触发器左缘 / 顶缘，再 clamp 进视口。
 */
function computePosition(
  trigger: DOMRect,
  panelW: number,
  panelH: number,
): { top: number; left: number; placement: Placement } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const spaceAbove = trigger.top - VIEWPORT_PAD
  const spaceBelow = vh - trigger.bottom - VIEWPORT_PAD
  const spaceLeft = trigger.left - VIEWPORT_PAD
  const spaceRight = vw - trigger.right - VIEWPORT_PAD

  const needH = panelH + GAP
  const needW = panelW + GAP

  let placement: Placement = 'top'
  if (needH <= spaceAbove) {
    placement = 'top'
  } else if (needW <= spaceLeft) {
    placement = 'left'
  } else if (needW <= spaceRight) {
    placement = 'right'
  } else if (needH <= spaceBelow) {
    placement = 'bottom'
  } else {
    const scores: Array<{ p: Placement; s: number }> = [
      { p: 'top', s: spaceAbove },
      { p: 'left', s: spaceLeft },
      { p: 'right', s: spaceRight },
      { p: 'bottom', s: spaceBelow },
    ]
    scores.sort((a, b) => b.s - a.s)
    placement = scores[0]!.p
  }

  let top = 0
  let left = 0

  switch (placement) {
    case 'top':
      top = trigger.top - GAP - panelH
      left = trigger.left
      break
    case 'left':
      top = trigger.top
      left = trigger.left - GAP - panelW
      break
    case 'right':
      top = trigger.top
      left = trigger.right + GAP
      break
    case 'bottom':
      top = trigger.bottom + GAP
      left = trigger.left
      break
  }

  left = clamp(left, VIEWPORT_PAD, vw - panelW - VIEWPORT_PAD)
  top = clamp(top, VIEWPORT_PAD, vh - panelH - VIEWPORT_PAD)

  return { top, left, placement }
}

export function UninstallConfirmDialog({
  isOpen,
  appName,
  anchorEl = null,
  onCancel,
  onConfirm,
}: UninstallConfirmDialogProps) {
  const { t, format } = useI18n()
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleText = format(t.tapp.confirmUninstall, { name: appName })

  const [keepData, setKeepData] = useState(false)
  const [uninstalling, setUninstalling] = useState(false)
  const [phase, setPhase] = useState<FloatPhase>('closed')
  const [ready, setReady] = useState(false)
  const [placement, setPlacement] = useState<Placement>('top')

  const displayRef = useRef({ top: 0, left: 0 })
  const targetRef = useRef({
    top: 0,
    left: 0,
    placement: 'top' as Placement,
  })
  const rafRef = useRef(0)
  const exitTimerRef = useRef(0)
  const phaseRef = useRef<FloatPhase>('closed')
  /** 关闭动画结束后是否通知父级 onCancel（用户取消 / 锚点失效） */
  const notifyCancelOnCloseRef = useRef(false)

  phaseRef.current = phase
  const isMounted = phase === 'open' || phase === 'closing'

  const applyDisplay = useCallback((top: number, left: number) => {
    displayRef.current = { top, left }
    const panel = panelRef.current
    if (!panel) return
    panel.style.top = `${top}px`
    panel.style.left = `${left}px`
  }, [])

  const stopSmooth = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const tickSmooth = useCallback(() => {
    rafRef.current = 0
    if (phaseRef.current !== 'open') return

    const target = targetRef.current
    const cur = displayRef.current
    const alpha = prefersReducedMotion() ? 1 : LERP

    const nextTop = cur.top + (target.top - cur.top) * alpha
    const nextLeft = cur.left + (target.left - cur.left) * alpha
    const dx = Math.abs(target.left - nextLeft)
    const dy = Math.abs(target.top - nextTop)

    if (dx < SNAP_EPS && dy < SNAP_EPS) {
      applyDisplay(target.top, target.left)
      return
    }

    applyDisplay(nextTop, nextLeft)
    rafRef.current = requestAnimationFrame(tickSmooth)
  }, [applyDisplay])

  const startSmooth = useCallback(() => {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(tickSmooth)
  }, [tickSmooth])

  const finishUnmount = useCallback(() => {
    stopSmooth()
    setReady(false)
    setPhase('closed')
    setKeepData(false)
    setUninstalling(false)
    if (notifyCancelOnCloseRef.current) {
      notifyCancelOnCloseRef.current = false
      onCancel()
    }
  }, [stopSmooth, onCancel])

  const close = useCallback(
    (opts?: { notifyParent?: boolean }) => {
      if (phaseRef.current === 'closed' || phaseRef.current === 'closing') return
      if (opts?.notifyParent) notifyCancelOnCloseRef.current = true
      stopSmooth()
      setReady(false)

      if (prefersReducedMotion()) {
        finishUnmount()
        return
      }

      setPhase('closing')
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = window.setTimeout(finishUnmount, EXIT_MS)
    },
    [finishUnmount, stopSmooth],
  )

  const measureTarget = useCallback(
    (opts?: { snap?: boolean }): boolean => {
      const panel = panelRef.current
      const anchor = anchorEl
      if (!panel || phaseRef.current !== 'open') return false

      const panelW = panel.offsetWidth
      const panelH = panel.offsetHeight
      if (panelW < 1 || panelH < 1) return true

      if (!anchor) {
        const vw = window.innerWidth
        const vh = window.innerHeight
        const next = {
          top: Math.max(VIEWPORT_PAD, vh * 0.35),
          left: Math.max(VIEWPORT_PAD, (vw - panelW) / 2),
          placement: 'bottom' as Placement,
        }
        targetRef.current = next
        setPlacement(next.placement)
        if (opts?.snap || prefersReducedMotion()) {
          stopSmooth()
          applyDisplay(next.top, next.left)
        } else {
          startSmooth()
        }
        return true
      }

      const rect = anchor.getBoundingClientRect()
      const next = computePosition(rect, panelW, panelH)
      targetRef.current = next
      setPlacement(next.placement)

      if (opts?.snap || prefersReducedMotion()) {
        stopSmooth()
        applyDisplay(next.top, next.left)
      } else {
        startSmooth()
      }
      return true
    },
    [anchorEl, applyDisplay, startSmooth, stopSmooth],
  )

  /* 父级 isOpen → 本地 phase */
  useEffect(() => {
    if (isOpen) {
      window.clearTimeout(exitTimerRef.current)
      notifyCancelOnCloseRef.current = false
      setKeepData(false)
      setUninstalling(false)
      setReady(false)
      setPhase('open')
      return
    }
    if (phaseRef.current === 'open') {
      // 父级直接关掉：播退出，不再次 onCancel
      close({ notifyParent: false })
    }
  }, [isOpen, close])

  useEffect(
    () => () => {
      window.clearTimeout(exitTimerRef.current)
      stopSmooth()
    },
    [stopSmooth],
  )

  /* 打开瞬间：snap 定位 → 双 rAF → is-ready 进入动效 */
  useLayoutEffect(() => {
    if (phase !== 'open') {
      if (phase === 'closed') stopSmooth()
      return
    }
    setReady(false)
    measureTarget({ snap: true })
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      measureTarget({ snap: true })
      raf2 = requestAnimationFrame(() => {
        if (phaseRef.current === 'open') setReady(true)
      })
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [phase, appName, measureTarget, stopSmooth])

  /* 滚动 / 缩放：仅平抑跟随，不自动关闭（需点取消 / 确认） */
  useEffect(() => {
    if (phase !== 'open') return

    const onScrollOrResize = () => {
      measureTarget({ snap: false })
    }

    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
      stopSmooth()
    }
  }, [phase, measureTarget, stopSmooth])

  const handleCancel = useCallback(() => {
    if (uninstalling) return
    close({ notifyParent: true })
  }, [close, uninstalling])

  const handleConfirm = useCallback(async () => {
    if (uninstalling) return
    setUninstalling(true)
    try {
      await onConfirm(keepData)
      // 成功后父级会 isOpen=false；此处直接收起
      notifyCancelOnCloseRef.current = false
      close({ notifyParent: false })
    } catch {
      setUninstalling(false)
    }
  }, [onConfirm, keepData, uninstalling, close])

  if (!isMounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      ref={panelRef}
      className={[
        'uninstall-tip',
        `uninstall-tip--${placement}`,
        ready && phase === 'open' ? 'is-ready' : '',
        phase === 'closing' ? 'is-leaving' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => e.stopPropagation()}
      onTransitionEnd={(e) => {
        if (e.target !== panelRef.current) return
        if (e.propertyName !== 'opacity' && e.propertyName !== 'transform')
          return
        if (phaseRef.current === 'closing') {
          window.clearTimeout(exitTimerRef.current)
          finishUnmount()
        }
      }}
    >
      <h3 id={titleId} className="uninstall-tip-title" title={titleText}>
        {titleText}
      </h3>

      <div className="uninstall-tip-keep">
        <div className="uninstall-tip-keep-text">
          <span className="uninstall-tip-keep-label">
            {t.tapp.keepDataOnUninstall}
          </span>
          <span className="uninstall-tip-keep-desc">
            {t.tapp.keepDataOnUninstallDesc}
          </span>
        </div>
        <ToggleSwitch
          checked={keepData}
          onChange={setKeepData}
          disabled={uninstalling}
          aria-label={t.tapp.keepDataOnUninstall}
        />
      </div>

      <div className="uninstall-tip-actions">
        <SettingsButton
          variant="secondary"
          size="sm"
          onClick={handleCancel}
          disabled={uninstalling}
        >
          {t.common.cancel}
        </SettingsButton>
        <SettingsButton
          variant="danger"
          size="sm"
          icon={<FaTrash />}
          onClick={() => void handleConfirm()}
          loading={uninstalling}
          disabled={uninstalling}
        >
          {uninstalling ? t.tapp.uninstalling : t.tapp.confirmUninstallBtn}
        </SettingsButton>
      </div>
    </div>,
    document.body,
  )
}

export default UninstallConfirmDialog
