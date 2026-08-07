/**
 * Bangumi 用户评分徽章 - 资料库同款（仿 Metacritic 分色分级）
 * 分数越高越推荐 —— 色彩越暖、尺寸越大、越醒目
 * 与 LibraryGrid 中的评分徽章保持同一套分级与动画
 */
import { memo } from 'react'

// 注入评分徽章动画样式（每页面一次；与 library-grid-styles 中的同名规则等价，可共存）
if (
  typeof document !== 'undefined' &&
  !document.getElementById('rating-badge-styles')
) {
  const style = document.createElement('style')
  style.id = 'rating-badge-styles'
  style.textContent = `
        /* 高分评分徽章 - 呼吸光晕 */
        @keyframes ratingGlow {
            0%, 100% {
                box-shadow: 0 2px 8px 0 color-mix(in srgb, #f59e0b 40%, transparent);
            }
            50% {
                box-shadow: 0 2px 18px 2px color-mix(in srgb, #f59e0b 75%, transparent);
            }
        }

        .rating-badge-anim {
            animation: ratingGlow 2.4s ease-in-out infinite;
        }

        /* 满分（10）更强更快 */
        .rating-badge-anim-max {
            animation: ratingGlow 1.8s ease-in-out infinite;
        }

        /* 高分评分徽章 - 流光扫过 */
        @keyframes ratingShine {
            0% { transform: translateX(-180%) skewX(-20deg); }
            16%, 100% { transform: translateX(320%) skewX(-20deg); }
        }

        .rating-badge-shine {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 45%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent);
            animation: ratingShine 8s ease-in-out infinite;
            pointer-events: none;
        }
    `
  document.head.appendChild(style)
}

// 尺寸与配色分离：size 为资料库的分级尺寸（分数越高越大），color 为分色标记
export function getRatingBadgeStyle(rate: number) {
  // 满分（10）：金色渐变，最大最亮，双环 + 光晕，独享的稀有感
  if (rate >= 10) {
    return {
      size: 'w-10 h-10 text-xl',
      color:
        'bg-linear-to-br from-amber-300 via-yellow-400 to-orange-500 text-white ring-2 ring-amber-200/80 ring-offset-1 ring-offset-amber-500/30 shadow-amber-400/60',
      gloss: true,
    }
  }
  // 神作（9）：金色渐变 + 光晕
  if (rate >= 9) {
    return {
      size: 'w-9 h-9 text-lg',
      color:
        'bg-linear-to-br from-amber-300 to-orange-500 text-white ring-2 ring-amber-200/70 shadow-amber-500/50',
      gloss: true,
    }
  }
  // 力荐（8）
  if (rate >= 8) {
    return {
      size: 'w-8 h-8 text-base',
      color:
        'bg-emerald-500 text-white ring-1 ring-emerald-300/50 shadow-emerald-500/40',
      gloss: false,
    }
  }
  // 推荐（7）
  if (rate >= 7) {
    return {
      size: 'w-8 h-8 text-base',
      color: 'bg-green-500 text-white shadow-green-500/30',
      gloss: false,
    }
  }
  // 还行（6）
  if (rate >= 6) {
    return {
      size: 'w-7 h-7 text-sm',
      color: 'bg-lime-500 text-white',
      gloss: false,
    }
  }
  // 不过不失（5）
  if (rate >= 5) {
    return {
      size: 'w-7 h-7 text-sm',
      color: 'bg-amber-500 text-white',
      gloss: false,
    }
  }
  // 较差（3-4）
  if (rate >= 3) {
    return {
      size: 'w-7 h-7 text-sm',
      color: 'bg-orange-500 text-white',
      gloss: false,
    }
  }
  // 差评（1-2）
  return {
    size: 'w-7 h-7 text-sm',
    color: 'bg-rose-500 text-white',
    gloss: false,
  }
}

export const RatingBadge = memo(
  ({
    rate,
    className = 'absolute top-2.5 left-2.5 z-20',
    sizeClass,
  }: {
    rate?: number
    className?: string
    /** 覆盖分级尺寸，传入后所有分数统一尺寸（如报告卡片等小场景） */
    sizeClass?: string
  }) => {
    if (!rate || rate <= 0) return null
    const rs = getRatingBadgeStyle(rate)
    const animClass = rs.gloss
      ? rate >= 10
        ? 'rating-badge-anim-max'
        : 'rating-badge-anim'
      : ''
    return (
      <div
        className={`${className} flex items-center justify-center overflow-hidden rounded-lg font-extrabold leading-none shadow-lg pointer-events-none ${sizeClass || rs.size} ${rs.color} ${animClass}`}
      >
        {rs.gloss && (
          <>
            <span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/45 to-transparent" />
            <span className="rating-badge-shine" />
          </>
        )}
        <span className="relative">{rate}</span>
      </div>
    )
  },
)
RatingBadge.displayName = 'RatingBadge'
