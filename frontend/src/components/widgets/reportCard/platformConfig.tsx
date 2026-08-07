import type { ReactNode } from 'react'
import {
  FaGithub,
  FaSteam,
  FaXbox,
  FaXTwitter,
  SiBangumi,
  SiBilibili,
  SiDiscord,
  SiMyanimelist,
  SiNeteasecloudmusic,
  SiPlaystation,
  SiYoutube,
} from '@lib/icons'

export const PLATFORM_CONFIG: Record<
  string,
  {
    icon: ReactNode
    color: string
    bgColor: string
    borderColor: string
    label: string
    textColor: string
  }
> = {
  bilibili: {
    icon: <SiBilibili />,
    color: '#00A1D6',
    bgColor: 'rgba(0, 161, 214, 0.15)',
    borderColor: 'rgba(0, 161, 214, 0.3)',
    label: 'Bilibili',
    textColor: 'text-[#00A1D6]',
  },
  steam: {
    icon: <FaSteam />,
    color: '#1b2838',
    bgColor: 'rgba(27, 40, 56, 0.15)',
    borderColor: 'rgba(27, 40, 56, 0.3)',
    label: 'Steam',
    textColor: 'text-gray-700 dark:text-gray-300',
  },
  github: {
    icon: <FaGithub />,
    color: '#24292e',
    bgColor: 'rgba(36, 41, 46, 0.15)',
    borderColor: 'rgba(36, 41, 46, 0.3)',
    label: 'GitHub',
    textColor: 'text-gray-900 dark:text-gray-100',
  },
  youtube: {
    icon: <SiYoutube />,
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.12)',
    borderColor: 'rgba(255, 0, 0, 0.3)',
    label: 'YouTube',
    textColor: 'text-red-600 dark:text-red-400',
  },
  netease: {
    icon: <SiNeteasecloudmusic />,
    color: '#e60026',
    bgColor: 'rgba(230, 0, 38, 0.15)',
    borderColor: 'rgba(230, 0, 38, 0.3)',
    label: 'NetEase',
    textColor: 'text-red-600',
  },
  bangumi: {
    icon: <SiBangumi />,
    color: '#f09199',
    bgColor: 'rgba(240, 145, 153, 0.15)',
    borderColor: 'rgba(240, 145, 153, 0.3)',
    label: 'Bangumi',
    textColor: 'text-rose-500',
  },
  mal: {
    icon: <SiMyanimelist />,
    color: '#2e51a2',
    bgColor: 'rgba(46, 81, 162, 0.15)',
    borderColor: 'rgba(46, 81, 162, 0.3)',
    label: 'MyAnimeList',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  x: {
    icon: <FaXTwitter />,
    color: '#000000',
    bgColor: 'rgba(0, 0, 0, 0.12)',
    borderColor: 'rgba(0, 0, 0, 0.25)',
    label: 'X',
    textColor: 'text-gray-900 dark:text-gray-100',
  },
  xbox: {
    icon: <FaXbox />,
    color: '#107C10',
    bgColor: 'rgba(16, 124, 16, 0.15)',
    borderColor: 'rgba(16, 124, 16, 0.3)',
    label: 'Xbox',
    textColor: 'text-[#107C10]',
  },
  psn: {
    icon: <SiPlaystation />,
    color: '#0070D1',
    bgColor: 'rgba(0, 112, 209, 0.15)',
    borderColor: 'rgba(0, 112, 209, 0.3)',
    label: 'PlayStation',
    textColor: 'text-[#0070D1]',
  },
  discord: {
    icon: <SiDiscord />,
    color: '#5865F2',
    bgColor: 'rgba(88, 101, 242, 0.15)',
    borderColor: 'rgba(88, 101, 242, 0.3)',
    label: 'Discord',
    textColor: 'text-[#5865F2]',
  },
}
