/**
 * StarredEditMode - 收藏编辑模式
 */

import type { StarredModeConfig } from './types'

import {
  LuCheckSquare as CheckSquare,
  LuMinusSquare as MinusSquare,
  LuSquare as Square,
  LuStar as Star,
  LuX as X,
} from '@lib/icons'
import { IslandShell } from '../../../shared/control-island'
import { Spinner } from '../../../Spinner'
import { ISLAND_BTN, ISLAND_DIVIDER } from './constants'

export interface StarredEditModeProps {
  variant: 'mobile' | 'desktop'
  starredMode: StarredModeConfig
  t: {
    exitEdit: string
    selectAllToggle: string
    selectedCount: string
    selectArticles: string
    unstar: string
  }
}

export function StarredEditMode({
  variant,
  starredMode,
  t,
}: StarredEditModeProps) {
  return (
    <IslandShell variant={variant} motionKey={`starred-edit-bar-${variant}`}>
      {/* 退出编辑 */}
      <button
        onClick={starredMode.onExitEditMode}
        className={ISLAND_BTN}
        title={t.exitEdit}
        aria-label={t.exitEdit}
      >
        <X className="w-4.5 h-4.5" />
      </button>

      {/* 选择信息 */}
      <div className="flex items-center gap-2 h-9 px-2 min-w-0 flex-1">
        <button
          onClick={starredMode.onSelectAll}
          className="p-1.5 text-gray-500 hover:text-amber-500 rounded-lg transition-colors active:scale-[0.97]"
          title={t.selectAllToggle}
          aria-label={t.selectAllToggle}
        >
          {starredMode.selectedIds.size === starredMode.total ? (
            <CheckSquare className="w-5 h-5 text-amber-500" />
          ) : starredMode.selectedIds.size > 0 ? (
            <MinusSquare className="w-5 h-5 text-amber-500" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {starredMode.selectedIds.size > 0
            ? t.selectedCount.replace(
                '{count}',
                String(starredMode.selectedIds.size),
              )
            : t.selectArticles}
        </span>
      </div>

      {/* 取消收藏按钮 */}
      <div className={ISLAND_DIVIDER} />
      <button
        onClick={starredMode.onBatchUnstar}
        disabled={
          starredMode.selectedIds.size === 0 || starredMode.isProcessing
        }
        className={`${ISLAND_BTN} hover:text-amber-500! hover:bg-amber-500/10! disabled:opacity-50`}
        title={t.unstar}
        aria-label={t.unstar}
      >
        {starredMode.isProcessing ? (
          <Spinner size="sm" color="current" />
        ) : (
          <Star className="w-4 h-4" />
        )}
      </button>
    </IslandShell>
  )
}
