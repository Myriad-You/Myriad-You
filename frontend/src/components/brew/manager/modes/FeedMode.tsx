/**
 * Feed 模式组件 - 单个订阅源文章列表视图
 */

import type { FeedModeConfig } from './types'

import {
  LuCheckCircle as CheckCircle,
  LuChevronLeft as ChevronLeft,
  LuExternalLink as ExternalLink,
  LuRefreshCw as RefreshCw,
  LuRss as Rss,
} from '@lib/icons'
import { IslandShell } from '../../../shared/control-island'
import { Spinner } from '../../../Spinner'
import { ISLAND_BTN, ISLAND_DIVIDER } from './constants'

export interface FeedModeProps {
  variant: 'mobile' | 'desktop'
  feedMode: FeedModeConfig
  isAdmin?: boolean
  isAuthenticated?: boolean
  t: {
    backToSourceList: string
    articlesCount: string
    tipUnreadCount: string
    refreshSource: string
    markAllAsRead: string
    visitWebsite: string
  }
}

export function FeedMode({
  variant,
  feedMode,
  isAdmin = false,
  isAuthenticated = false,
  t,
}: FeedModeProps) {
  return (
    <IslandShell variant={variant} motionKey={`feed-bar-${variant}`}>
      {/* 返回按钮 */}
      <button
        onClick={feedMode.onBack}
        className={ISLAND_BTN}
        title={t.backToSourceList}
        aria-label={t.backToSourceList}
      >
        <ChevronLeft className="w-4.5 h-4.5" />
      </button>

      {/* 订阅源信息 */}
      <div className="flex items-center gap-2 h-9 px-2 min-w-0 flex-1">
        {feedMode.source.icon ? (
          <img
            src={feedMode.source.icon}
            alt=""
            className="w-7 h-7 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: feedMode.source.theme_color || '#F97316',
            }}
          >
            <Rss className="w-4 h-4 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
            {feedMode.source.name}
          </h3>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <span>
              {t.articlesCount.replace('{count}', String(feedMode.total))}
            </span>
            {feedMode.source.unread_count > 0 && (
              <span
                className="font-medium"
                style={{ color: feedMode.source.theme_color || '#F97316' }}
              >
                {t.tipUnreadCount.replace(
                  '{count}',
                  String(feedMode.source.unread_count),
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 分隔线 */}
      <div className={ISLAND_DIVIDER} />

      {/* 刷新按钮 - 仅管理员可见 */}
      {isAdmin && (
        <button
          onClick={feedMode.onRefresh}
          disabled={feedMode.isRefreshing}
          className={`${ISLAND_BTN} disabled:opacity-50`}
          title={t.refreshSource}
          aria-label={t.refreshSource}
        >
          {feedMode.isRefreshing ? (
            <Spinner size="sm" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </button>
      )}

      {/* 全部已读按钮 */}
      {isAuthenticated && feedMode.source.unread_count > 0 && (
        <button
          onClick={feedMode.onMarkAllRead}
          className={`${ISLAND_BTN} hover:text-green-600! dark:hover:text-green-400! hover:bg-green-500/10!`}
          title={t.markAllAsRead}
          aria-label={t.markAllAsRead}
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      )}

      {/* 访问网站按钮 */}
      {feedMode.source.site_url && (
        <a
          href={feedMode.source.site_url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${ISLAND_BTN} hover:text-blue-500! hover:bg-blue-500/10!`}
          title={t.visitWebsite}
          aria-label={t.visitWebsite}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </IslandShell>
  )
}
