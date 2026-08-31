export interface TocItem {
  href?: string
  subitems?: TocItem[]
}

export function getChapterWindow(chapters: string[], selectedChapterId: string): string[] {
  const selectedIndex = chapters.indexOf(selectedChapterId)
  if (selectedIndex < 0) return [selectedChapterId]

  return chapters.slice(
    Math.max(0, selectedIndex - 1),
    Math.min(chapters.length, selectedIndex + 2),
  )
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
