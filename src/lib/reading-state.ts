export interface TocItem {
  href?: string
  subitems?: TocItem[]
}

/**
 * 两章窗口：当前章 + 下一章。
 * 上一章何时销毁由滚动位置决定（滚入下一章超过一页），
 * 窗口本身只负责"当前 + 预加载下一章"。
 */
export function getChapterWindow(chapters: string[], selectedChapterId: string): string[] {
  const selectedIndex = chapters.indexOf(selectedChapterId)
  if (selectedIndex < 0) return [selectedChapterId]

  return chapters.slice(selectedIndex, Math.min(chapters.length, selectedIndex + 2))
}

export function getExpandedTocAncestorPaths(toc: TocItem[], targetHref: string): string[] {
  const target = targetHref.split('#')[0]

  const findAncestors = (items: TocItem[], parentPath = ''): string[] | null => {
    for (const [index, item] of items.entries()) {
      const path = parentPath ? `${parentPath}.${index}` : String(index)
      const href = item.href?.split('#')[0]
      if (href === target) return []

      if (item.subitems) {
        const descendants = findAncestors(item.subitems, path)
        if (descendants) return [path, ...descendants]
      }
    }

    return null
  }

  return findAncestors(toc) ?? []
}

/**
 * 顶部章节被移除后，滚动位置需整体上移 removedHeight 才能保持视口内容不变。
 * 无论移除前 scrollTop 是否已滚过被移除章节，都要补偿（clamp 到 0），
 * 否则视口会相对内容瞬间前移一整章的量（表现为"跳到下一章底部"）。
 */
export function adjustScrollTopAfterTrim(scrollTopBefore: number, removedHeight: number): number {
  return Math.max(0, scrollTopBefore - removedHeight)
}

/**
 * 是否可以推进两章窗口：滚入下一章超过一页，或已到达内容底部
 * （下一章不足一屏时，滚到底也允许推进；补偿后视口落在新当前章顶部）。
 */
export function hasScrolledAPageIntoNextChapter(
  scrollTop: number,
  clientHeight: number,
  firstChapterHeight: number,
  scrollHeight = Number.POSITIVE_INFINITY,
): boolean {
  if (scrollTop >= firstChapterHeight + clientHeight) return true
  return scrollHeight - scrollTop - clientHeight < 50
}
