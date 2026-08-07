/**
 * 编辑模式组件
 */

import type { ImportProgress } from './types'
import {
  LuAlertCircle as AlertCircle,
  LuCheck as Check,
  LuCheckCircle as CheckCircle,
  LuCheckSquare as CheckSquare,
  LuDownload as Download,
  LuMinusSquare as MinusSquare,
  LuRefreshCw as RefreshCw,
  LuSquare as Square,
  LuTrash2 as Trash2,
  LuUpload as Upload,
  LuX as X,
} from '@lib/icons'

import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import { IslandShell } from '../../../shared/control-island'
import { Spinner } from '../../../Spinner'
import { ISLAND_BTN, ISLAND_BTN_DANGER, ISLAND_DIVIDER } from './constants'

export interface EditModeProps {
  variant: 'mobile' | 'desktop'
  selectedIds: Set<number>
  totalCount: number
  refreshableCount: number
  isDeleting: boolean
  isRefreshing: boolean
  isAuthenticated: boolean
  onSelectAll?: () => void
  onBatchDelete?: () => void
  onBatchRefresh?: () => void
  onMarkAllSourcesRead?: () => void
  onClose: () => void
  // 导入导出
  onBrewExport?: () => void
  onBrewImportFile?: (e: React.ChangeEvent<HTMLInputElement>) => void
  importExportLoading?: boolean
  importProgress?: ImportProgress | null
  importExportSuccess?: string | null
  importExportError?: string | null
  brewExportInputRef?: React.RefObject<HTMLInputElement | null>
  sourcesCount?: number
  t: {
    selectAll: string
    deselectAll: string
    deleteSelected: string
    refreshAllSources: string
    markAllAsRead: string
    exitEdit: string
    exportBrewpack: string
    importBrewpack: string
  }
}

export function EditMode({
  variant,
  selectedIds,
  totalCount,
  refreshableCount,
  isDeleting,
  isRefreshing,
  isAuthenticated,
  onSelectAll,
  onBatchDelete,
  onBatchRefresh,
  onMarkAllSourcesRead,
  onClose,
  onBrewExport,
  onBrewImportFile,
  importExportLoading = false,
  importProgress,
  importExportSuccess,
  importExportError,
  brewExportInputRef,
  sourcesCount = 0,
  t,
}: EditModeProps) {
  const isMobile = variant === 'mobile'

  // 移动端版本 - 简化
  if (isMobile) {
    return (
      <IslandShell variant="mobile" editStyle motionKey="edit-bar-mobile">
        <button
          onClick={onSelectAll}
          className={ISLAND_BTN}
          title={selectedIds.size === totalCount ? t.deselectAll : t.selectAll}
          aria-label={
            selectedIds.size === totalCount ? t.deselectAll : t.selectAll
          }
        >
          {selectedIds.size === totalCount ? (
            <CheckSquare className="w-5 h-5" />
          ) : selectedIds.size > 0 ? (
            <MinusSquare className="w-5 h-5" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 min-w-[4.5rem] text-center tabular-nums">
          {selectedIds.size} /{totalCount}
        </span>
        <button
          onClick={onBatchDelete}
          disabled={isDeleting || selectedIds.size === 0}
          className={ISLAND_BTN_DANGER}
          title={t.deleteSelected}
          aria-label={t.deleteSelected}
        >
          <Trash2 className="w-4.5 h-4.5" />
        </button>
        {refreshableCount > 0 && (
          <button
            onClick={onBatchRefresh}
            disabled={isRefreshing}
            className={`${ISLAND_BTN} disabled:opacity-30 disabled:cursor-not-allowed`}
            title={t.refreshAllSources}
            aria-label={t.refreshAllSources}
          >
            {isRefreshing ? (
              <Spinner size="sm" color="current" />
            ) : (
              <RefreshCw className="w-4.5 h-4.5" />
            )}
          </button>
        )}
        {isAuthenticated && onMarkAllSourcesRead && (
          <button
            onClick={onMarkAllSourcesRead}
            className={`${ISLAND_BTN} hover:text-green-600! dark:hover:text-green-400! hover:bg-green-500/10!`}
            title={t.markAllAsRead}
            aria-label={t.markAllAsRead}
          >
            <CheckCircle className="w-4.5 h-4.5" />
          </button>
        )}
        <button
          onClick={onClose}
          className={`ml-auto ${ISLAND_BTN}`}
          title={t.exitEdit}
          aria-label={t.exitEdit}
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </IslandShell>
    )
  }

  // 桌面端版本 - 完整功能
  return (
    <IslandShell variant="desktop" editStyle motionKey="edit-bar">
      {/* 全选按钮 */}
      <button
        onClick={onSelectAll}
        className={ISLAND_BTN}
        title={selectedIds.size === totalCount ? t.deselectAll : t.selectAll}
        aria-label={
          selectedIds.size === totalCount ? t.deselectAll : t.selectAll
        }
      >
        {selectedIds.size === totalCount ? (
          <CheckSquare className="w-5 h-5" />
        ) : selectedIds.size > 0 ? (
          <MinusSquare className="w-5 h-5" />
        ) : (
          <Square className="w-5 h-5" />
        )}
      </button>

      {/* 选中数量 */}
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 min-w-[4.5rem] text-center tabular-nums">
        {selectedIds.size} /{totalCount}
      </span>

      {/* 删除按钮 */}
      <button
        onClick={onBatchDelete}
        disabled={isDeleting || selectedIds.size === 0}
        className={ISLAND_BTN_DANGER}
        title={t.deleteSelected}
        aria-label={t.deleteSelected}
      >
        <Trash2 className="w-4.5 h-4.5" />
      </button>

      {/* 全部刷新按钮 */}
      {refreshableCount > 0 && (
        <button
          onClick={onBatchRefresh}
          disabled={isRefreshing}
          className={`${ISLAND_BTN} disabled:opacity-30 disabled:cursor-not-allowed`}
          title={t.refreshAllSources}
          aria-label={t.refreshAllSources}
        >
          {isRefreshing ? (
            <Spinner size="sm" color="current" />
          ) : (
            <RefreshCw className="w-4.5 h-4.5" />
          )}
        </button>
      )}

      {/* 全部已读按钮 */}
      {isAuthenticated && onMarkAllSourcesRead && (
        <button
          onClick={onMarkAllSourcesRead}
          className={`${ISLAND_BTN} hover:text-green-600! dark:hover:text-green-400! hover:bg-green-500/10!`}
          title={t.markAllAsRead}
          aria-label={t.markAllAsRead}
        >
          <CheckCircle className="w-4.5 h-4.5" />
        </button>
      )}

      {/* 分隔线 */}
      <div className={`${ISLAND_DIVIDER} mx-0.5`} />

      {/* 导出按钮 */}
      {onBrewExport && (
        <button
          onClick={onBrewExport}
          disabled={importExportLoading || sourcesCount === 0}
          className={`${ISLAND_BTN} hover:text-blue-600! dark:hover:text-blue-400! hover:bg-blue-500/10! disabled:opacity-30 disabled:cursor-not-allowed`}
          title={t.exportBrewpack}
          aria-label={t.exportBrewpack}
        >
          <Download
            className={`w-4.5 h-4.5 ${importExportLoading ? 'animate-pulse' : ''}`}
          />
        </button>
      )}

      {/* 导入按钮 */}
      {onBrewImportFile && (
        <label
          className={`${ISLAND_BTN} hover:text-blue-600! dark:hover:text-blue-400! hover:bg-blue-500/10! ${importExportLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          title={t.importBrewpack}
          aria-label={t.importBrewpack}
        >
          <Upload
            className={`w-4.5 h-4.5 ${importExportLoading ? 'animate-pulse' : ''}`}
          />
          <input
            ref={brewExportInputRef}
            type="file"
            accept=".brewpack,.zip"
            onChange={onBrewImportFile}
            className="hidden"
            disabled={importExportLoading}
            aria-label={t.importBrewpack}
          />
        </label>
      )}

      {/* 导入进度显示 */}
      <AnimatePresence>
        {importProgress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50"
          >
            <Spinner size="xs" color="current" className="shrink-0" />
            <span className="truncate max-w-40">{importProgress.step}</span>
            {importProgress.total > 0 && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40">
                {importProgress.current}/{importProgress.total}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 导入/导出反馈提示 */}
      <AnimatePresence>
        {(importExportSuccess || importExportError) && !importProgress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, x: -10 }}
            transition={{ duration: 0.2 }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium ${
              importExportSuccess
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/50'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-800/50'
            }`}
          >
            {importExportSuccess ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate max-w-48">
              {importExportSuccess || importExportError}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 退出按钮 */}
      <button
        onClick={onClose}
        className={ISLAND_BTN}
        title={t.exitEdit}
        aria-label={t.exitEdit}
      >
        <X className="w-4.5 h-4.5" />
      </button>
    </IslandShell>
  )
}
