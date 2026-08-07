/**
 * Pure helpers for reattaching live agent work after session load / notification open.
 * Driven by the same candidate logic as AraelPanel.reattachLiveWork.
 */

export interface ReattachMessageRef {
  id: string
  role: string
  taskId?: string
  runId?: string
}

export interface ReattachCandidate {
  /** Host chat message id for UI updates */
  messageId: string
  taskId?: string
  runId?: string
}

export interface ReattachHints {
  runId?: string
  taskId?: string
}

/**
 * Collect reattach candidates from loaded messages + optional notification hints.
 *
 * Rules (user-stability critical):
 * - Merge runId/taskId across messages that share the same task (newer message
 *   is preferred as host, but runId from an older first-wait message is kept).
 * - Hints with only runId (early task_progress notification) still produce a
 *   candidate so the client can re-subscribe without a taskId.
 * - Hints with taskId seed a candidate even if no message yet has that task.
 */
export function collectReattachCandidates(
  messages: ReattachMessageRef[],
  hints?: ReattachHints,
): ReattachCandidate[] {
  // taskId -> accumulated identity (newest messageId, any known runId)
  const byTask = new Map<string, ReattachCandidate>()
  // runId -> last message that carried it
  const byRun = new Map<string, ReattachCandidate>()

  for (const m of messages) {
    if (m.role !== 'assistant') continue
    const taskId =
      m.taskId && !m.taskId.startsWith('confirmation:') ? m.taskId : undefined
    const runId = m.runId || undefined

    if (taskId) {
      const prev = byTask.get(taskId)
      byTask.set(taskId, {
        messageId: m.id,
        taskId,
        // Prefer any known runId: keep previous if this message omitted it
        runId: runId || prev?.runId,
      })
    }
    if (runId) {
      const prev = byRun.get(runId)
      byRun.set(runId, {
        messageId: m.id,
        runId,
        taskId: taskId || prev?.taskId,
      })
      // Back-fill runId onto task map if we now know it
      if (taskId) {
        const t = byTask.get(taskId)
        if (t && !t.runId) t.runId = runId
      }
    }
  }

  // Second pass: if any message has both ids, ensure task entry has runId
  for (const m of messages) {
    if (!m.taskId || !m.runId) continue
    if (m.taskId.startsWith('confirmation:')) continue
    const t = byTask.get(m.taskId)
    if (t && !t.runId) t.runId = m.runId
  }

  const out: ReattachCandidate[] = []
  const pushUnique = (c: ReattachCandidate, preferMessageId = false) => {
    if (!c.messageId && !c.runId && !c.taskId) return
    const existing = out.find(
      (x) =>
        (c.taskId && x.taskId === c.taskId) ||
        (c.runId && x.runId === c.runId),
    )
    if (existing) {
      // Fill missing identity only; do not clobber a newer host messageId
      // with an older first-wait message that merely had the runId.
      if (!existing.runId && c.runId) existing.runId = c.runId
      if (!existing.taskId && c.taskId) existing.taskId = c.taskId
      if (preferMessageId && c.messageId) existing.messageId = c.messageId
      return
    }
    out.push({ ...c })
  }

  const lastAssistant =
    [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? ''

  if (hints?.taskId) {
    const fromTask = byTask.get(hints.taskId)
    const fromRun = hints.runId ? byRun.get(hints.runId) : undefined
    pushUnique(
      {
        messageId:
          fromTask?.messageId ||
          fromRun?.messageId ||
          lastAssistant ||
          `hint_task_${hints.taskId}`,
        taskId: hints.taskId,
        runId: hints.runId || fromTask?.runId || fromRun?.runId,
      },
      true,
    )
  } else if (hints?.runId) {
    // runId-only notification (task_id may still be null on early progress)
    const fromRun = byRun.get(hints.runId)
    pushUnique(
      {
        messageId:
          fromRun?.messageId || lastAssistant || `hint_run_${hints.runId}`,
        taskId: fromRun?.taskId,
        runId: hints.runId,
      },
      true,
    )
  }

  // Task map already uses newest messageId + merged runId from older messages.
  for (const c of byTask.values()) {
    pushUnique(c)
    if (out.length >= 5) break
  }

  // run-only entries not already covered (fill missing runId only)
  if (out.length < 5) {
    for (const c of byRun.values()) {
      pushUnique(c)
      if (out.length >= 5) break
    }
  }

  return out
}

/** Whether a backend task status is still live and worth reattaching. */
export function isNonTerminalTaskStatus(status: string): boolean {
  return (
    status === 'pending' ||
    status === 'running' ||
    status === 'waiting_for_input' ||
    status === 'paused'
  )
}
