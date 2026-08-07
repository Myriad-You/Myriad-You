import { getPublicConfigDeduped } from '../../../utils/requestDedup'

/** 各平台社交主页链接（长按设置里「打开社交主页」用） */
export const PLATFORM_SOCIAL: Record<
  string,
  { publicName: string; fieldKey: string; getUserUrl: (id: string) => string }
> = {
  bilibili: {
    publicName: 'Bilibili',
    fieldKey: 'uid',
    getUserUrl: (u) => `https://space.bilibili.com/${u}`,
  },
  steam: {
    publicName: 'Steam',
    fieldKey: 'steam_id',
    getUserUrl: (u) => `https://steamcommunity.com/profiles/${u}`,
  },
  github: {
    publicName: 'GitHub',
    fieldKey: 'username',
    getUserUrl: (u) => `https://github.com/${u}`,
  },
  youtube: {
    publicName: 'YouTube',
    fieldKey: 'channel_id',
    getUserUrl: (u) => {
      const id = String(u).trim()
      if (id.startsWith('UC') && id.length >= 20) {
        return `https://www.youtube.com/channel/${id}`
      }
      const handle = id.replace(/^@/, '')
      return `https://www.youtube.com/@${handle}`
    },
  },
  netease: {
    publicName: 'Netease Music',
    fieldKey: 'user_id',
    getUserUrl: (u) => `https://music.163.com/#/user/home?id=${u}`,
  },
  bangumi: {
    publicName: 'Bangumi',
    fieldKey: 'username',
    getUserUrl: (u) => `https://bgm.tv/user/${u}`,
  },
  mal: {
    publicName: 'MyAnimeList',
    fieldKey: 'username',
    getUserUrl: (u) => `https://myanimelist.net/profile/${u}`,
  },
  x: {
    publicName: 'X',
    fieldKey: 'username',
    getUserUrl: (u) => `https://x.com/${String(u).replace(/^@/, '')}`,
  },
  xbox: {
    publicName: 'Xbox',
    fieldKey: 'gamertag',
    getUserUrl: (u) =>
      `https://www.xbox.com/play/user/${encodeURIComponent(u)}`,
  },
  psn: {
    publicName: 'PlayStation',
    fieldKey: 'online_id',
    getUserUrl: (u) =>
      `https://profile.playstation.com/me/profile/${encodeURIComponent(u)}`,
  },
  discord: {
    publicName: 'Discord',
    fieldKey: 'user_id',
    getUserUrl: (u) => `https://discord.com/users/${u}`,
  },
}

// 从公开配置取各平台用户ID（模块级缓存，避免重复请求）
let cachedUserIds: Record<string, string> | null = null
let userIdsPromise: Promise<Record<string, string>> | null = null
export async function fetchPlatformUserIds(): Promise<Record<string, string>> {
  if (cachedUserIds) return cachedUserIds
  if (userIdsPromise) return userIdsPromise
  userIdsPromise = (async () => {
    const map: Record<string, string> = {}
    try {
      // 去重缓存：与社交网络小组件共享同一次 /api/config/public 请求
      const data = await getPublicConfigDeduped()
      if (Array.isArray(data.platforms)) {
        for (const p of data.platforms) {
          // 只要字段有值即可；enabled 只控制报告页卡片是否展示，不挡读配置
          const entry = Object.entries(PLATFORM_SOCIAL).find(
            ([, s]) => s.publicName === p.name,
          )
          if (!entry) continue
          const [pid, s] = entry
          const field = (p.config_fields || []).find(
            (f: { key: string; value?: string }) =>
              f.key === s.fieldKey && f.value,
          )
          if (field) map[pid] = field.value as string
        }
      }
    } catch {
      // 静默：拿不到就走报告页兜底
    }
    cachedUserIds = map
    return map
  })()
  return userIdsPromise
}
