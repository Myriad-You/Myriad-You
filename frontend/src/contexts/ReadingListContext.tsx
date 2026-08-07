/**
 * 阅读列表上下文
 * 管理 AI 生成的阅读列表和顺序阅读状态
 */

import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

// 阅读列表项（来自 AI 生成）
export interface ReadingListItem {
  id: number
  title: string
  author?: string
  sourceName?: string
  publishedAt?: string
  summary?: string
  relevanceReason?: string
  link?: string
  /** 文章内容（网络搜索结果可能需要后续获取） */
  content?: string
  /** 是否来自 AI 网络搜索（而非数据库） */
  fromWebSearch?: boolean
}

// 阅读列表
export interface ReadingList {
  id: string // 唯一标识
  name: string // 列表名称
  criteria: string // 生成条件
  items: ReadingListItem[]
  createdAt: Date
}

// 阅读进度
export interface ReadingProgress {
  listId: string
  currentIndex: number
  readIds: Set<number> // 已读文章 ID
}

interface ReadingListContextType {
  // 当前阅读列表
  currentList: ReadingList | null
  // 阅读进度
  progress: ReadingProgress | null
  // 历史阅读列表
  history: ReadingList[]

  // 设置阅读列表（从 Agent 响应）
  setReadingList: (list: ReadingList) => void
  // 清除当前阅读列表
  clearReadingList: () => void
  // 跳转到列表中的某篇文章
  goToArticle: (index: number) => void
  // 标记当前文章已读并获取下一篇
  markReadAndNext: () => ReadingListItem | null
  // 获取上一篇
  getPrevious: () => ReadingListItem | null
  // 获取下一篇（不标记已读）
  getNext: () => ReadingListItem | null
  // 获取当前文章
  getCurrentItem: () => ReadingListItem | null
  // 检查是否在阅读列表中
  isInReadingList: (itemId: number) => boolean
  // 获取文章在列表中的位置信息
  getPositionInfo: (itemId: number) => {
    index: number
    total: number
    hasPrev: boolean
    hasNext: boolean
  } | null
}

const ReadingListContext = createContext<ReadingListContextType | null>(null)

export function ReadingListProvider({ children }: { children: ReactNode }) {
  const [currentList, setCurrentListState] = useState<ReadingList | null>(null)
  const [progress, setProgress] = useState<ReadingProgress | null>(null)
  const [history, setHistory] = useState<ReadingList[]>([])

  // 设置新的阅读列表
  const setReadingList = useCallback((list: ReadingList) => {
    setCurrentListState(list)
    setProgress({
      listId: list.id,
      currentIndex: 0,
      readIds: new Set(),
    })
    // 添加到历史
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.id !== list.id)
      return [list, ...filtered].slice(0, 10) // 保留最近10个
    })
  }, [])

  // 清除当前列表
  const clearReadingList = useCallback(() => {
    setCurrentListState(null)
    setProgress(null)
  }, [])

  // 跳转到指定文章
  const goToArticle = useCallback(
    (index: number) => {
      if (!currentList || index < 0 || index >= currentList.items.length) return
      setProgress((prev) => (prev ? { ...prev, currentIndex: index } : null))
    },
    [currentList],
  )

  // 获取当前文章
  const getCurrentItem = useCallback((): ReadingListItem | null => {
    if (!currentList || !progress) return null
    return currentList.items[progress.currentIndex] || null
  }, [currentList, progress])

  // 获取上一篇
  const getPrevious = useCallback((): ReadingListItem | null => {
    if (!currentList || !progress || progress.currentIndex <= 0) return null
    return currentList.items[progress.currentIndex - 1]
  }, [currentList, progress])

  // 获取下一篇
  const getNext = useCallback((): ReadingListItem | null => {
    if (
      !currentList ||
      !progress ||
      progress.currentIndex >= currentList.items.length - 1
    ) {
      return null
    }
    return currentList.items[progress.currentIndex + 1]
  }, [currentList, progress])

  // 标记已读并跳转下一篇
  const markReadAndNext = useCallback((): ReadingListItem | null => {
    if (!currentList || !progress) return null

    const currentItem = currentList.items[progress.currentIndex]
    const newReadIds = new Set(progress.readIds)
    if (currentItem) {
      newReadIds.add(currentItem.id)
    }

    if (progress.currentIndex < currentList.items.length - 1) {
      setProgress({
        ...progress,
        currentIndex: progress.currentIndex + 1,
        readIds: newReadIds,
      })
      return currentList.items[progress.currentIndex + 1]
    } else {
      setProgress({ ...progress, readIds: newReadIds })
      return null
    }
  }, [currentList, progress])

  // 检查是否在阅读列表中
  const isInReadingList = useCallback(
    (itemId: number): boolean => {
      if (!currentList) return false
      return currentList.items.some((item) => item.id === itemId)
    },
    [currentList],
  )

  // 获取位置信息
  const getPositionInfo = useCallback(
    (itemId: number) => {
      if (!currentList) return null
      const index = currentList.items.findIndex((item) => item.id === itemId)
      if (index === -1) return null
      return {
        index,
        total: currentList.items.length,
        hasPrev: index > 0,
        hasNext: index < currentList.items.length - 1,
      }
    },
    [currentList],
  )

  // 监听来自 AgentGlobalActions 的阅读列表设置事件
  useEffect(() => {
    const handleSetReadingList = (event: CustomEvent<ReadingList>) => {
      console.log(
        '[ReadingListContext] Received set-reading-list event:',
        event.detail,
      )
      setReadingList(event.detail)
    }

    window.addEventListener(
      'agent:set-reading-list',
      handleSetReadingList as EventListener,
    )
    return () => {
      window.removeEventListener(
        'agent:set-reading-list',
        handleSetReadingList as EventListener,
      )
    }
  }, [setReadingList])

  const value = useMemo(
    () => ({
      currentList,
      progress,
      history,
      setReadingList,
      clearReadingList,
      goToArticle,
      markReadAndNext,
      getPrevious,
      getNext,
      getCurrentItem,
      isInReadingList,
      getPositionInfo,
    }),
    [
      currentList,
      progress,
      history,
      setReadingList,
      clearReadingList,
      goToArticle,
      markReadAndNext,
      getPrevious,
      getNext,
      getCurrentItem,
      isInReadingList,
      getPositionInfo,
    ],
  )

  return (
    <ReadingListContext.Provider value={value}>
      {children}
    </ReadingListContext.Provider>
  )
}

export function useReadingList() {
  const context = useContext(ReadingListContext)
  if (!context) {
    throw new Error('useReadingList must be used within a ReadingListProvider')
  }
  return context
}

// 可选的 hook，在 Provider 外部使用时返回 null
export function useReadingListOptional() {
  return useContext(ReadingListContext)
}
