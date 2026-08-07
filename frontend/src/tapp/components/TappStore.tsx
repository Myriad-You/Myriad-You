/**
 * Tapp 商店内容组件
 *
 * 宿主侧 React UI（非沙箱 Tapp 包）。可作为正式页面或
 * 多窗口宿主面板嵌入，本身不带模态遮罩。
 */

import type { ExampleTapp } from '../examples'
import type {
  RemoteApp,
  RemoteStoreSource,
} from '../services/RemoteStoreService'
import type { TappCategory, TappPermission } from '../types'
import {
  FaArrowLeft,
  FaCheck,
  FaCog,
  FaCompass,
  FaDatabase,
  FaExclamationTriangle,
  FaFilter,
  FaGamepad,
  FaGlobe,
  FaLink,
  FaLock,
  FaMagic,
  FaMusic,
  FaPlus,
  FaRobot,
  FaSearch,
  FaStar,
  FaSync,
  FaTimes,
  FaTimesCircle,
  FaTrash,
  FaWrench,
} from '@lib/icons'
import {
  AnimatePresenceShim as AnimatePresence,
  motionShim as motion,
} from '@lib/motionShim'
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { isExlight, useAnimationLevel } from '../../hooks/useAnimationLevel'
import { sanitizeUrl } from '../../utils/inputSanitizer'
import { hasSessionHint } from '../../utils/sessionDetection'
import { TAPP_ICON_TOKENS } from '../constants/icons'
import { PERMISSION_CONFIG } from '../constants/permissions'
import { EXAMPLE_TAPPS } from '../examples'
import { getTappRuntime } from '../runtime'
import { PERMISSION_LEVELS } from '../runtime/permissionConfig'
import { RemoteStoreService } from '../services/RemoteStoreService'
import { resolveManifestText } from '../utils/manifestLocale'
import {
  normalizeTappCategory,
  TAPP_CATEGORIES,
  TAPP_CATEGORY_I18N_KEYS,
} from '../utils/tappCategories'
import { getCategoryGradient } from '../utils/tappColors'
import { TappIcon } from './TappIcon'
import { UninstallConfirmDialog } from './UninstallConfirmDialog'
import './TappStore.css'

export interface TappStoreProps {
  /** 安装/卸载成功后的回调（列表页可用来刷新） */
  onInstalled?: () => void
  /** 额外 class（填满父容器时常用 h-full） */
  className?: string
  /**
   * 外层已有标题 chrome（页面壳 / 多窗口标题栏）时隐藏内部大标题，
   * 仅保留搜索、筛选与操作，避免移动端双标题占位。
   */
  embeddedChrome?: boolean
  /** 移动端紧凑布局：更小内边距、触控友好控件 */
  compact?: boolean
}

/** 应用来源类型 */
type AppSourceType = 'local' | 'remote'

/** 统一的应用列表项 */
interface UnifiedAppItem {
  id: string
  name: string
  version: string
  description: string
  /** 详细描述 */
  longDescription?: string
  author: { name: string; email?: string; url?: string }
  icon?: string
  /** 内联 SVG 图标代码（优先于 icon） */
  iconSvg?: string
  /** 主题色（优先于分类渐变色） */
  themeColor?: string
  category: TappCategory
  tags: string[]
  permissions: string[]
  /** 许可证 */
  license?: string
  /** 主页 URL */
  homepage?: string
  /** 仓库 URL */
  repository?: string
  /** 文件大小（字节） */
  size?: number
  /** 是否推荐 */
  featured?: boolean
  /** 是否验证 */
  verified?: boolean
  /** 更新时间 */
  updatedAt?: string
  source: AppSourceType
  /** 本地示例 Tapp 数据 */
  localTapp?: ExampleTapp
  /** 远程应用数据 */
  remoteApp?: RemoteApp & { sourceUrl: string; sourceName: string }
}

const CATEGORY_ICONS: Record<TappCategory, React.ReactNode> = {
  ai: <FaRobot />,
  data: <FaDatabase />,
  developer: <FaWrench />,
  game: <FaGamepad />,
  media: <FaMusic />,
  productivity: <FaMagic />,
  social: <FaLink />,
  utility: <FaCog />,
}

/** App Store 风格分类芯片 */
function CategoryPill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-active={active ? 'true' : 'false'}
      className="as-store__cat"
    >
      {label}
    </button>
  )
}

/** 获取 / 打开 / 更新 胶囊按钮 */
function StoreGetButton({
  kind,
  label,
  disabled,
  onClick,
  title,
}: {
  kind: 'get' | 'open' | 'update' | 'busy'
  label: React.ReactNode
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  title?: string
}) {
  return (
    <button
      type="button"
      className={`as-get as-get--${kind}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  )
}

/** 获取应用图标背景样式（优先使用主题色） */
function getAppIconStyle(app: UnifiedAppItem): {
  className: string
  style?: React.CSSProperties
} {
  if (app.themeColor) {
    // 使用应用自定义主题色
    return {
      className: 'bg-linear-to-br',
      style: {
        background: `linear-gradient(to bottom right, ${app.themeColor}, ${app.themeColor}99)`,
      },
    }
  }
  return { className: getCategoryGradient(app.category) }
}

/** 权限级别（与后端一致，未知权限按基础处理） */
function getPermissionLevel(
  permission: string,
): 'basic' | 'elevated' | 'privileged' {
  return PERMISSION_LEVELS[permission as TappPermission] ?? 'basic'
}

/** 权限级别排序权重 */
const LEVEL_ORDER = { basic: 0, elevated: 1, privileged: 2 } as const

/** 权限级别配色 */
const LEVEL_STYLES = {
  basic: 'bg-green-500/10 text-green-600 dark:text-green-400',
  elevated: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  privileged: 'bg-red-500/10 text-red-500 dark:text-red-400',
} as const

/** 权限级别标签的 i18n 键 */
const LEVEL_LABEL_KEYS = {
  basic: 'basicPermission',
  elevated: 'elevatedPermission',
  privileged: 'privilegedPermission',
} as const

/** 比较版本号：返回 1 表示前者较新，-1 表示后者较新，0 表示相等。 */
function compareVersions(left: string, right: string): number {
  const parts1 = left.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const parts2 = right.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const maxLen = Math.max(parts1.length, parts2.length)

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

/** 字节数格式化为可读大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB'] as const
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit++
  } while (value >= 1024 && unit < units.length - 1)
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** Map progress phase key → localized label (install vs update). */
function packageProgressLabel(
  t: ReturnType<typeof useI18n>['t'],
  mode: 'install' | 'update',
  phase: string | null | undefined,
  percent: number,
  detail?: string | null,
): string {
  const p = (phase || 'download').toLowerCase()
  const isUpdate = mode === 'update'
  let template: string
  if (p === 'prepare') {
    template = isUpdate ? t.tapp.updatePreparing : t.tapp.installPreparing
  } else if (p === 'register' || p === 'install' || p === 'done') {
    template = isUpdate ? t.tapp.updateRegistering : t.tapp.installRegistering
  } else {
    template = isUpdate ? t.tapp.updateDownloading : t.tapp.installDownloading
  }
  let label = template.replace('{percent}', String(percent))
  if (detail && p === 'download') {
    // Shorten long module filenames for the strip
    const short =
      detail.length > 28
        ? `${detail.slice(0, 12)}…${detail.slice(-10)}`
        : detail
    label = `${label} · ${short}`
  }
  return label
}

/** Progress percent with a smaller `%` so the digits stay readable. */
function ProgressPercent({
  value,
  className = '',
}: {
  value: number
  className?: string
}) {
  return (
    <span className={`tabular-nums font-bold leading-none ${className}`}>
      {Math.round(value)}
      <span className="text-[0.72em] font-semibold opacity-80">%</span>
    </span>
  )
}

/** App Store 风格应用行 */
const UnifiedAppCard = forwardRef<
  HTMLDivElement,
  {
    app: UnifiedAppItem
    isInstalled: boolean
    installedVersion?: string
    canUninstall: boolean
    onInstall: () => void
    onUpdate?: () => void
    onUninstall?: (anchor: HTMLElement) => void
    onOpen: () => void
    installing: boolean
    installPercent?: number | null
    installPhase?: string | null
    installDetail?: string | null
    updating?: boolean
    animConfig?: ReturnType<typeof useAnimationLevel>
    index?: number
  }
>(
  (
    {
      app,
      isInstalled,
      installedVersion,
      canUninstall,
      onInstall,
      onUpdate,
      onUninstall,
      onOpen,
      installing,
      installPercent,
      installPhase,
      installDetail,
      updating,
      animConfig,
      index = 0,
    },
    ref,
  ) => {
    const { t } = useI18n()
    const busy = installing || updating
    const busyProgress = installPercent != null && busy
    const hasUpdate =
      isInstalled &&
      !!installedVersion &&
      compareVersions(app.version, installedVersion) > 0

    const animProps = useMemo(() => {
      if (!animConfig || isExlight(animConfig)) {
        return { initial: {}, animate: {}, transition: {} }
      }
      const delay = Math.min(index, 12) * 0.028 * animConfig.durationScale
      return {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: {
          delay,
          duration: 0.32 * animConfig.durationScale,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      }
    }, [animConfig, index])

    const iconStyle = getAppIconStyle(app)
    const categoryLabel = t.tapp[TAPP_CATEGORY_I18N_KEYS[app.category]]
    const subtitle = app.description || app.author.name

    return (
      <motion.div
        ref={ref}
        initial={animProps.initial}
        animate={animProps.animate}
        transition={animProps.transition}
        className="as-store-row"
        role="button"
        tabIndex={0}
        title={t.tapp.viewDetails}
        onClick={onOpen}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        <div
          className={`as-store-row__icon ${iconStyle.className}`}
          style={iconStyle.style}
        >
          <span className="as-store-row__icon-shine" aria-hidden />
          <TappIcon
            icon={app.icon}
            iconSvg={app.iconSvg}
            name={app.name}
            sizeClass="w-8 h-8"
            textSizeClass="text-2xl"
            className="relative z-10"
          />
        </div>

        <div className="as-store-row__body">
          <div className="as-store-row__name">{app.name}</div>
          <div className="as-store-row__sub">{subtitle}</div>
          <div className="as-store-row__sub2">
            {categoryLabel}
            {hasUpdate && installedVersion
              ? ` · v${installedVersion} → v${app.version}`
              : ` · v${app.version}`}
          </div>
        </div>

        <div className="as-store-row__side">
          {busy ? (
            <StoreGetButton
              kind="busy"
              disabled
              title={
                busyProgress
                  ? packageProgressLabel(
                      t,
                      updating ? 'update' : 'install',
                      installPhase,
                      installPercent!,
                      installDetail,
                    )
                  : updating
                    ? t.tapp.update
                    : t.tapp.installing
              }
              label={
                busyProgress ? (
                  <ProgressPercent
                    value={installPercent!}
                    className="text-[0.75rem]"
                  />
                ) : (
                  <Spinner size="xs" color="current" />
                )
              }
            />
          ) : hasUpdate && onUpdate ? (
            <StoreGetButton
              kind="update"
              label={t.tapp.update}
              title={t.tapp.update}
              onClick={(e) => {
                e.stopPropagation()
                onUpdate()
              }}
            />
          ) : isInstalled ? (
            <StoreGetButton
              kind="open"
              label={t.tapp.installed}
              title={
                canUninstall && onUninstall
                  ? t.tapp.uninstall
                  : t.tapp.installed
              }
              onClick={(e) => {
                e.stopPropagation()
                if (canUninstall && onUninstall) {
                  onUninstall(e.currentTarget)
                } else {
                  onOpen()
                }
              }}
            />
          ) : (
            <StoreGetButton
              kind="get"
              label={t.tapp.install}
              title={t.tapp.install}
              onClick={(e) => {
                e.stopPropagation()
                onInstall()
              }}
            />
          )}
        </div>

        {busyProgress && (
          <div className="as-store-row__progress" aria-hidden>
            <i style={{ width: `${Math.max(2, installPercent!)}%` }} />
          </div>
        )}
      </motion.div>
    )
  },
)

UnifiedAppCard.displayName = 'UnifiedAppCard'

/** 商店应用详情视图（模态框内的二级页面） */
function AppDetailView({
  app,
  isInstalled,
  installedVersion,
  canUninstall,
  installing,
  installPercent,
  installPhase,
  installDetail,
  updating,
  onInstall,
  onUpdate,
  onUninstall,
}: {
  app: UnifiedAppItem
  isInstalled: boolean
  installedVersion?: string
  canUninstall: boolean
  installing: boolean
  installPercent?: number | null
  installPhase?: string | null
  installDetail?: string | null
  updating: boolean
  onInstall: () => void
  onUpdate: () => void
  onUninstall: (anchor: HTMLElement) => void
}) {
  const { t } = useI18n()
  const tappStrings = t.tapp as unknown as Record<string, string>
  const iconStyle = getAppIconStyle(app)
  const hasUpdate =
    isInstalled &&
    !!installedVersion &&
    compareVersions(app.version, installedVersion) > 0
  const busyProgress = installPercent != null && (installing || updating)
  const progressMode: 'install' | 'update' = updating ? 'update' : 'install'

  const homepageUrl = app.homepage ? sanitizeUrl(app.homepage) : ''
  const repositoryUrl = app.repository ? sanitizeUrl(app.repository) : ''
  const description = app.longDescription || app.description

  const sortedPermissions = app.permissions.toSorted(
    (a, b) =>
      LEVEL_ORDER[getPermissionLevel(b)] - LEVEL_ORDER[getPermissionLevel(a)],
  )

  // 版本与作者已在顶部信息区展示，这里不再重复
  const metaItems = [
    {
      label: t.tapp.categoryFilter,
      value: t.tapp[TAPP_CATEGORY_I18N_KEYS[app.category]],
    },
    ...(app.size
      ? [{ label: t.tapp.sizeLabel, value: formatSize(app.size) }]
      : []),
    ...(app.license
      ? [{ label: t.tapp.licenseLabel, value: app.license }]
      : []),
    ...(app.updatedAt
      ? [
          {
            label: t.tapp.updatedAtLabel,
            value: new Date(app.updatedAt).toLocaleDateString(),
          },
        ]
      : []),
    {
      label: t.tapp.sourceLabel,
      value:
        app.source === 'remote'
          ? (app.remoteApp?.sourceName ?? t.tapp.remoteStore)
          : t.tapp.builtinExample,
    },
  ]

  return (
    <div className="as-detail">
      <div className="as-detail__hero">
        <div
          className={`as-detail__icon ${iconStyle.className}`}
          style={iconStyle.style}
        >
          <span className="as-store-row__icon-shine" aria-hidden />
          <TappIcon
            icon={app.icon}
            iconSvg={app.iconSvg}
            name={app.name}
            sizeClass="w-12 h-12 sm:w-14 sm:h-14"
            textSizeClass="text-4xl sm:text-5xl"
            className="relative z-10"
          />
        </div>

        <div className="as-detail__info">
          <h3 className="as-detail__name">{app.name}</h3>
          <div className="as-detail__dev">{app.author.name}</div>
          <div className="as-detail__meta">
            {t.tapp[TAPP_CATEGORY_I18N_KEYS[app.category]]}
            {' · '}v{app.version}
            {hasUpdate && installedVersion ? ` ← v${installedVersion}` : ''}
          </div>

          <div className="as-detail__cta">
            {busyProgress && (installing || updating) ? (
              <StoreGetButton
                kind="busy"
                disabled
                label={
                  <ProgressPercent
                    value={installPercent!}
                    className="text-sm"
                  />
                }
              />
            ) : hasUpdate ? (
              <StoreGetButton
                kind="update"
                label={updating ? t.tapp.installing : t.tapp.update}
                disabled={updating}
                onClick={() => onUpdate()}
              />
            ) : isInstalled ? (
              <StoreGetButton kind="open" label={t.tapp.installed} disabled />
            ) : (
              <StoreGetButton
                kind="get"
                label={installing ? t.tapp.installing : t.tapp.install}
                disabled={installing}
                onClick={() => onInstall()}
              />
            )}
            {isInstalled && canUninstall && (
              <button
                type="button"
                className="as-detail__link"
                style={{ color: '#ff3b30', background: 'rgba(255,59,48,0.12)' }}
                onClick={(e) => onUninstall(e.currentTarget)}
              >
                <FaTrash className="h-3 w-3" />
                {t.tapp.uninstall}
              </button>
            )}
            {homepageUrl && (
              <a
                href={homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="as-detail__link"
              >
                <FaGlobe className="h-3.5 w-3.5" />
                {t.tapp.homepage}
              </a>
            )}
            {repositoryUrl && (
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="as-detail__link"
              >
                <FaLink className="h-3.5 w-3.5" />
                {t.tapp.repository}
              </a>
            )}
          </div>
        </div>
      </div>

      {busyProgress && (
        <div className="as-detail__progress" role="status" aria-live="polite">
          <div className="as-detail__progress-top">
            <span>
              {packageProgressLabel(
                t,
                progressMode,
                installPhase,
                installPercent!,
                installDetail,
              )}
            </span>
            <span>
              <ProgressPercent value={installPercent!} />
            </span>
          </div>
          <div className="as-detail__progress-bar">
            <i style={{ width: `${Math.max(2, installPercent!)}%` }} />
          </div>
        </div>
      )}

      {app.tags.length > 0 && (
        <div className="as-detail__block">
          <div className="as-detail__tags">
            {app.tags.map((tag) => (
              <span key={tag} className="as-detail__tag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {description && (
        <section className="as-detail__block">
          <h4 className="as-detail__h">{t.tapp.appDescription}</h4>
          <p className="as-detail__desc">{description}</p>
        </section>
      )}

      <section className="as-detail__block">
        <h4 className="as-detail__h">{t.tapp.detailInfo}</h4>
        <div className="as-detail__info-list">
          {metaItems.map((item) => (
            <div key={item.label} className="as-detail__info-row">
              <span className="as-detail__info-k">{item.label}</span>
              <span className="as-detail__info-v" title={item.value}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="as-detail__block">
        <h4 className="as-detail__h">
          {t.tapp.permissions}
          {sortedPermissions.length > 0 ? ` · ${sortedPermissions.length}` : ''}
        </h4>
        {sortedPermissions.length > 0 ? (
          <div className="as-detail__perms">
            {sortedPermissions.map((perm) => {
              const config = PERMISSION_CONFIG[perm as TappPermission]
              const level = getPermissionLevel(perm)
              const Icon = config?.icon ?? FaLock
              const label = config
                ? (tappStrings[config.labelKey] ?? perm)
                : perm
              const desc = config
                ? tappStrings[config.descriptionKey]
                : undefined
              return (
                <div key={perm} className="as-detail__perm">
                  <span
                    className={`as-detail__perm-ico ${LEVEL_STYLES[level]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="as-detail__perm-name">{label}</div>
                    {desc && <div className="as-detail__perm-desc">{desc}</div>}
                  </div>
                  <span className={`as-detail__perm-lv ${LEVEL_STYLES[level]}`}>
                    {tappStrings[LEVEL_LABEL_KEYS[level]]}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="as-detail__desc">{t.tapp.noPermissions}</p>
        )}
      </section>
    </div>
  )
}

/** 商店源设置弹�? */
function SourcesSettingsModal({
  isOpen,
  onClose,
  sources,
  onToggle,
  onRemove,
  onAdd,
  onRefresh,
  refreshing,
  isAdmin,
}: {
  isOpen: boolean
  onClose: () => void
  sources: RemoteStoreSource[]
  onToggle: (url: string, enabled: boolean) => void
  onRemove: (url: string) => void
  onAdd: (source: Omit<RemoteStoreSource, 'official'>) => void
  onRefresh: () => void
  refreshing: boolean
  isAdmin: boolean
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceName, setNewSourceName] = useState('')
  const [addError, setAddError] = useState('')
  const { t } = useI18n()

  const handleAdd = () => {
    if (!newSourceUrl.trim() || !newSourceName.trim()) {
      setAddError(t.tapp.fillNameAndUrl)
      return
    }
    try {
      // eslint-disable-next-line no-new
      new URL(newSourceUrl)
    } catch {
      setAddError(t.tapp.invalidUrl)
      return
    }

    try {
      onAdd({
        name: newSourceName.trim(),
        url: newSourceUrl.trim(),
        enabled: true,
      })
      setNewSourceUrl('')
      setNewSourceName('')
      setShowAddForm(false)
      setAddError('')
    } catch (error) {
      setAddError(
        error instanceof Error ? error.message : t.tapp.addSourceFailed,
      )
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="surface-dialog-backdrop fixed inset-0 z-60 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="surface-dialog glass rounded-2xl shadow-xl max-w-lg w-full max-h-[70vh] overflow-hidden flex flex-col"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-gray-200/50 dark:border-neutral-700/50 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FaGlobe className="text-blue-500" />
            {t.tapp.sourceManagement}
          </h3>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className={`p-2 rounded-lg transition-colors ${
                  refreshing
                    ? 'text-gray-400 cursor-wait'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-700'
                }`}
                title={t.tapp.refreshAllStores}
              >
                {refreshing ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <FaSync className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              title={t.tapp.storeClose}
              aria-label={t.tapp.storeClose}
            >
              <FaTimes className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 添加按钮（仅管理员） */}
          {isAdmin && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center gap-2"
            >
              <FaPlus className="w-4 h-4" />
              {t.tapp.addSource}
            </button>
          )}

          {/* 添加表单 */}
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl space-y-3"
            >
              <input
                type="text"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder={t.tapp.sourceName}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm"
              />
              <input
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder={t.tapp.sourceUrl}
                className="w-full px-3 py-2 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg text-sm"
              />
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {t.tapp.addSource}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setAddError('')
                  }}
                  className="flex-1 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
                >
                  {t.tapp.cancel}
                </button>
              </div>
            </motion.div>
          )}

          {/* 商店列表 */}
          <div className="space-y-2">
            {sources.map((source) => (
              <div
                key={source.url}
                className="p-4 bg-white/50 dark:bg-neutral-800/50 rounded-xl flex items-center gap-3"
              >
                <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                  <TappIcon
                    icon={
                      source.icon ||
                      (source.official
                        ? TAPP_ICON_TOKENS.store
                        : TAPP_ICON_TOKENS.package)
                    }
                    name={source.name}
                    sizeClass="w-8 h-8"
                    textSizeClass="text-2xl"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-gray-100 text-sm truncate">
                      {source.name}
                    </span>
                    {source.official && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                        {t.tapp.official}
                      </span>
                    )}
                    {!source.enabled && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-neutral-700 text-gray-500 rounded">
                        {t.tapp.disabled}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {source.url}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onToggle(source.url, !source.enabled)}
                    className={`p-2 rounded-lg transition-colors ${
                      source.enabled
                        ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
                    }`}
                    title={source.enabled ? t.tapp.disable : t.tapp.enable}
                  >
                    {source.enabled ? (
                      <FaCheck className="w-4 h-4" />
                    ) : (
                      <FaTimesCircle className="w-4 h-4" />
                    )}
                  </button>
                  {!source.official && (
                    <button
                      onClick={() => onRemove(source.url)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title={t.tapp.deleteSource}
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Tapp 商店内容（页面 / 多窗口宿主面板共用）
 */
export function TappStore({
  onInstalled,
  className = '',
  embeddedChrome = false,
  compact = false,
}: TappStoreProps) {
  const { t, format, locale } = useI18n()
  const { isAuthenticated, isAdmin, hasChecked, checkAuth } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<
    TappCategory | '__installed__' | null
  >(null)
  // 详情视图当前展示的应用（null 表示列表视图）
  const [detailApp, setDetailApp] = useState<UnifiedAppItem | null>(null)
  const [showSourcesSettings, setShowSourcesSettings] = useState(false)
  // 存储已安装应用的信息：id -> { userRole, isTemporary, version }
  const [installedTapps, setInstalledTapps] = useState<
    Map<string, { userRole: string; isTemporary?: boolean; version: string }>
  >(new Map())
  const [installing, setInstalling] = useState<string | null>(null)
  /** Progress for ≥1 MiB installs: percent + phase message key */
  const [installProgress, setInstallProgress] = useState<{
    id: string
    percent: number
    phase: string
    detail?: string
  } | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 卸载确认 tooltip
  const [showUninstallDialog, setShowUninstallDialog] = useState(false)
  const [uninstallTargetId, setUninstallTargetId] = useState<string | null>(
    null,
  )
  const [uninstallTargetName, setUninstallTargetName] = useState('')
  const [uninstallAnchor, setUninstallAnchor] = useState<HTMLElement | null>(
    null,
  )

  // 动画配置
  const animConfig = useAnimationLevel()

  // 远程应用列表
  const [remoteApps, setRemoteApps] = useState<
    Array<RemoteApp & { sourceUrl: string; sourceName: string }>
  >([])
  const [sources, setSources] = useState<RemoteStoreSource[]>([])

  const runtime = getTappRuntime()
  const notifyInstalled = useCallback(() => {
    onInstalled?.()
  }, [onInstalled])

  // 已安装应用 ID 集合（兼容性）
  const installedIds = useMemo(
    () => new Set(installedTapps.keys()),
    [installedTapps],
  )

  // 加载已安装 Tapp 的辅助函数
  const loadInstalledTapps = useCallback(() => {
    const allTapps = runtime.getAllTapps()
    const tappsMap = new Map<
      string,
      { userRole: string; isTemporary?: boolean; version: string }
    >()
    allTapps.forEach((tapp) => {
      tappsMap.set(tapp.id, {
        userRole: tapp.userRole,
        isTemporary: tapp.isTemporary,
        version: tapp.manifest.version,
      })
    })
    setInstalledTapps(tappsMap)
  }, [runtime])

  // 首次挂载时检查认证状态
  useEffect(() => {
    if (!hasChecked && hasSessionHint()) {
      checkAuth()
    }
  }, [hasChecked, checkAuth])

  // 加载已安装的 Tapp（等待同步完成）
  useEffect(() => {
    let mounted = true

    const initLoad = async () => {
      // 等待 runtime 同步完成
      await runtime.waitForSync()
      if (mounted) {
        loadInstalledTapps()
      }
    }

    initLoad()

    // 监听同步完成事件，以便在后续同步时更新
    const unsubscribe = runtime.on('sync:complete', () => {
      if (mounted) {
        loadInstalledTapps()
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [runtime, loadInstalledTapps])

  // 加载商店源
  useEffect(() => {
    const loadSources = async () => {
      const loadedSources = await RemoteStoreService.getSources()
      setSources(loadedSources)
    }
    loadSources()
  }, [])

  // 加载远程应用
  const loadRemoteApps = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = await RemoteStoreService.fetchAllApps(forceRefresh)
      setRemoteApps(result.apps)

      // 检查是否有错误
      const errors = result.sources.filter((s) => s.error)
      if (errors.length > 0 && result.apps.length === 0) {
        setError(`无法加载远程商店: ${errors[0].error}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初始加载
  useEffect(() => {
    if (remoteApps.length === 0) {
      loadRemoteApps()
    }
  }, [loadRemoteApps, remoteApps.length])

  // 转换本地示例为统一格式
  const localApps: UnifiedAppItem[] = EXAMPLE_TAPPS.map((tapp) => {
    const text = resolveManifestText(tapp.manifest, locale)
    return {
      id: tapp.manifest.id,
      name: text.name,
      version: tapp.manifest.version,
      description: text.description || '',
      author: tapp.manifest.author || { name: 'Unknown' },
      icon: tapp.manifest.icon,
      iconSvg: tapp.manifest.iconSvg,
      themeColor: tapp.manifest.themeColor,
      category: tapp.manifest.category,
      tags: tapp.tags,
      permissions: tapp.manifest.permissions,
      source: 'local' as const,
      localTapp: tapp,
    }
  })

  // 转换远程应用为统一格式（name/description 按宿主语言解析 locales）
  const remoteAppsUnified: UnifiedAppItem[] = remoteApps.map((app) => {
    const text = resolveManifestText(
      {
        name: app.name,
        description: app.description,
        locales: app.locales,
      },
      locale,
    )
    return {
      id: app.id,
      name: text.name,
      version: app.version,
      description: text.description || '',
      longDescription: app.long_description,
      author: app.author,
      icon: app.icon,
      iconSvg: app.icon_svg,
      themeColor: app.theme_color,
      category: normalizeTappCategory(app.category),
      tags: app.tags || [],
      permissions: app.permissions,
      license: app.license,
      homepage: app.homepage,
      repository: app.repository,
      size: app.size,
      featured: app.featured,
      verified: app.verified,
      updatedAt: app.updated_at,
      source: 'remote' as const,
      remoteApp: app,
    }
  })

  // 合并应用列表（去重，远程优先）
  const allApps: UnifiedAppItem[] = [...remoteAppsUnified]
  for (const localApp of localApps) {
    if (!remoteAppsUnified.some((r) => r.id === localApp.id)) {
      allApps.push(localApp)
    }
  }

  // 过滤 Tapp
  const filteredApps = allApps.filter((app) => {
    // 搜索过滤：解析后文案 + 远程原始 name/description/locales 均可命中
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchName = app.name.toLowerCase().includes(query)
      const matchDesc = app.description.toLowerCase().includes(query)
      const matchTags = app.tags.some((t) => t.toLowerCase().includes(query))
      const remote = app.remoteApp
      const matchRaw =
        !!remote &&
        (remote.name.toLowerCase().includes(query) ||
          remote.description.toLowerCase().includes(query) ||
          Object.values(remote.locales ?? {}).some(
            (entry) =>
              (entry.name?.toLowerCase().includes(query) ?? false) ||
              (entry.description?.toLowerCase().includes(query) ?? false),
          ))
      if (!matchName && !matchDesc && !matchTags && !matchRaw) return false
    }
    // 分类过滤
    if (selectedCategory === '__installed__') {
      // 已安装分类：只显示已安装的应�?
      return installedIds.has(app.id)
    }
    if (selectedCategory && app.category !== selectedCategory) return false
    return true
  })

  const handleUninstall = useCallback(
    (appId: string, anchor?: HTMLElement | null) => {
      const app = filteredApps.find((a) => a.id === appId)
      setUninstallTargetId(appId)
      setUninstallTargetName(app?.name || appId)
      setUninstallAnchor(anchor ?? null)
      setShowUninstallDialog(true)
    },
    [filteredApps],
  )

  const handleConfirmUninstall = useCallback(
    async (keepData: boolean) => {
      if (!uninstallTargetId) return
      try {
        await runtime.uninstallTapp(uninstallTargetId, { keepData })
        setInstalledTapps((prev) => {
          const next = new Map(prev)
          next.delete(uninstallTargetId)
          return next
        })
        notifyInstalled()
        setShowUninstallDialog(false)
        setUninstallTargetId(null)
        setUninstallAnchor(null)
      } catch (error) {
        console.error('Failed to uninstall Tapp:', error)
        alert(
          `${t.tapp.uninstallFailed}: ${error instanceof Error ? error.message : t.tapp.unknownError}`,
        )
        throw error
      }
    },
    [runtime, notifyInstalled, uninstallTargetId, t],
  )

  const cancelUninstall = useCallback(() => {
    setShowUninstallDialog(false)
    setUninstallTargetId(null)
    setUninstallAnchor(null)
  }, [])

  // 安装应用
  const handleInstall = useCallback(
    async (app: UnifiedAppItem) => {
      // 游客无法安装应用
      if (!isAuthenticated) {
        alert(t.tapp.loginRequiredToInstall)
        return
      }

      setInstalling(app.id)
      setInstallProgress(null)
      try {
        if (app.source === 'local' && app.localTapp) {
          // 安装本地示例
          await runtime.installTapp(app.localTapp.manifest, app.localTapp.code)
        } else if (app.source === 'remote' && app.remoteApp) {
          // 安装远程应用 - 使用新的 API，让后端直接下载
          // 找到该应用所在商店源的数据库 ID
          const source = sources.find((s) => s.url === app.remoteApp!.sourceUrl)
          if (!source?.id && !source?.url) {
            throw new Error('无法找到商店源')
          }

          const { installFromStore } =
            await import('../services/TappApiService')
          const { isLargeTappInstall, clampInstallPercent } =
            await import('../utils/tappInstallProgress')
          const estimatedBytes = app.size ?? app.remoteApp.size ?? 0
          const showProgress = isLargeTappInstall(estimatedBytes)

          await installFromStore(
            {
              source: source.id ? String(source.id) : source.url,
              tappId: app.id,
              permissions: app.permissions,
            },
            {
              estimatedBytes,
              onProgress: showProgress
                ? (p) => {
                    setInstallProgress({
                      id: app.id,
                      percent: clampInstallPercent(p.percent ?? 0),
                      phase: p.message || p.phase,
                      detail: p.detail,
                    })
                  }
                : undefined,
            },
          )

          // 刷新 runtime 缓存
          await runtime.syncFromBackend(true)
        }

        // 安装 owner 与临时性必须使用后端同步结果；管理员安装属于规范公共
        // owner，不能在这里硬编码成普通用户临时副本。
        const installed = runtime.getTapp(app.id)
        if (installed) {
          setInstalledTapps(
            (prev) =>
              new Map([
                ...prev,
                [
                  app.id,
                  {
                    userRole: installed.userRole,
                    isTemporary: installed.isTemporary,
                    version: installed.manifest.version,
                  },
                ],
              ]),
          )
        }
        notifyInstalled()
      } catch (error) {
        console.error('Failed to install Tapp:', error)
        alert(
          `${t.tapp.installFailed}: ${error instanceof Error ? error.message : t.tapp.unknownError}`,
        )
      } finally {
        setInstalling(null)
        setInstallProgress(null)
      }
    },
    [runtime, notifyInstalled, sources, t, isAuthenticated],
  )

  // 更新应用
  const handleUpdate = useCallback(
    async (app: UnifiedAppItem) => {
      // 游客无法更新应用
      if (!isAuthenticated) {
        alert(t.tapp.loginRequiredToInstall)
        return
      }

      setUpdating(app.id)
      setInstallProgress(null)
      try {
        if (app.source === 'local' && app.localTapp) {
          const { updateTappFromCode } =
            await import('../services/TappApiService')
          await updateTappFromCode(app.localTapp.manifest, app.localTapp.code)
        } else if (app.source === 'remote' && app.remoteApp) {
          // 找到该应用所在商店源的数据库 ID
          const source = sources.find((s) => s.url === app.remoteApp!.sourceUrl)
          if (!source?.id && !source?.url) {
            throw new Error('无法找到商店源')
          }

          // Same dual path as install: large packages (≥1 MiB) download in-browser
          // with progress; small packages try backend then client fallback.
          const { updateTappFromStore } =
            await import('../services/TappApiService')
          const { isLargeTappInstall, clampInstallPercent } =
            await import('../utils/tappInstallProgress')
          const estimatedBytes = app.size ?? app.remoteApp?.size ?? 0
          const showProgress = isLargeTappInstall(estimatedBytes)

          await updateTappFromStore(
            app.id,
            {
              source: source.id ? String(source.id) : source.url,
            },
            {
              estimatedBytes,
              onProgress: showProgress
                ? (p) => {
                    setInstallProgress({
                      id: app.id,
                      percent: clampInstallPercent(p.percent ?? 0),
                      phase: p.message || p.phase,
                      detail: p.detail,
                    })
                  }
                : // Still report progress when path switches to client after size peek
                  (p) => {
                    if (p.percent != null && p.percent > 0) {
                      setInstallProgress({
                        id: app.id,
                        percent: clampInstallPercent(p.percent ?? 0),
                        phase: p.message || p.phase,
                        detail: p.detail,
                      })
                    }
                  },
            },
          )
          runtime.clearCodeCache(app.id)
        } else {
          throw new Error('Unsupported update source')
        }

        // 刷新清单并重建仍在运行的 Page/Widget/headless 实例。
        await runtime.refreshTapp(app.id)

        // 更新本地状态
        setInstalledTapps((prev) => {
          const newMap = new Map(prev)
          const existing = prev.get(app.id)
          if (existing) {
            newMap.set(app.id, { ...existing, version: app.version })
          }
          return newMap
        })
        notifyInstalled()
      } catch (error) {
        console.error('Failed to update Tapp:', error)
        alert(
          `${t.tapp.updateFailed}: ${error instanceof Error ? error.message : t.tapp.unknownError}`,
        )
      } finally {
        setUpdating(null)
        setInstallProgress(null)
      }
    },
    [runtime, notifyInstalled, sources, t, isAuthenticated],
  )

  // 处理商店源操作
  const handleToggleSource = async (url: string, enabled: boolean) => {
    // 通过 URL 找到 source ID
    const source = sources.find((s) => s.url === url)
    if (source?.id) {
      try {
        await RemoteStoreService.toggleSource(source.id, enabled)
        const updatedSources = await RemoteStoreService.getSources()
        setSources(updatedSources)
      } catch (error) {
        console.error('Failed to toggle source:', error)
        alert(error instanceof Error ? error.message : '操作失败')
      }
    }
  }

  const handleRemoveSource = async (url: string) => {
    // 通过 URL 找到 source ID
    const source = sources.find((s) => s.url === url)
    if (source?.id && confirm(t.tapp.confirmDeleteSource)) {
      try {
        await RemoteStoreService.removeSource(source.id)
        const updatedSources = await RemoteStoreService.getSources()
        setSources(updatedSources)
        loadRemoteApps(true)
      } catch (error) {
        console.error('Failed to remove source:', error)
        alert(error instanceof Error ? error.message : '删除失败')
      }
    }
  }

  const handleAddSource = async (
    source: Omit<RemoteStoreSource, 'id' | 'official'>,
  ) => {
    try {
      await RemoteStoreService.addSource(source)
      const updatedSources = await RemoteStoreService.getSources()
      setSources(updatedSources)
      loadRemoteApps(true)
    } catch (error) {
      console.error('Failed to add source:', error)
      alert(error instanceof Error ? error.message : '添加失败')
    }
  }

  // 获取所有分�?
  const categoryCounts = new Map<TappCategory, number>()

  // 统计所有应用的分类
  for (const app of allApps) {
    categoryCounts.set(
      app.category,
      (categoryCounts.get(app.category) ?? 0) + 1,
    )
  }

  const categories = TAPP_CATEGORIES.flatMap((id) => {
    const count = categoryCounts.get(id)
    return count
      ? [{ id, name: t.tapp[TAPP_CATEGORY_I18N_KEYS[id]], count }]
      : []
  })

  // 详情视图的安装状态派生
  const detailTappInfo = detailApp
    ? installedTapps.get(detailApp.id)
    : undefined
  const detailCanUninstall = detailTappInfo
    ? detailTappInfo.userRole === 'admin' ||
      (detailTappInfo.userRole === 'user' &&
        detailTappInfo.isTemporary === true)
    : false

  // 列表 ↔ 详情切换：记忆列表滚动位置，返回时恢复
  const listViewRef = useRef<HTMLDivElement | null>(null)
  const listScrollPosRef = useRef(0)
  const attachListView = useCallback((el: HTMLDivElement | null) => {
    listViewRef.current = el
    if (el) el.scrollTop = listScrollPosRef.current
  }, [])
  const openDetail = useCallback((app: UnifiedAppItem) => {
    listScrollPosRef.current = listViewRef.current?.scrollTop ?? 0
    setDetailApp(app)
  }, [])

  // 切换动效：进入详情向左滑（详情从右侧进入），返回反向
  const viewMotionProps = useCallback(
    (dir: 1 | -1) =>
      isExlight(animConfig)
        ? { initial: false as const }
        : {
            // motionShim may mount before the global coordinator starts. Keeping
            // the committed first frame visible prevents the store from getting
            // stranded at opacity: 0 while still allowing later route exits.
            initial: false as const,
            animate: {
              opacity: 1,
              x: 0,
              transition: {
                duration: 0.28 * animConfig.durationScale,
                ease: [0.22, 1, 0.36, 1] as const,
              },
            },
            exit: {
              opacity: 0,
              x: -18 * dir,
              transition: {
                duration: 0.2 * animConfig.durationScale,
                ease: [0.4, 0, 1, 1] as const,
              },
            },
          },
    [animConfig],
  )

  const isDiscoverView = !searchQuery && selectedCategory === null

  // Mac App Store 的发现页始终保留编辑精选；没有显式 featured 数据时，
  // 用目录前列应用补位，避免商店源规模较小时首屏退化为普通清单。
  const featuredApps = useMemo(() => {
    if (!isDiscoverView) return []
    const featured = allApps.filter((app) => app.featured)
    const fallback = allApps.filter(
      (app) => !featured.some((item) => item.id === app.id),
    )
    return [...featured, ...fallback].slice(0, 3)
  }, [allApps, isDiscoverView])

  const sectionTitle = useMemo(() => {
    if (selectedCategory === '__installed__') return t.tapp.installed
    if (selectedCategory) {
      return t.tapp[TAPP_CATEGORY_I18N_KEYS[selectedCategory]]
    }
    if (searchQuery) return t.tapp.searchApps.replace('...', '')
    return t.tapp.storeDiscover
  }, [selectedCategory, searchQuery, t])

  const selectCategory = useCallback(
    (category: TappCategory | '__installed__' | null) => {
      setSearchQuery('')
      setSelectedCategory(category)
    },
    [],
  )

  return (
    <div
      className={`as-store ${className}`}
      data-no-ripple
      data-store-compact={compact ? 'true' : undefined}
      data-embedded={embeddedChrome ? 'true' : undefined}
    >
      <div className="as-store__workspace">
        <aside className="as-store__sidebar" aria-label={t.tapp.storeBrowse}>
          <div className="as-store__sidebar-search">
            <FaSearch className="as-store__search-icon" />
            <input
              type="search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t.tapp.searchApps}
              className="as-store__search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="as-store__search-clear"
                onClick={() => setSearchQuery('')}
                title={t.tapp.clearSearch}
                aria-label={t.tapp.clearSearch}
              >
                <FaTimesCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <nav className="as-store__sidebar-nav">
            <p className="as-store__nav-heading">{t.tapp.storeLibrary}</p>
            <button
              type="button"
              className="as-store__nav-item"
              data-active={isDiscoverView ? 'true' : 'false'}
              onClick={() => selectCategory(null)}
            >
              <FaCompass />
              <span>{t.tapp.storeDiscover}</span>
            </button>
            <button
              type="button"
              className="as-store__nav-item"
              data-active={
                !searchQuery && selectedCategory === '__installed__'
                  ? 'true'
                  : 'false'
              }
              onClick={() => selectCategory('__installed__')}
            >
              <FaStar />
              <span>{t.tapp.installed}</span>
              <span className="as-store__nav-count">{installedIds.size}</span>
            </button>

            <p className="as-store__nav-heading">{t.tapp.storeBrowse}</p>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="as-store__nav-item"
                data-active={
                  !searchQuery && selectedCategory === category.id
                    ? 'true'
                    : 'false'
                }
                onClick={() => selectCategory(category.id)}
              >
                {CATEGORY_ICONS[category.id]}
                <span>{category.name}</span>
                <span className="as-store__nav-count">{category.count}</span>
              </button>
            ))}
          </nav>

          {isAdmin && (
            <div className="as-store__sidebar-tools">
              <button
                type="button"
                className="as-store__nav-item"
                onClick={() => setShowSourcesSettings(true)}
              >
                <FaCog />
                <span>{t.tapp.sourceManagement}</span>
              </button>
              <button
                type="button"
                className="as-store__nav-item"
                onClick={() => loadRemoteApps(true)}
                disabled={loading}
              >
                {loading ? <Spinner size="xs" color="current" /> : <FaSync />}
                <span>{t.tapp.refreshStore}</span>
              </button>
            </div>
          )}
        </aside>

        <main className="as-store__main">
          {/* 窄屏专用工具栏；桌面由左侧栏承担导航。外层页面顶栏不变。 */}
          <div className="as-store__chrome">
            <AnimatePresence mode="wait" initial={false}>
              {detailApp ? (
                <motion.div
                  key="detail-chrome"
                  {...viewMotionProps(1)}
                  className="as-store__back-bar"
                >
                  <button
                    type="button"
                    className="as-store__back"
                    onClick={() => setDetailApp(null)}
                  >
                    <FaArrowLeft className="h-3.5 w-3.5" />
                    {t.tapp.back}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="list-chrome"
                  {...viewMotionProps(-1)}
                  className="as-store__chrome-inner"
                >
                  <div className="as-store__search-row">
                    <div className="as-store__search">
                      <FaSearch className="as-store__search-icon" />
                      <input
                        type="search"
                        enterKeyHint="search"
                        autoComplete="off"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={t.tapp.searchApps}
                        className="as-store__search-input"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="as-store__search-clear"
                          onClick={() => setSearchQuery('')}
                          title={t.tapp.clearSearch}
                          aria-label={t.tapp.clearSearch}
                        >
                          <FaTimesCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        className="as-store__tool"
                        onClick={() => setShowSourcesSettings(true)}
                        title={t.tapp.sourceManagement}
                      >
                        <FaCog className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="as-store__tool"
                      onClick={() => loadRemoteApps(true)}
                      disabled={loading}
                      title={t.tapp.refreshStore}
                    >
                      {loading ? (
                        <Spinner size="sm" color="current" />
                      ) : (
                        <FaSync className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div
                    className="as-store__cats"
                    role="group"
                    aria-label={t.tapp.categoryFilter}
                  >
                    <CategoryPill
                      active={selectedCategory === null}
                      label={t.tapp.storeDiscover}
                      onClick={() => selectCategory(null)}
                    />
                    <CategoryPill
                      active={selectedCategory === '__installed__'}
                      label={t.tapp.installed}
                      onClick={() => selectCategory('__installed__')}
                    />
                    {categories.map((category) => (
                      <CategoryPill
                        key={category.id}
                        active={selectedCategory === category.id}
                        label={category.name}
                        onClick={() => selectCategory(category.id)}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="as-store__views">
            <AnimatePresence mode="wait" initial={false}>
              {detailApp ? (
                <motion.div
                  key={`detail-${detailApp.id}`}
                  {...viewMotionProps(1)}
                  className="as-store__view"
                >
                  <div className="as-store__scroll">
                    <div className="as-detail__desktop-back">
                      <button
                        type="button"
                        className="as-store__back"
                        onClick={() => setDetailApp(null)}
                      >
                        <FaArrowLeft className="h-3.5 w-3.5" />
                        {t.tapp.back}
                      </button>
                    </div>
                    <AppDetailView
                      app={detailApp}
                      isInstalled={installedIds.has(detailApp.id)}
                      installedVersion={detailTappInfo?.version}
                      canUninstall={detailCanUninstall}
                      installing={installing === detailApp.id}
                      installPercent={
                        installProgress?.id === detailApp.id
                          ? installProgress.percent
                          : null
                      }
                      installPhase={
                        installProgress?.id === detailApp.id
                          ? installProgress.phase
                          : null
                      }
                      installDetail={
                        installProgress?.id === detailApp.id
                          ? (installProgress.detail ?? null)
                          : null
                      }
                      updating={updating === detailApp.id}
                      onInstall={() => handleInstall(detailApp)}
                      onUpdate={() => handleUpdate(detailApp)}
                      onUninstall={(anchor) =>
                        handleUninstall(detailApp.id, anchor)
                      }
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  ref={attachListView}
                  {...viewMotionProps(-1)}
                  className="as-store__view as-store__scroll"
                >
                  <div className="as-store__scroll-pad">
                    <header className="as-store__page-head">
                      <h2 className="as-store__page-title">{sectionTitle}</h2>
                    </header>

                    {loading && remoteApps.length === 0 ? (
                      <div className="as-store__state" role="status">
                        <Spinner size="xl" color="primary" />
                      </div>
                    ) : error && remoteApps.length === 0 ? (
                      <div className="as-store__state">
                        <FaExclamationTriangle className="h-10 w-10 text-amber-500 opacity-80" />
                        <p>{error}</p>
                        <button
                          type="button"
                          className="as-store__retry"
                          onClick={() => loadRemoteApps(true)}
                        >
                          {t.tapp.retry}
                        </button>
                      </div>
                    ) : filteredApps.length === 0 ? (
                      <div className="as-store__state">
                        <FaFilter className="h-9 w-9 opacity-40" />
                        <p>{t.tapp.noMatchingApps}</p>
                      </div>
                    ) : (
                      <>
                        {featuredApps.length > 0 && (
                          <section className="as-store__section as-store__section--featured">
                            <div className="as-store__section-head">
                              <h3 className="as-store__section-title">
                                {t.tapp.storeFeatured}
                              </h3>
                            </div>
                            <div className="as-store__featured">
                              {featuredApps.map((app, index) => {
                                const style = getAppIconStyle(app)
                                return (
                                  <button
                                    key={`feat-${app.id}`}
                                    type="button"
                                    className={`as-store__feature-card ${style.className}`}
                                    data-feature-index={index}
                                    style={style.style}
                                    onClick={() => openDetail(app)}
                                  >
                                    <span
                                      className="as-store__feature-art"
                                      aria-hidden
                                    >
                                      <TappIcon
                                        icon={app.icon}
                                        iconSvg={app.iconSvg}
                                        name={app.name}
                                        sizeClass="w-16 h-16"
                                        textSizeClass="text-6xl"
                                      />
                                    </span>
                                    <span className="as-store__feature-eyebrow">
                                      {t.tapp.storeFeaturedEyebrow}
                                    </span>
                                    <span className="as-store__feature-name">
                                      {app.name}
                                    </span>
                                    {app.description && (
                                      <span className="as-store__feature-sub">
                                        {app.description}
                                      </span>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </section>
                        )}

                        <section className="as-store__section">
                          <div className="as-store__section-head">
                            <h3 className="as-store__section-title">
                              {isDiscoverView ? t.tapp.allApps : sectionTitle}
                            </h3>
                            <span className="as-store__section-meta">
                              {format(t.tapp.totalApps, {
                                total: filteredApps.length,
                              })}
                            </span>
                          </div>
                          <div className="as-store__list">
                            {filteredApps.map((app, index) => {
                              const tappInfo = installedTapps.get(app.id)
                              const canUninstall = tappInfo
                                ? tappInfo.userRole === 'admin' ||
                                  (tappInfo.userRole === 'user' &&
                                    tappInfo.isTemporary === true)
                                : false
                              const canUpdate =
                                !!tappInfo &&
                                ((app.source === 'remote' && !!app.remoteApp) ||
                                  (app.source === 'local' && !!app.localTapp))
                              return (
                                <UnifiedAppCard
                                  key={app.id}
                                  app={app}
                                  isInstalled={installedIds.has(app.id)}
                                  installedVersion={tappInfo?.version}
                                  canUninstall={canUninstall}
                                  onInstall={() => handleInstall(app)}
                                  onUpdate={
                                    canUpdate
                                      ? () => handleUpdate(app)
                                      : undefined
                                  }
                                  onUninstall={
                                    canUninstall
                                      ? (anchor) =>
                                          handleUninstall(app.id, anchor)
                                      : undefined
                                  }
                                  onOpen={() => openDetail(app)}
                                  installing={installing === app.id}
                                  installPercent={
                                    installProgress?.id === app.id
                                      ? installProgress.percent
                                      : null
                                  }
                                  installPhase={
                                    installProgress?.id === app.id
                                      ? installProgress.phase
                                      : null
                                  }
                                  installDetail={
                                    installProgress?.id === app.id
                                      ? (installProgress.detail ?? null)
                                      : null
                                  }
                                  updating={updating === app.id}
                                  animConfig={animConfig}
                                  index={index}
                                />
                              )
                            })}
                          </div>
                        </section>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <UninstallConfirmDialog
        isOpen={showUninstallDialog}
        appName={uninstallTargetName}
        anchorEl={uninstallAnchor}
        onCancel={cancelUninstall}
        onConfirm={handleConfirmUninstall}
      />

      {/* 商店源设置弹窗（子对话框，仍为浮层） */}
      <AnimatePresence>
        {showSourcesSettings && (
          <SourcesSettingsModal
            isOpen={showSourcesSettings}
            onClose={() => setShowSourcesSettings(false)}
            sources={sources}
            onToggle={handleToggleSource}
            onRemove={handleRemoveSource}
            onAdd={handleAddSource}
            onRefresh={() => loadRemoteApps(true)}
            refreshing={loading}
            isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default TappStore
