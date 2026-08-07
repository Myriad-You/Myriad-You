import type { NotificationSourceKey } from '../../services/notificationPreferencesApi'

const NOTIFICATION_SOURCE_ICON_ASSETS = {
  agent: '/icons/notifications/arael.webp',
  heartbeat: '/icons/notifications/heartbeat.webp',
  mcp: '/icons/notifications/mcp.webp',
  brew: '/icons/notifications/brew.webp',
  tapp: '/icons/notifications/tapp.webp',
  updater: '/icons/notifications/updater.webp',
  federation: '/icons/notifications/aro.webp',
  system: '/icons/notifications/system.webp',
} satisfies Record<NotificationSourceKey, string>

export function notificationSourceIconAsset(source: NotificationSourceKey) {
  return NOTIFICATION_SOURCE_ICON_ASSETS[source]
}

function RasterNotificationIcon({
  src,
  className,
}: {
  src: string
  className?: string
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      width={16}
      height={16}
      draggable={false}
      decoding="async"
    />
  )
}

export function NotificationSourceIcon({
  source,
  className = 'h-4 w-4',
}: {
  source: NotificationSourceKey
  className?: string
}) {
  return (
    <RasterNotificationIcon
      src={notificationSourceIconAsset(source)}
      className={className}
    />
  )
}
