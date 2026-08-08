/**
 * 站点内容配置 —— 纯静态官网的唯一内容真相源
 *
 * 结构/图标/链接/资源路径只动这一个文件;
 * 所有用户可见文案均来自 i18n(src/i18n/* 的 site 段),
 * 通过 getSections(t) / getHomeConfig(t) / getSiteMeta(t) 解析。
 * 运行时零网络请求。
 */

import type { LucideIcon } from 'lucide-react'
import type { TranslationKeys } from '../i18n'
import {
  LuCpu,
  LuDownload,
  LuImage,
  LuInfo,
  LuSparkles,
  LuUsers,
  LuWrench,
  LuZap,
} from '@lib/icons'

// ============================================================================
// 类型定义
// ============================================================================

export interface SiteSectionLink {
  label: string
  href: string
}

export interface SiteSectionDetail {
  /** 详情弹窗正文段落 */
  paragraphs?: string[]
  /** 详情弹窗要点列表 */
  list?: string[]
  /** 详情弹窗相关链接 */
  links?: SiteSectionLink[]
}

export interface SiteSection {
  /** 锚点 id(导航跳转 / 卡片 id) */
  id: string
  icon: LucideIcon
  title: string
  /** 卡片摘要(一两句话) */
  summary: string
  /** 点击卡片后弹窗展示的详细内容 */
  detail: SiteSectionDetail
  /** 外链卡片:设置后点击直接新标签页打开 href,不再弹详情窗 */
  href?: string
}

// ============================================================================
// 站点基本信息(品牌名不翻译,常量保留)
// ============================================================================

export const siteName = 'Myriad'

/** 站点标语与描述(经 i18n 解析) */
export function getSiteMeta(t: TranslationKeys) {
  return {
    slogan: t.site.slogan,
    description: t.site.description,
  } as const
}

// ============================================================================
// 首页配置(标题 + 静态用户信息卡,经 i18n 解析)
// ============================================================================

export function getHomeConfig(t: TranslationKeys) {
  return {
    /** 花体大标题 */
    title: t.site.homeTitle,
    /** 用户信息卡 */
    userName: t.site.homeUserName,
    userBio: t.site.homeUserBio,
    /** 头像(public/ 下的静态资源) */
    avatar: '/avatar.svg',
  } as const
}

// ============================================================================
// 壁纸配置(本地静态,不再请求后端 /api/config/ui)
// ============================================================================

export const wallpaperConfig = {
  /** 壁纸路径(public/ 下的静态资源);留空则只用纯色 + 渐变背景 */
  url: '/wallpaper.webp',
  /** 高斯模糊强度(px) */
  blur: 0,
  /** 壁纸加载失败 / 颜色提取失败时的兜底主色 */
  fallbackColor: '#94a3b8',
  /** Evocative 壁纸动效 */
  evocative: {
    parallax: true,
    dynamicBlur: false,
    ripple: false,
    fps: 30,
    rippleQuality: 0.85,
  },
} as const

// ============================================================================
// 页脚配置
// ============================================================================

export const footerConfig = {
  /** ICP 备案号(留空则不显示) */
  icp: '',
  /** 公安备案号(留空则不显示) */
  gongan: '',
} as const

// ============================================================================
// 板块内容(文案经 i18n 解析;结构/图标/链接在此维护)
// ============================================================================

const REPO_URL = 'https://github.com/Myriad-You/Myriad'

export function getSections(t: TranslationKeys): readonly SiteSection[] {
  const s = t.site
  return [
    {
      id: 'intro',
      icon: LuInfo,
      title: s.intro.title,
      summary: s.intro.summary,
      detail: {
        paragraphs: [s.intro.p1, s.intro.p2],
        list: [s.intro.l1, s.intro.l2, s.intro.l3, s.intro.l4],
      },
    },
    {
      id: 'features',
      icon: LuZap,
      title: s.features.title,
      summary: s.features.summary,
      detail: {
        paragraphs: [s.features.p1],
        list: [
          s.features.l1,
          s.features.l2,
          s.features.l3,
          s.features.l4,
          s.features.l5,
          s.features.l6,
        ],
      },
    },
    {
      id: 'preview',
      icon: LuImage,
      title: s.preview.title,
      summary: s.preview.summary,
      detail: {
        paragraphs: [s.preview.p1, s.preview.p2],
        list: [s.preview.l1, s.preview.l2, s.preview.l3, s.preview.l4],
      },
    },
    {
      id: 'download',
      icon: LuDownload,
      title: s.download.title,
      summary: s.download.summary,
      detail: {
        paragraphs: [s.download.p1],
        list: [s.download.l1, s.download.l2, s.download.l3, s.download.l4],
        links: [{ label: s.download.linkRepo, href: REPO_URL }],
      },
    },
    {
      id: 'tech-stack',
      icon: LuCpu,
      title: s.techStack.title,
      summary: s.techStack.summary,
      detail: {
        paragraphs: [s.techStack.p1],
        list: [
          s.techStack.l1,
          s.techStack.l2,
          s.techStack.l3,
          s.techStack.l4,
          s.techStack.l5,
          s.techStack.l6,
        ],
      },
    },
    {
      id: 'about',
      icon: LuUsers,
      title: s.about.title,
      summary: s.about.summary,
      detail: {
        paragraphs: [s.about.p1, s.about.p2],
        links: [{ label: s.about.linkRepo, href: REPO_URL }],
      },
    },
    {
      id: 'config-generator',
      icon: LuWrench,
      title: s.configGenerator.title,
      summary: s.configGenerator.summary,
      detail: {
        paragraphs: [s.configGenerator.p1],
      },
      href: 'https://kiseki.blog/tapp/run/com.myriad.config-generator',
    },
  ]
}

/** Hero 区装饰图标(与板块解耦) */
export const heroIcon: LucideIcon = LuSparkles
