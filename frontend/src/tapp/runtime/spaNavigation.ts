/**
 * Shared SPA navigation observer.
 *
 * React Router uses history.pushState / replaceState, which do **not** fire
 * `popstate`. System event producers (and launch-param sync) need one place
 * that covers push/replace/pop/hash.
 */

type NavListener = () => void

const listeners = new Set<NavListener>()
let patched = false
let origPush: History['pushState'] | null = null
let origReplace: History['replaceState'] | null = null

function notify() {
  for (const fn of listeners) {
    try {
      fn()
    } catch (err) {
      console.warn('[spaNavigation] listener error:', err)
    }
  }
}

function ensurePatched() {
  if (patched || typeof window === 'undefined') return
  patched = true
  origPush = history.pushState.bind(history)
  origReplace = history.replaceState.bind(history)
  history.pushState = ((...args: Parameters<History['pushState']>) => {
    const ret = origPush!(...args)
    notify()
    return ret
  }) as History['pushState']
  history.replaceState = ((...args: Parameters<History['replaceState']>) => {
    const ret = origReplace!(...args)
    notify()
    return ret
  }) as History['replaceState']
  window.addEventListener('popstate', notify)
  window.addEventListener('hashchange', notify)
}

/**
 * Subscribe to SPA URL changes (pushState / replaceState / popstate / hash).
 * Returns an unsubscribe function.
 */
export function onSpaNavigation(listener: NavListener): () => void {
  ensurePatched()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
