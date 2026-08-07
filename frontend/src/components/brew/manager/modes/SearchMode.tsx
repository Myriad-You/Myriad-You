/**
 * 搜索模式组件
 */

import { LuSearch as Search, LuX as X } from '@lib/icons'

import { IslandShell } from '../../../shared/control-island'
import { ISLAND_BTN, ISLAND_INPUT, ISLAND_INPUT_STYLE } from './constants'

export interface SearchModeProps {
  variant: 'mobile' | 'desktop'
  searchQuery: string
  setSearchQuery?: (query: string) => void
  filteredCount: number
  onClose: () => void
  t: {
    searchSources: string
    resultsCount: string
    closeSearch: string
  }
}

export function SearchMode({
  variant,
  searchQuery,
  setSearchQuery,
  filteredCount,
  onClose,
  t,
}: SearchModeProps) {
  const isMobile = variant === 'mobile'

  return (
    <IslandShell variant={variant} motionKey={`search-bar-${variant}`}>
      <div
        className={`flex items-center gap-2 px-3 h-9 ${isMobile ? 'flex-1' : ''}`}
      >
        <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery?.(e.target.value)}
          placeholder={t.searchSources}
          autoFocus
          className={`${isMobile ? 'flex-1' : 'w-40 sm:w-56'} ${ISLAND_INPUT}`}
          style={ISLAND_INPUT_STYLE}
        />
        <span className="text-[11px] font-medium tabular-nums text-gray-400 dark:text-gray-500 shrink-0 pr-1">
          {t.resultsCount.replace('{count}', String(filteredCount))}
        </span>
      </div>
      <button
        onClick={onClose}
        className={`${ISLAND_BTN} shrink-0`}
        title={t.closeSearch}
        aria-label={t.closeSearch}
      >
        <X className="w-4.5 h-4.5" />
      </button>
    </IslandShell>
  )
}
