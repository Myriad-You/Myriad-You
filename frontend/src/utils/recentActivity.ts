export const RECENT_ACTIVITY_UPDATED_EVENT = 'recent-activity-updated'

/** Notify mounted activity widgets after a platform refresh completes. */
export function notifyRecentActivityUpdated(): void {
  window.dispatchEvent(new Event(RECENT_ACTIVITY_UPDATED_EVENT))
}
