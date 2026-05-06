import JSZip from 'jszip'
// @ts-expect-error JS module without type declarations
import { EPUB } from './foliate-js/epub.js'

interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}

interface EpubMetadata {
  title: string
  author: string
  language: string
}

interface ChapterContent {
  title: string
  content: string
  href: string
}

interface TocItem {
  label: string
  href: string
  subitems?: TocItem[]
}

interface EpubMetadata {
  title: string
  author: string
  language: string
}

interface ChapterContent {
  title: string
  content: string
  href: string
}

interface ParsedBook {
  metadata: EpubMetadata
  chapters: ChapterContent[]
  flatToc: TocItem[]  // For reading order (labels and hrefs only, no content)
  nestedToc: TocItem[] // For chapter list UI with volumes
  hrefToChapterIndex: Record<string, number> // Maps href to chapter index for navigation
}

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div[^>]*>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n')
  return text.trim()
}

function isFrontMatter(label: string): boolean {
  const skipPatterns = ['封面', '简介', '前言', '目录', 'contents', 'Contents', 'CONTENTS', '序言', '写在', '书名页', '版权页', '前折页', '文前插图']
  return skipPatterns.some(p => label.includes(p))
}

// Filter front matter from TOC while preserving nested structure
function filterToc(toc: TocItem[]): TocItem[] {
  const result: TocItem[] = []
  for (const item of toc) {
    const label = item.label || ''

    // Skip front matter items (but continue to their subitems)
    if (isFrontMatter(label)) {
      // Still process subitems in case front matter has nested valid chapters
      if (item.subitems && item.subitems.length > 0) {
        const filteredSubitems = filterToc(item.subitems)
        if (filteredSubitems.length > 0) {
          result.push(...filteredSubitems)
        }
      }
      continue
    }

    // If item has subitems, it's a volume/section - keep structure
    if (item.subitems && item.subitems.length > 0) {
      const filteredSubitems = filterToc(item.subitems)
      // Only add this item if it has href OR has valid subitems
      if (item.href || filteredSubitems.length > 0) {
        result.push({
          label: item.label,
          href: item.href || '',
          subitems: filteredSubitems.length > 0 ? filteredSubitems : undefined,
        })
      } else if (filteredSubitems.length > 0) {
        // No href, but has valid subitems - spread them at this level
        result.push(...filteredSubitems)
      }
    } else {
      // Leaf item (chapter with no subitems)
      result.push(item)
    }
  }
  return result
}

// Flatten TOC for sequential reading (extracts all leaf chapters)
function flattenTocForReading(toc: TocItem[], hrefsToSkip: Set<string> = new Set()): TocItem[] {
  const result: TocItem[] = []
  for (const item of toc) {
    // If item has subitems, recursively get all leaf chapters
    if (item.subitems && item.subitems.length > 0) {
      result.push(...flattenTocForReading(item.subitems, hrefsToSkip))
    } else {
      // Leaf item - only add if href not already collected
      const href = item.href.split('#')[0]
      if (!hrefsToSkip.has(href)) {
        hrefsToSkip.add(href)
        result.push(item)
      }
    }
  }
  return result
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'untitled'
}

export async function parseEpubFile(arrayBuffer: ArrayBuffer): Promise<ParsedBook> {
  const zip = await JSZip.loadAsync(arrayBuffer)

  const fileCache = new Map<string, ArrayBuffer>()
  const sizeMap = new Map<string, number>()
  zip.forEach((relativePath, file) => {
    // @ts-expect-error JSZip internal property for uncompressed size
    sizeMap.set(relativePath, file._data?.uncompressedSize || 0)
  })

  const loadFile = async (uri: string): Promise<ArrayBuffer | null> => {
    if (fileCache.has(uri)) return fileCache.get(uri)!
    const zipEntry = zip.file(uri)
    if (!zipEntry) return null
    const data = await zipEntry.async('arraybuffer')
    fileCache.set(uri, data)
    return data
  }

  const loadText = async (uri: string): Promise<string | null> => {
    const data = await loadFile(uri)
    if (!data) return null
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(data)
  }

  const loadBlob = async (uri: string): Promise<ArrayBuffer | null> => {
    return loadFile(uri)
  }

  const getSize = (name: string): number => {
    return sizeMap.get(name) || 0
  }

  const book = new EPUB({ loadText, loadBlob, getSize, sha1: undefined })
  await book.init()

  const meta = book.metadata
  const title = typeof meta.title === 'string' ? meta.title : meta.title?.['und'] || 'Unknown'
  const author = meta.author?.[0]?.name
    ? (typeof meta.author[0].name === 'string'
        ? meta.author[0].name
        : meta.author[0].name?.['und'] || 'Unknown')
    : 'Unknown'

  const metadata: EpubMetadata = {
    title,
    author,
    language: meta.language?.[0] || 'und',
  }

  const toc: TocItem[] = book.toc || []
  const filteredToc = filterToc(toc)
  const flatToc = flattenTocForReading(filteredToc)

  const chapters: ChapterContent[] = []
  const seenHrefs = new Set<string>()
  const hrefToChapterIndex: Record<string, number> = {}

  for (const tocItem of flatToc) {
    const href = tocItem.href.split('#')[0]
    if (seenHrefs.has(href)) continue
    seenHrefs.add(href)

    const zipEntry = zip.file(href)
    if (!zipEntry) continue

    try {
      const htmlContent = await zipEntry.async('text')
      const text = extractTextFromHtml(htmlContent)
      if (text.trim()) {
        const chapterIndex = chapters.length
        chapters.push({
          title: tocItem.label,
          content: text.trim(),
          href: tocItem.href,
        })
        hrefToChapterIndex[href] = chapterIndex
      }
    } catch (e) {
      console.warn('Failed to load chapter:', href, e)
    }
  }

  return { metadata, chapters, flatToc, nestedToc: filteredToc, hrefToChapterIndex }
}

export function generateChapterId(index: number, title: string): string {
  const safeName = sanitizeFileName(title)
  return `${String(index + 1).padStart(3, '0')}_${safeName}`
}
