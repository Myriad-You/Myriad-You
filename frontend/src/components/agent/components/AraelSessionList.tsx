/**
 * AraelSessionList - 会话列表组件
 *
 * 现代化设计，显示：
 * - 搜索过滤
 * - 最近会话（标题 + 消息数 + 最后活跃时间）
 * - 点击会话加载消息
 * - 滑动/长按删除会话
 * - 新建对话按钮
 */

import type { ChatSession } from '../types'
import { LuSearch, LuX } from '@lib/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { useI18n } from '../../../contexts/I18nContext'
import { agentService } from '../../../services/agent'
import { Spinner } from '../../Spinner'

/** 格式化相对时间 */
function formatRelativeTime(
  dateStr: string,
  arael: {
    timeJustNow: string
    timeMinutesAgo: string
    timeHoursAgo: string
    timeDaysAgo: string
  },
  fmt: (template: string, params: Record<string, string | number>) => string,
): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return arael.timeJustNow
  if (diffMin < 60) return fmt(arael.timeMinutesAgo, { n: diffMin })
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return fmt(arael.timeHoursAgo, { n: diffHour })
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return fmt(arael.timeDaysAgo, { n: diffDay })
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export interface AraelSessionListProps {
  onSelectSession: (session: ChatSession) => void
  activeSessionId?: string | null
}

export const AraelSessionList: React.FC<AraelSessionListProps> = ({
  onSelectSession,
  activeSessionId,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const { t, format } = useI18n()
  const { isAuthenticated } = useAuth()

  const loadSessions = useCallback(async () => {
    // JWT-only endpoint — guests must not hit /api/agent/sessions
    if (!isAuthenticated) {
      setSessions([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await agentService.listSessions(1, 50)
      setSessions(
        list.map((s) => ({
          id: s.id,
          title: s.title,
          messageCount: s.messageCount,
          lastActiveAt: s.lastActiveAt,
          createdAt: s.createdAt,
        })),
      )
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) => (s.title || '').toLowerCase().includes(q))
  }, [sessions, searchQuery])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      if (deletingId) return
      setDeletingId(sessionId)
      try {
        await agentService.archiveSession(sessionId)
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      } catch {
        // silent
      } finally {
        setDeletingId(null)
      }
    },
    [deletingId],
  )

  return (
    <div className="arael-sessions">
      {/* Search bar */}
      <div className="arael-sessions-search-wrap">
        <label className="arael-sessions-search">
          <LuSearch
            className="arael-sessions-search-icon"
            size={14}
            aria-hidden
          />
          <input
            ref={searchRef}
            type="search"
            className="arael-sessions-search-input"
            placeholder={t.arael.searchSessions}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t.arael.searchSessions}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery ? (
            <button
              type="button"
              className="arael-sessions-search-clear"
              onClick={() => {
                setSearchQuery('')
                searchRef.current?.focus()
              }}
              aria-label={t.common.close}
            >
              <LuX size={12} aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      {/* Loading */}
      {loading && (
        <div className="arael-sessions-loading">
          <Spinner size="xs" color="primary" />
        </div>
      )}

      {/* List */}
      <div className="arael-sessions-items">
        {filteredSessions.map((session) => (
          <div
            key={session.id}
            className={`arael-sessions-item${session.id === activeSessionId ? ' active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectSession(session)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectSession(session)
              }
            }}
          >
            <div className="arael-sessions-item-row">
              <svg
                className="arael-sessions-item-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="arael-sessions-item-title">
                {session.title || t.arael.unnamedConversation}
              </span>
              <span className="arael-sessions-item-time">
                {formatRelativeTime(session.lastActiveAt, t.arael, format)}
              </span>
            </div>
            <div className="arael-sessions-item-sub">
              <span>
                {format(t.arael.messageCount, { count: session.messageCount })}
              </span>
              <button
                className="arael-sessions-item-delete"
                onClick={(e) => handleDelete(e, session.id)}
                title={t.arael.deleteSession}
                disabled={deletingId === session.id}
              >
                {deletingId === session.id ? (
                  <Spinner size="xs" color="primary" />
                ) : (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}

        {!loading && filteredSessions.length === 0 && (
          <div className="arael-sessions-empty">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{t.arael.noHistory}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AraelSessionList
