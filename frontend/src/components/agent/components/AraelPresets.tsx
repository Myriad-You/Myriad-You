/**
 * AraelPresets - 收藏胶囊组件
 *
 * 与 AraelPanel.tsx 源文件的收藏胶囊保持一致
 * 使用 .arael-* CSS 类
 */

import type { TaskPreset } from '../../../services/agent'

import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import React from 'react'
import { useI18n } from '../../../contexts/I18nContext'
import { SPRING_SNAPPY } from '../types'

/** 收藏胶囊 Props */
export interface AraelPresetsProps {
  /** 收藏列表 */
  favorites: TaskPreset[]
  /** 是否显示 */
  isVisible: boolean
  /** 使用预设回调 */
  onUsePreset: (preset: TaskPreset) => void
  /** 切换收藏回调 */
  onToggleFavorite: (presetId: number) => void
}

/**
 * 收藏胶囊组件 - 与源文件一致
 */
export const AraelPresets: React.FC<AraelPresetsProps> = ({
  favorites,
  isVisible,
  onUsePreset,
  onToggleFavorite,
}) => {
  const { t } = useI18n()
  return (
    <AnimatePresence>
      {isVisible &&
        favorites.map((preset, index) => (
          <motion.div
            key={preset.id}
            className="arael-favorite-capsule"
            title={preset.input}
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              y: -10,
              scale: 0.9,
              transition: { duration: 0.15, delay: index * 0.02 },
            }}
            transition={{ ...SPRING_SNAPPY, delay: 0.2 + index * 0.05 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="arael-favorite-text">
              {preset.input.length > 18
                ? `${preset.input.slice(0, 18)}...`
                : preset.input}
            </span>
            {/* 悬浮操作层 */}
            <div className="arael-favorite-actions">
              <button
                className="arael-favorite-action arael-favorite-run"
                onClick={(e) => {
                  e.stopPropagation()
                  onUsePreset(preset)
                }}
                title={t.arael.run}
              >
                {t.arael.run}
              </button>
              <button
                className="arael-favorite-action arael-favorite-unfav"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleFavorite(preset.id)
                }}
                title={t.arael.unfavorite}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
    </AnimatePresence>
  )
}

export default AraelPresets
