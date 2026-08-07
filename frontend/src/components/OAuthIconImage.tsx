import type { ImgHTMLAttributes } from 'react'

interface OAuthIconImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'src'> {
  src: string
  size: number
}

export default function OAuthIconImage({
  src,
  size,
  loading = 'lazy',
  decoding = 'async',
  draggable = false,
  ...props
}: OAuthIconImageProps) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading={loading}
      decoding={decoding}
      draggable={draggable}
      {...props}
    />
  )
}
