/**
 * Host-level keyboard shortcut binder for Tapp.shortcut.register.
 *
 * Backend only persists chords; the host must attach keydown listeners and
 * emit `shortcut:triggered` (as a tappEvent) into the owning sandbox.
 */

import type { TappBridge } from './TappBridge'
import { isImeComposing } from '../../utils/ime'

export interface HostShortcutBinding {
  tappId: string
  shortcutId: string
  keys: string
  action: string
  scope?: string
  bridge: TappBridge
}

type InternalBinding = HostShortcutBinding & {
  chordParts: string[]
  mainKey: string
}

const bindings = new Map<string, InternalBinding>()
let listenerAttached = false

function bindingKey(tappId: string, shortcutId: string): string {
  return `${tappId}\0${shortcutId}`
}

function normalizeKeys(keys: string): { parts: string[]; mainKey: string } | null {
  const parts = keys
    .split('+')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length === 0 || parts.length > 4) return null
  const mainKey = parts[parts.length - 1]
  return { parts, mainKey }
}

function eventMainKey(e: KeyboardEvent): string {
  const k = e.key
  if (k === ' ') return 'space'
  if (k === 'Escape') return 'escape'
  if (k === 'Enter') return 'enter'
  if (k === 'Tab') return 'tab'
  if (k === 'Backspace') return 'backspace'
  if (k === 'Delete') return 'delete'
  if (k === 'ArrowUp') return 'up'
  if (k === 'ArrowDown') return 'down'
  if (k === 'ArrowLeft') return 'left'
  if (k === 'ArrowRight') return 'right'
  if (k === 'Home') return 'home'
  if (k === 'End') return 'end'
  if (k === 'PageUp') return 'pageup'
  if (k === 'PageDown') return 'pagedown'
  if (/^f\d{1,2}$/i.test(k)) return k.toLowerCase()
  if (k.length === 1) return k.toLowerCase()
  return k.toLowerCase()
}

function matchesChord(e: KeyboardEvent, binding: InternalBinding): boolean {
  if (eventMainKey(e) !== binding.mainKey) return false
  const wantCtrl = binding.chordParts.includes('ctrl')
  const wantAlt = binding.chordParts.includes('alt')
  const wantShift = binding.chordParts.includes('shift')
  const wantMeta =
    binding.chordParts.includes('meta') || binding.chordParts.includes('cmd')
  return (
    e.ctrlKey === wantCtrl &&
    e.altKey === wantAlt &&
    e.shiftKey === wantShift &&
    e.metaKey === wantMeta
  )
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function onKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented || e.repeat) return
  if (isImeComposing(e)) return
  if (isTypingTarget(e.target)) return
  if (bindings.size === 0) return

  for (const binding of bindings.values()) {
    if (!matchesChord(e, binding)) continue
    e.preventDefault()
    e.stopPropagation()

    const payload = {
      shortcutId: binding.shortcutId,
      action: binding.action,
      keys: binding.keys,
      tappId: binding.tappId,
      scope: binding.scope || 'global',
    }

    try {
      binding.bridge.emit('tappEvent', {
        version: 2,
        eventId: `sc_${crypto.randomUUID().replaceAll('-', '')}`,
        topic: 'shortcut:triggered',
        scope: 'instance',
        source: { tappId: binding.tappId, runtimeId: 'host' },
        payload,
        occurredAt: new Date().toISOString(),
      })
      // Direct event for listeners using addEventListener('shortcut:triggered')
      binding.bridge.emit('shortcut:triggered', payload)
    } catch (err) {
      console.warn('[HostShortcut] emit failed:', err)
    }
    return
  }
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return
  window.addEventListener('keydown', onKeyDown, true)
  listenerAttached = true
}

function maybeDetachListener() {
  if (!listenerAttached || bindings.size > 0) return
  window.removeEventListener('keydown', onKeyDown, true)
  listenerAttached = false
}

/** Bind (or replace) a host keydown handler for a registered shortcut. */
export function hostBindShortcut(binding: HostShortcutBinding): void {
  const normalized = normalizeKeys(binding.keys)
  if (!normalized) {
    console.warn('[HostShortcut] invalid keys:', binding.keys)
    return
  }
  bindings.set(bindingKey(binding.tappId, binding.shortcutId), {
    ...binding,
    chordParts: normalized.parts,
    mainKey: normalized.mainKey,
  })
  ensureListener()
}

/** Remove a host keydown binding. */
export function hostUnbindShortcut(tappId: string, shortcutId: string): void {
  bindings.delete(bindingKey(tappId, shortcutId))
  maybeDetachListener()
}

/** Drop every binding for a Tapp (e.g. sandbox destroy). */
export function hostUnbindAllForTapp(tappId: string): void {
  for (const key of [...bindings.keys()]) {
    if (key.startsWith(`${tappId}\0`)) bindings.delete(key)
  }
  maybeDetachListener()
}
