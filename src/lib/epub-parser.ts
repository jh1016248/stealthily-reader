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

interface ParsedBook {
  metadata: EpubMetadata
  chapters: ChapterContent[]
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

function flattenToc(toc: TocItem[]): TocItem[] {
  const result: TocItem[] = []
  for (const item of toc) {
    if (item.subitems && item.subitems.length > 0) {
      result.push(...flattenToc(item.subitems))
    } else {
      const label = item.label || ''
      const skipPatterns = ['封面', '简介', '前言', '目录', 'contents', 'Contents', 'CONTENTS', '序言', '写在', '书名页', '版权页', '前折页', '文前插图']
      if (!skipPatterns.some(p => label.includes(p))) {
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

  const fileMap = new Map<string, ArrayBuffer>()
  const sizeMap = new Map<string, number>()
  zip.forEach((relativePath, file) => {
    fileMap.set(relativePath, file.async('arraybuffer') as any)
    // @ts-expect-error JSZip internal property for uncompressed size
    sizeMap.set(relativePath, file._data?.uncompressedSize || 0)
  })

  const loadText = (uri: string): string | null => {
    const data = fileMap.get(uri)
    if (!data) return null
    const decoder = new TextDecoder('utf-8')
    return decoder.decode(data)
  }

  const loadBlob = (uri: string): ArrayBuffer | null => {
    return fileMap.get(uri) || null
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
  const flatToc = flattenToc(toc)

  const chapters: ChapterContent[] = []
  const seenHrefs = new Set<string>()

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
        chapters.push({
          title: tocItem.label,
          content: text.trim(),
          href: tocItem.href,
        })
      }
    } catch (e) {
      console.warn('Failed to load chapter:', href, e)
    }
  }

  return { metadata, chapters }
}

export function generateChapterId(index: number, title: string): string {
  const safeName = sanitizeFileName(title)
  return `${String(index + 1).padStart(3, '0')}_${safeName}`
}
