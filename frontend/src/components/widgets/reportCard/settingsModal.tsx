import type { ReportCardClickAction } from './types'
import { FaTimes } from '@lib/icons'
import { motionShim as motion } from '@lib/motionShim'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../../contexts/I18nContext'

interface ReportCardSettingsModalState {
  isOpen: boolean
  selectedAction: ReportCardClickAction
  anchorRect?: DOMRect
  onSelect?: (action: ReportCardClickAction) => void
  onClose?: () => void
}

let reportCardSettingsModalState: ReportCardSettingsModalState = {
  isOpen: false,
  selectedAction: 'report',
}

const reportCardSettingsModalListeners: Set<() => void> = new Set()
const REPORT_CARD_SETTINGS_MODAL_WIDTH = 286
const REPORT_CARD_SETTINGS_MODAL_HEIGHT = 106
const REPORT_CARD_SETTINGS_MODAL_PADDING = 12

export function openReportCardSettingsModal(
  selectedAction: ReportCardClickAction,
  anchorRect: DOMRect,
  onSelect: (action: ReportCardClickAction) => void,
  onClose?: () => void,
) {
  reportCardSettingsModalState = {
    isOpen: true,
    selectedAction,
    anchorRect,
    onSelect,
    onClose,
  }
  reportCardSettingsModalListeners.forEach((listener) => listener())
}

export function closeReportCardSettingsModal() {
  const onClose = reportCardSettingsModalState.onClose
  reportCardSettingsModalState = {
    ...reportCardSettingsModalState,
    isOpen: false,
    onClose: undefined,
  }
  onClose?.()
  reportCardSettingsModalListeners.forEach((listener) => listener())
}

export function subscribeToReportCardSettingsModal(listener: () => void) {
  reportCardSettingsModalListeners.add(listener)
  return () => {
    reportCardSettingsModalListeners.delete(listener)
  }
}

export const ReportCardSettingsModal = memo(() => {
  const [, forceUpdate] = useState({})
  const { t } = useI18n()
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeToReportCardSettingsModal(() => {
      forceUpdate({})
    })
  }, [])

  const { isOpen, selectedAction, anchorRect, onSelect } =
    reportCardSettingsModalState

  const position = useMemo(() => {
    if (!anchorRect) return { top: 0, left: 0 }

    let top = anchorRect.bottom + 8
    let left =
      anchorRect.left +
      (anchorRect.width - REPORT_CARD_SETTINGS_MODAL_WIDTH) / 2

    if (
      left + REPORT_CARD_SETTINGS_MODAL_WIDTH >
      window.innerWidth - REPORT_CARD_SETTINGS_MODAL_PADDING
    ) {
      left =
        window.innerWidth -
        REPORT_CARD_SETTINGS_MODAL_WIDTH -
        REPORT_CARD_SETTINGS_MODAL_PADDING
    }
    if (left < REPORT_CARD_SETTINGS_MODAL_PADDING) {
      left = REPORT_CARD_SETTINGS_MODAL_PADDING
    }
    if (
      top + REPORT_CARD_SETTINGS_MODAL_HEIGHT >
      window.innerHeight - REPORT_CARD_SETTINGS_MODAL_PADDING
    ) {
      top = anchorRect.top - REPORT_CARD_SETTINGS_MODAL_HEIGHT - 8
    }
    if (top < REPORT_CARD_SETTINGS_MODAL_PADDING) {
      top = REPORT_CARD_SETTINGS_MODAL_PADDING
    }

    return { top, left }
  }, [anchorRect])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeReportCardSettingsModal()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeReportCardSettingsModal()
      }
    }

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, {
        passive: true,
      })
      document.addEventListener('keydown', handleKeyDown)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSelect = useCallback(
    (action: ReportCardClickAction) => {
      onSelect?.(action)
      closeReportCardSettingsModal()
    },
    [onSelect],
  )

  if (!isOpen) return null

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-10000"
      style={{ pointerEvents: 'none' }}
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.15 }}
        className="absolute glass rounded-xl shadow-xl overflow-hidden border border-white/15 dark:border-white/10 p-3"
        style={{
          top: position.top,
          left: position.left,
          width: REPORT_CARD_SETTINGS_MODAL_WIDTH,
          pointerEvents: 'auto',
        }}
      >
        <div className="flex items-center justify-between gap-2 px-1 pb-2">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {t.platformCard.settingsTitle}
          </span>
          <button
            type="button"
            onClick={closeReportCardSettingsModal}
            className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <FaTimes className="w-2.5 h-2.5 text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2.5">
          {(['social', 'report'] as const).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => handleSelect(action)}
              className={`flex-1 px-4 py-3 rounded-lg text-xs font-bold text-center transition-all ${
                selectedAction === action
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-black/10 dark:hover:bg-white/15'
              }`}
            >
              {action === 'social'
                ? t.platformCard.clickToSocial
                : t.platformCard.clickToReport}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
})

ReportCardSettingsModal.displayName = 'ReportCardSettingsModal'
