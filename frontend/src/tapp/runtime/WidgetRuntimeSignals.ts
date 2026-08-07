export type TappStorageOperation = 'set' | 'remove' | 'clear'

export interface TappStorageChange {
  tappId: string
  key?: string
  operation: TappStorageOperation
  source: object
}

const storageTarget = new EventTarget()
const STORAGE_EVENT = 'tapp-storage-changed'

export function emitTappStorageChange(change: TappStorageChange): void {
  storageTarget.dispatchEvent(
    new CustomEvent<TappStorageChange>(STORAGE_EVENT, { detail: change }),
  )
}

export function onTappStorageChange(
  listener: (change: TappStorageChange) => void,
): () => void {
  const handler = (event: Event) =>
    listener((event as CustomEvent<TappStorageChange>).detail)
  storageTarget.addEventListener(STORAGE_EVENT, handler)
  return () => storageTarget.removeEventListener(STORAGE_EVENT, handler)
}
