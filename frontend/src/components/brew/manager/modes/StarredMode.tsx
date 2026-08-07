/**
 * StarredMode - 收藏文章模式
 */

import type { StarredModeConfig } from './types'

import {
  LuChevronLeft as ChevronLeft,
  LuEdit3 as Edit3,
  LuStar as Star,
} from '@lib/icons'
import { IslandShell } from '../../../shared/control-island'
import { ISLAND_BTN, ISLAND_DIVIDER } from './constants'

export interface StarredModeProps {
  variant: 'mobile' | 'desktop'
  starredMode: StarredModeConfig
  t: {
    backToSourceList: string
    starredArticles: string
    starredCount: string
    editMode: string
  }
}

export function StarredMode({ variant, starredMode, t }: StarredModeProps) {
  return (
    <IslandShell variant={variant} motionKey={`starred-bar-${variant}`}>
      {/* 返回按钮 */}
      <button
        onClick={starredMode.onBack}
        className={ISLAND_BTN}
        title={t.backToSourceList}
        aria-label={t.backToSourceList}
      >
        <ChevronLeft className="w-4.5 h-4.5" />
      </button>

      {/* 收藏信息 */}
      <div className="flex items-center gap-2 h-9 px-2 min-w-0 flex-1">
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <Star className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {t.starredArticles}
          </h3>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">
            {t.starredCount.replace('{count}', String(starredMode.total))}
          </div>
        </div>
      </div>

      {/* 编辑按钮 */}
      {starredMode.total > 0 && (
        <>
          <div className={ISLAND_DIVIDER} />
          <button
            onClick={starredMode.onEnterEditMode}
            className={`${ISLAND_BTN} hover:text-amber-500! hover:bg-amber-500/10!`}
            title={t.editMode}
            aria-label={t.editMode}
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </>
      )}
    </IslandShell>
  )
}
