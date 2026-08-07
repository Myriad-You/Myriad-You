/**
 * 开发环境性能监控面板（右下角）
 *
 * - 收缩：FPS · 内存 · Long Tasks（2s 轮询，最小开销）
 * - 展开：帧 / 运行时 / 稳定 / 动画 / 协调器 / 资源 单页分区
 * - 数据只来自浏览器 API 与项目内权威状态源，不 monkey-patch
 */

import type { CSSProperties } from 'react'
import { useCallback, useEffect, useState } from 'react'

import { coordinator as animationCoordinator } from '../hooks/animation'
import { usePerfMetrics } from '../hooks/usePerfMetrics'
import { clearLyricsCache, clearPlaylistCache } from '../utils/musicPlayer'
import { globalResourceLoader } from '../utils/resourceLoader'

import './PerformanceMonitor.css'

function fpsClass(fps: number, low: boolean): string {
  if (low || fps < 30) return 'pm-bad'
  if (fps < 55) return 'pm-warn'
  return 'pm-ok'
}

function memClass(pct: number | undefined): string {
  if (pct == null) return 'pm-muted'
  if (pct >= 85) return 'pm-bad'
  if (pct >= 70) return 'pm-warn'
  return 'pm-ok'
}

function clsClass(cls: number): string {
  if (cls > 0.25) return 'pm-bad'
  if (cls > 0.1) return 'pm-warn'
  return 'pm-ok'
}

export default function PerformanceMonitor() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [pauseAll, setPauseAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const {
    snapshot,
    refreshAnimations,
    resetLongTasks,
    resetCls,
    configureCoordinator,
  } = usePerfMetrics(isExpanded)

  const { frame, memory, stability, animations, coordinator, resource } =
    snapshot

  // 快捷键 Ctrl/Cmd+Shift+M
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setIsExpanded((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 暂停页面动画（调试用，手动开关）
  useEffect(() => {
    const id = 'perf-pause-animations'
    if (!pauseAll) {
      document.getElementById(id)?.remove()
      return
    }
    const style = document.createElement('style')
    style.id = id
    style.textContent = `*,*::before,*::after{animation-play-state:paused!important;transition:none!important}`
    document.head.appendChild(style)
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [pauseAll])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(setToast, 1600, null)
  }, [])

  const hasResourceActivity = resource.queued > 0 || resource.active > 0

  return (
    <div
      data-perf-monitor
      className={`pm-root ${isExpanded ? 'pm-expanded' : ''}`}
    >
      {/* ── 标题栏 / 收缩摘要 ── */}
      <div className="pm-bar">
        <div className="pm-bar-left">
          <span className="pm-label">Perf</span>
          <span className={`pm-value ${fpsClass(frame.fps, frame.isLowFps)}`}>
            {frame.fps}
            <span className="pm-unit">fps</span>
          </span>
          {memory && (
            <span className={`pm-value ${memClass(memory.usedPercent)}`}>
              {memory.usedMB}
              <span className="pm-unit">MB</span>
            </span>
          )}
          {stability.longTaskCount > 0 && (
            <span
              className={`pm-value ${stability.longTaskCount > 5 ? 'pm-bad' : 'pm-warn'}`}
              title={
                stability.lastLongTaskMs
                  ? `最近 Long Task ${stability.lastLongTaskMs}ms`
                  : 'Long Tasks'
              }
            >
              LT {stability.longTaskCount}
            </span>
          )}
        </div>
        <button
          type="button"
          className="pm-toggle"
          onClick={() => setIsExpanded((v) => !v)}
          title={
            isExpanded
              ? '收起 (Ctrl+Shift+M)'
              : '展开 (Ctrl+Shift+M)'
          }
          aria-expanded={isExpanded}
        >
          {isExpanded ? '▼' : '▲'}
        </button>
      </div>

      {/* ── 展开详情 ── */}
      {isExpanded && (
        <div className="pm-body">
          {/* 帧 */}
          <section className="pm-section">
            <div className="pm-section-title">帧</div>
            <div className="pm-grid">
              <Row
                label="FPS"
                value={`${frame.fps}`}
                className={fpsClass(frame.fps, frame.isLowFps)}
              />
              <Row label="平均帧时" value={`${frame.avgFrameTime} ms`} />
              <Row
                label="P95"
                value={`${frame.p95FrameMs} ms`}
                className={
                  frame.p95FrameMs > frame.jankThresholdMs
                    ? 'pm-bad'
                    : frame.p95FrameMs > frame.jankThresholdMs * 0.6
                      ? 'pm-warn'
                      : undefined
                }
              />
              <Row
                label="最差帧"
                value={`${frame.maxFrameMs} ms`}
                className={
                  frame.maxFrameMs > frame.jankThresholdMs
                    ? 'pm-bad'
                    : frame.maxFrameMs > frame.jankThresholdMs * 0.75
                      ? 'pm-warn'
                      : undefined
                }
              />
              <Row
                label="卡顿率"
                value={`${Math.round(frame.jankRatio * 100)}%`}
                className={
                  frame.jankRatio > 0.1
                    ? 'pm-bad'
                    : frame.jankRatio > 0.02
                      ? 'pm-warn'
                      : 'pm-muted'
                }
              />
              <Row
                label="刷新率"
                value={
                  frame.refreshRateDetected
                    ? `${frame.detectedRefreshRate} Hz`
                    : '检测中…'
                }
              />
              <Row
                label="低帧模式"
                value={frame.isLowFps ? 'ON' : 'OFF'}
                className={frame.isLowFps ? 'pm-warn' : 'pm-muted'}
              />
              <Row
                label="采样"
                value={frame.isMonitoring ? '运行中' : '未启动'}
                className={frame.isMonitoring ? 'pm-ok' : 'pm-warn'}
              />
            </div>
          </section>

          {/* 运行时 */}
          <section className="pm-section">
            <div className="pm-section-title">
              运行时
              {!memory && (
                <span className="pm-hint">内存仅 Chromium</span>
              )}
            </div>
            <div className="pm-grid">
              {memory ? (
                <>
                  <Row
                    label="Heap"
                    value={`${memory.usedMB} / ${memory.limitMB} MB`}
                    className={memClass(memory.usedPercent)}
                  />
                  <div className="pm-row pm-row-full">
                    <span className="pm-muted">使用率</span>
                    <div className="pm-meter" aria-hidden>
                      <div
                        className={`pm-meter-fill ${memClass(memory.usedPercent)}`}
                        style={
                          {
                            '--pm-pct': `${memory.usedPercent}%`,
                          } as CSSProperties
                        }
                      />
                    </div>
                    <span className={memClass(memory.usedPercent)}>
                      {memory.usedPercent}%
                    </span>
                  </div>
                </>
              ) : (
                <Row label="Heap" value="不可用" className="pm-muted" />
              )}
              <Row
                label="Long Tasks"
                value={
                  stability.longTaskCount > 0
                    ? `${stability.longTaskCount}${
                        stability.lastLongTaskMs
                          ? ` · 最近 ${stability.lastLongTaskMs}ms`
                          : ''
                      }`
                    : '0'
                }
                className={
                  stability.longTaskCount > 5
                    ? 'pm-bad'
                    : stability.longTaskCount > 0
                      ? 'pm-warn'
                      : undefined
                }
              />
            </div>
            {stability.longTaskCount > 0 && (
              <button
                type="button"
                className="pm-btn pm-btn-ghost"
                onClick={resetLongTasks}
              >
                重置 LT 计数
              </button>
            )}
          </section>

          {/* 稳定 */}
          <section className="pm-section">
            <div className="pm-section-title">稳定</div>
            <div className="pm-grid">
              <Row
                label="CLS"
                value={stability.cls.toFixed(4)}
                className={clsClass(stability.cls)}
              />
              <Row
                label="FCP"
                value={
                  stability.fcpMs != null ? `${stability.fcpMs} ms` : '—'
                }
              />
            </div>
            {stability.cls > 0 && (
              <button
                type="button"
                className="pm-btn pm-btn-ghost"
                onClick={resetCls}
              >
                重置 CLS
              </button>
            )}
          </section>

          {/* 动画（WAAPI） */}
          <section className="pm-section">
            <div className="pm-section-title">
              动画
              <span className="pm-hint">document.getAnimations()</span>
            </div>
            <div className="pm-grid">
              <Row
                label="运行中"
                value={`${animations.running}`}
                className={
                  animations.running > 15 ? 'pm-warn' : 'pm-ok'
                }
              />
              <Row label="总计" value={`${animations.total}`} />
            </div>
            {animations.items.length > 0 && (
              <ul className="pm-list">
                {animations.items.map((item, i) => (
                  <li key={`${item.target}-${item.name}-${i}`}>
                    <span className="pm-list-target" title={item.target}>
                      {item.target}
                    </span>
                    <span className="pm-muted">
                      {item.name}
                      {item.durationMs != null
                        ? ` · ${Math.round(item.durationMs)}ms`
                        : ''}
                      {item.infinite ? ' · ∞' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="pm-actions">
              <button
                type="button"
                className="pm-btn"
                onClick={refreshAnimations}
              >
                刷新列表
              </button>
              <button
                type="button"
                className={`pm-btn ${pauseAll ? 'pm-btn-active' : ''}`}
                onClick={() => setPauseAll((v) => !v)}
              >
                {pauseAll ? '恢复动画' : '暂停全部'}
              </button>
            </div>
          </section>

          {/* 协调器：瞬时槽位常为 0 是正常的，看峰值/累计 */}
          <section className="pm-section">
            <div className="pm-section-title">
              动画协调器
              <span className="pm-hint">瞬时槽位·空闲≈0</span>
            </div>
            <div className="pm-grid">
              <Row
                label="瞬时活跃"
                value={`${coordinator.activeSlots} / ${coordinator.maxConcurrent}`}
                className={
                  coordinator.activeSlots >= coordinator.maxConcurrent
                    ? 'pm-warn'
                    : coordinator.activeSlots > 0
                      ? 'pm-ok'
                      : 'pm-muted'
                }
              />
              <Row
                label="会话峰值"
                value={`${coordinator.peakActiveSlots}`}
                className={
                  coordinator.peakActiveSlots > 0 ? 'pm-ok' : 'pm-muted'
                }
              />
              <Row
                label="等待/延迟"
                value={`${coordinator.waitingQueue} / ${coordinator.delayedQueue}`}
                className={
                  coordinator.totalQueued > 5 ? 'pm-warn' : 'pm-muted'
                }
              />
              <Row
                label="累计调度"
                value={`${coordinator.totalScheduled}`}
                className={
                  coordinator.totalScheduled > 0 ? 'pm-ok' : 'pm-muted'
                }
              />
              <Row
                label="累计占槽"
                value={`${coordinator.totalAcquired}`}
                className={
                  coordinator.totalAcquired > 0 ? 'pm-ok' : 'pm-muted'
                }
              />
              <Row
                label="状态登记"
                value={`${coordinator.statesSize}`}
              />
              <Row
                label="页就绪"
                value={coordinator.pageReady ? 'YES' : 'NO'}
                className={coordinator.pageReady ? 'pm-ok' : 'pm-warn'}
              />
              <Row
                label="Burst"
                value={coordinator.inBurstMode ? 'ON' : 'OFF'}
                className={
                  coordinator.inBurstMode ? 'pm-ok' : 'pm-muted'
                }
              />
              {coordinator.currentPageId && (
                <div className="pm-row pm-row-full">
                  <span className="pm-muted">页面</span>
                  <span className="pm-list-target" title={coordinator.currentPageId}>
                    {coordinator.currentPageId}
                  </span>
                </div>
              )}
            </div>
            <div className="pm-actions">
              <button
                type="button"
                className="pm-btn"
                onClick={() =>
                  configureCoordinator({
                    baseConcurrent: 6,
                    burstConcurrent: 16,
                  })
                }
              >
                节能 6/16
              </button>
              <button
                type="button"
                className="pm-btn"
                onClick={() =>
                  configureCoordinator({
                    baseConcurrent: 16,
                    burstConcurrent: 48,
                  })
                }
              >
                默认 16/48
              </button>
              <button
                type="button"
                className="pm-btn"
                onClick={() =>
                  configureCoordinator({
                    baseConcurrent: 24,
                    burstConcurrent: 48,
                  })
                }
              >
                性能 24/48
              </button>
              <button
                type="button"
                className="pm-btn pm-btn-ghost"
                onClick={() => {
                  animationCoordinator.resetConcurrencyStats()
                  showToast('会话统计已重置')
                }}
              >
                重置峰值
              </button>
            </div>
          </section>

          {/* 资源队列 */}
          <section className="pm-section">
            <div className="pm-section-title">资源队列</div>
            <div className="pm-grid">
              <Row
                label="排队"
                value={`${resource.queued}`}
                className={resource.queued > 0 ? 'pm-warn' : 'pm-muted'}
              />
              <Row
                label="进行中"
                value={`${resource.active}`}
                className={resource.active > 0 ? 'pm-ok' : 'pm-muted'}
              />
              <Row label="完成" value={`${resource.completed}`} />
              <Row
                label="失败"
                value={`${resource.failed}`}
                className={resource.failed > 0 ? 'pm-bad' : 'pm-muted'}
              />
            </div>
            <div className="pm-actions">
              <button
                type="button"
                className="pm-btn"
                disabled={!hasResourceActivity}
                onClick={() => {
                  globalResourceLoader.clear()
                  showToast('队列已清空')
                }}
              >
                清空队列
              </button>
              <button
                type="button"
                className="pm-btn"
                onClick={() => {
                  globalResourceLoader.reset()
                  showToast('统计已重置')
                }}
              >
                重置统计
              </button>
              <button
                type="button"
                className="pm-btn"
                onClick={() => {
                  clearPlaylistCache()
                  clearLyricsCache()
                  showToast('音乐缓存已清')
                }}
              >
                清音乐缓存
              </button>
            </div>
          </section>

          {toast && <div className="pm-toast">{toast}</div>}
        </div>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="pm-row">
      <span className="pm-muted">{label}</span>
      <span className={className}>{value}</span>
    </div>
  )
}
