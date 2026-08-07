import type { StepDebugEntry, TaskExecution } from '../types'
import React, { useCallback, useMemo, useState } from 'react'
import './AraelDebugPanel.css'

export interface AraelDebugPanelProps {
  execution?: TaskExecution
  onClose: () => void
}

function formatJson(obj: unknown, maxLen = 2000): string {
  try {
    const s = JSON.stringify(obj, null, 2)
    return s.length > maxLen ? `${s.slice(0, maxLen)}\n... (truncated)` : s
  } catch {
    return String(obj)
  }
}

function formatMs(ms?: number): string {
  if (ms == null) return '-'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

/** Collapsible section wrapper */
const Section: React.FC<{
  title: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}> = ({ title, count, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="adb-section">
      <button className="adb-section-toggle" onClick={() => setOpen(!open)}>
        <span className={`adb-chevron${open ? ' adb-chevron-open' : ''}`} />
        <span className="adb-section-title">{title}</span>
        {count != null && <span className="adb-section-count">{count}</span>}
      </button>
      {open && <div className="adb-section-body">{children}</div>}
    </div>
  )
}

/** Collapsible JSON block */
const JsonBlock: React.FC<{
  label: string
  data: unknown
  defaultOpen?: boolean
}> = ({ label, data, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)
  if (data == null) return null
  return (
    <div className="adb-json-block">
      <button className="adb-json-toggle" onClick={() => setOpen(!open)}>
        <span
          className={`adb-chevron adb-chevron-sm${open ? ' adb-chevron-open' : ''}`}
        />
        {label}
      </button>
      {open && <pre className="adb-json-pre">{formatJson(data)}</pre>}
    </div>
  )
}

/** Step debug card */
const StepCard: React.FC<{ entry: StepDebugEntry; index: number }> = ({
  entry,
  index,
}) => {
  const [expanded, setExpanded] = useState(false)
  const statusClass =
    entry.success === true
      ? 'adb-ok'
      : entry.success === false
        ? 'adb-fail'
        : 'adb-pending'

  return (
    <div className={`adb-step-card ${statusClass}`}>
      <button
        className="adb-step-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="adb-step-index">{index + 1}</span>
        <span className={`adb-step-dot ${statusClass}`} />
        <span className="adb-step-cap">{entry.capabilityId}</span>
        {entry.isDynamic && <span className="adb-badge-dynamic">dyn</span>}
        {entry.durationMs != null && (
          <span className="adb-step-time">{formatMs(entry.durationMs)}</span>
        )}
        <span
          className={`adb-chevron adb-chevron-sm${expanded ? ' adb-chevron-open' : ''}`}
        />
      </button>
      {expanded && (
        <div className="adb-step-body">
          {entry.directive && (
            <div className="adb-field">
              <span className="adb-field-label">Directive</span>
              <pre className="adb-field-value">{entry.directive}</pre>
            </div>
          )}
          {entry.userRequest && (
            <div className="adb-field">
              <span className="adb-field-label">User Request</span>
              <pre className="adb-field-value">{entry.userRequest}</pre>
            </div>
          )}
          <JsonBlock label="Params" data={entry.params} defaultOpen />
          {entry.outputPreview && (
            <div className="adb-field">
              <span className="adb-field-label">Output</span>
              <pre className="adb-field-value adb-output">
                {entry.outputPreview}
              </pre>
            </div>
          )}
          {entry.error && (
            <div className="adb-field">
              <span className="adb-field-label">Error</span>
              <pre className="adb-field-value adb-error-text">
                {entry.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const AraelDebugPanel: React.FC<AraelDebugPanelProps> = ({
  execution,
  onClose,
}) => {
  const [copied, setCopied] = useState(false)
  const debugTrace = execution?.debugTrace
  const execTrace = execution?.executionTrace

  const buildCopyData = useCallback((): string => {
    if (!execution) return '(no data)'
    const lines: string[] = []
    lines.push(`=== Agent Debug Trace ===`)
    lines.push(`Time: ${new Date().toISOString()}`)
    lines.push(`TaskId: ${execution.taskId}`)
    lines.push(`Status: ${execution.status}`)
    lines.push(`Progress: ${execution.progress}%`)
    lines.push('')

    const pd = debugTrace?.plannerDecision ?? execTrace?.plannerDecision
    if (pd) {
      lines.push(`[Planner Decision]`)
      lines.push(`Status: ${pd.status}`)
      lines.push(`Confidence: ${pd.confidence}`)
      if ('userRequest' in pd) {
        lines.push(
          `User Request: ${(pd as { userRequest: string }).userRequest}`,
        )
      }
      if (pd.reasoning) lines.push(`Reasoning: ${pd.reasoning}`)
      const steps = ('steps' in pd ? pd.steps : pd.plannedSteps) ?? []
      lines.push(`Planned Steps (${steps.length}):`)
      for (const s of steps as Array<{
        id: string
        capabilityId: string
        action: string
        params?: unknown
      }>) {
        lines.push(`  ${s.id}: ${s.capabilityId} | ${s.action}`)
        if (s.params) lines.push(`    params: ${JSON.stringify(s.params)}`)
      }
      lines.push('')
    }

    const entries = debugTrace?.stepDebugEntries ?? []
    if (entries.length > 0) {
      lines.push(`[Step Debug Entries] (${entries.length})`)
      for (const e of entries) {
        lines.push(
          `  --- ${e.stepId} (${e.capabilityId}) ${e.isDynamic ? '[dynamic]' : ''} ---`,
        )
        if (e.directive) lines.push(`  directive: ${e.directive}`)
        if (e.params) lines.push(`  params: ${JSON.stringify(e.params)}`)
        if (e.success != null)
          lines.push(`  success: ${e.success} | ${formatMs(e.durationMs)}`)
        if (e.outputPreview)
          lines.push(`  output: ${e.outputPreview.slice(0, 500)}`)
        if (e.error) lines.push(`  error: ${e.error}`)
      }
      lines.push('')
    }

    if (execTrace) {
      lines.push(`[Execution Trace]`)
      lines.push(`TotalDuration: ${formatMs(execTrace.totalDurationMs)}`)
      lines.push(
        `TierUsage: ${JSON.stringify(Object.fromEntries(Object.entries(execTrace.tierUsage).filter(([k]) => k)))}`,
      )
      for (const st of execTrace.steps) {
        lines.push(
          `  ${st.stepId}: ${st.capabilityId} | ${st.success ? 'ok' : 'fail'} | ${formatMs(st.durationMs)}${st.tierUsed ? ` | tier=${st.tierUsed}` : ''}`,
        )
        if (st.action) lines.push(`    action: ${st.action}`)
        if (st.error) lines.push(`    error: ${st.error}`)
        if (st.outputPreview)
          lines.push(`    output: ${st.outputPreview.slice(0, 300)}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }, [execution, debugTrace, execTrace])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(buildCopyData())
    setCopied(true)
    setTimeout(setCopied, 1500, false)
  }, [buildCopyData])

  const plannerInfo = useMemo(() => {
    const pd = debugTrace?.plannerDecision
    if (pd) return pd
    const etPd = execTrace?.plannerDecision
    if (etPd) {
      return {
        status: etPd.status,
        reasoning: etPd.reasoning,
        confidence: etPd.confidence,
        steps: etPd.plannedSteps,
        userRequest: '',
      }
    }
    return null
  }, [debugTrace, execTrace])

  const stepEntries = debugTrace?.stepDebugEntries ?? []

  if (!execution) {
    return (
      <div className="adb-panel">
        <div className="adb-header">
          <span className="adb-title">Debug</span>
          <button className="adb-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <div className="adb-empty">No execution data</div>
      </div>
    )
  }

  return (
    <div className="adb-panel">
      <div className="adb-header">
        <span className="adb-title">Debug</span>
        <div className="adb-header-actions">
          <button className="adb-copy-btn" onClick={handleCopy}>
            {copied ? 'Copied' : 'Copy All'}
          </button>
          <button className="adb-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
      </div>

      <div className="adb-body">
        {/* Task overview — always open, compact */}
        <Section title="Overview" defaultOpen>
          <div className="adb-kv-grid">
            <span className="adb-kv-k">Task</span>
            <span className="adb-kv-v">{execution.taskId}</span>
            <span className="adb-kv-k">Status</span>
            <span className="adb-kv-v">{execution.status}</span>
            <span className="adb-kv-k">Progress</span>
            <span className="adb-kv-v">{execution.progress}%</span>
            {execTrace && (
              <>
                <span className="adb-kv-k">Duration</span>
                <span className="adb-kv-v">
                  {formatMs(execTrace.totalDurationMs)}
                </span>
                <span className="adb-kv-k">Tier Usage</span>
                <span className="adb-kv-v">
                  {Object.entries(execTrace.tierUsage)
                    .filter(([k]) => k)
                    .map(([k, v]) => `${k} x${v}`)
                    .join(', ')}
                </span>
              </>
            )}
          </div>
        </Section>

        {/* Planner decision — collapsed by default */}
        {plannerInfo && (
          <Section title="Planner Decision" defaultOpen={false}>
            <div className="adb-kv-grid">
              <span className="adb-kv-k">Status</span>
              <span className="adb-kv-v">{plannerInfo.status}</span>
              <span className="adb-kv-k">Confidence</span>
              <span className="adb-kv-v">
                {(plannerInfo.confidence * 100).toFixed(0)}%
              </span>
              {plannerInfo.userRequest && (
                <>
                  <span className="adb-kv-k">Request</span>
                  <span className="adb-kv-v">{plannerInfo.userRequest}</span>
                </>
              )}
            </div>
            {plannerInfo.reasoning && (
              <div className="adb-field">
                <span className="adb-field-label">Reasoning</span>
                <pre className="adb-field-value">{plannerInfo.reasoning}</pre>
              </div>
            )}
            {plannerInfo.steps && plannerInfo.steps.length > 0 && (
              <div className="adb-planner-steps">
                <span className="adb-field-label">
                  Planned Steps ({plannerInfo.steps.length})
                </span>
                {plannerInfo.steps.map(
                  (
                    s: {
                      id: string
                      capabilityId?: string
                      capability_id?: string
                      action: string
                      params?: Record<string, unknown>
                    },
                    i: number,
                  ) => (
                    <div key={s.id} className="adb-planner-step-row">
                      <span className="adb-ps-idx">{i + 1}.</span>
                      <span className="adb-ps-cap">
                        {s.capabilityId ?? s.capability_id ?? ''}
                      </span>
                      <span className="adb-ps-action">{s.action}</span>
                      {s.params && <JsonBlock label="params" data={s.params} />}
                    </div>
                  ),
                )}
              </div>
            )}
          </Section>
        )}

        {/* Step debug entries */}
        {stepEntries.length > 0 && (
          <Section
            title="Step Execution"
            count={stepEntries.length}
            defaultOpen
          >
            {stepEntries.map((entry, i) => (
              <StepCard key={entry.stepId} entry={entry} index={i} />
            ))}
          </Section>
        )}

        {/* ExecutionTrace fallback (when no live debug entries) */}
        {stepEntries.length === 0 &&
          execTrace &&
          execTrace.steps.length > 0 && (
            <Section
              title="Execution Trace"
              count={execTrace.steps.length}
              defaultOpen
            >
              {execTrace.steps.map((st, i) => (
                <div
                  key={st.stepId}
                  className={`adb-step-card ${st.success ? 'adb-ok' : 'adb-fail'}`}
                >
                  <div className="adb-step-header adb-step-header-static">
                    <span className="adb-step-index">{i + 1}</span>
                    <span
                      className={`adb-step-dot ${st.success ? 'adb-ok' : 'adb-fail'}`}
                    />
                    <span className="adb-step-cap">{st.capabilityId}</span>
                    {st.isDynamic && (
                      <span className="adb-badge-dynamic">dyn</span>
                    )}
                    <span className="adb-step-time">
                      {formatMs(st.durationMs)}
                    </span>
                    {st.tierUsed && (
                      <span className="adb-step-tier">{st.tierUsed}</span>
                    )}
                  </div>
                  {st.action && (
                    <div className="adb-field">
                      <span className="adb-field-label">Action</span>
                      <pre className="adb-field-value">{st.action}</pre>
                    </div>
                  )}
                  <JsonBlock label="Params" data={st.params} />
                  {st.outputPreview && (
                    <div className="adb-field">
                      <span className="adb-field-label">Output</span>
                      <pre className="adb-field-value adb-output">
                        {st.outputPreview}
                      </pre>
                    </div>
                  )}
                  {st.error && (
                    <div className="adb-field">
                      <span className="adb-field-label">Error</span>
                      <pre className="adb-field-value adb-error-text">
                        {st.error}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}
      </div>
    </div>
  )
}

export default AraelDebugPanel
