import type { ImgHTMLAttributes } from 'react'

const ICON_ASSET_PREFIX = '/icons/'

interface WeatherAssetIconProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'alt'
> {
  icon: string
  alt?: string
  fallbackClassName?: string
}

export function isWeatherAssetIcon(icon: string): boolean {
  return icon.startsWith(ICON_ASSET_PREFIX)
}

export function WeatherAssetIcon({
  icon,
  alt = '',
  className,
  fallbackClassName,
  ...imgProps
}: WeatherAssetIconProps) {
  if (isWeatherAssetIcon(icon)) {
    return (
      <img
        src={icon}
        alt={alt}
        className={className}
        draggable={false}
        decoding="async"
        {...imgProps}
      />
    )
  }

  return (
    <span className={fallbackClassName ?? className} aria-hidden={!alt}>
      {icon}
    </span>
  )
}
