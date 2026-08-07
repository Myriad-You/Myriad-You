export const TAPP_ICON_TOKENS = {
  store: 'myriad:tapp.store',
  package: 'myriad:tapp.package',
} as const

export const TAPP_ICON_ASSETS = {
  [TAPP_ICON_TOKENS.store]: '/icons/tapp/store.webp',
  [TAPP_ICON_TOKENS.package]: '/icons/tapp/package.webp',
} as const

export function resolveTappIconAsset(icon: string | undefined) {
  if (!icon) return undefined
  return TAPP_ICON_ASSETS[icon as keyof typeof TAPP_ICON_ASSETS]
}
