interface TxtParseResult {
  title: string
  author: string
  chapters: Array<{ title: string; content: string }>
  language: string
}

function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer.slice(0, 1024))
    return 'utf-8'
  } catch {
    return 'gbk'
  }
}

function detectLanguage(text: string): string {
  let chineseCount = 0
  const sampleLength = Math.min(1000, text.length)
  for (let i = 0; i < sampleLength; i++) {
    const code = text.charCodeAt(i)
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      chineseCount++
    }
  }
  return chineseCount / sampleLength > 0.05 ? 'zh' : 'en'
}

function extractBookTitle(filename: string): string {
  const match = filename.match(/《([^》]+)》/)
  return match ? match[1] : filename.replace(/\.[^.]+$/, '')
}

function extractAuthor(content: string): string {
  const fileHeader = content.slice(0, 1024)
  const authorMatch =
    fileHeader.match(/[【\[]?作者[】\]]?[:：]\s*(.+)/) ||
    fileHeader.match(/[【\[]?\s*(.+)\s+著/)
  return authorMatch ? authorMatch[1].trim() : ''
}

function extractChapters(content: string, language: string): Array<{ title: string; content: string }> {
  const segmentRegex = /(?:\r?\n){2,}|-{8,}\r?\n/

  let chapterRegex: RegExp
  if (language === 'zh') {
    chapterRegex = new RegExp(
      String.raw`(?:^|\n|\s)` +
        '(' +
        [
          String.raw`第[零〇一二三四五六七八九十0-9]+[章卷节回讲篇封](?:[：:、 　\(\)0-9]*[^\n-]{0,24})`,
          String.raw`(?:楔子|前言|引言|序言|序章|总论|概论)(?:[：: 　][^\n-]{0,24})?`,
        ].join('|') +
        ')',
      'gu'
    )
  } else {
    chapterRegex = /(?:^|\n|\s)(?:(Chapter|Part)\s+(\d+|[IVXLCDM]+)(?:[:.\-–—]?\s+[^\n]*)?)/gi
  }

  const formatSegment = (segment: string): string => {
    return segment
      .replace(/-{8,}|_{8,}/g, '\n')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line)
      .join('\n')
  }

  const chapters: Array<{ title: string; content: string }> = []
  const segments = content.split(segmentRegex)

  for (const segment of segments) {
    const trimmedSegment = segment.replace(/<!--.*?-->/g, '').trim()
    if (!trimmedSegment || trimmedSegment.length < 10) continue

    const matches = trimmedSegment.split(chapterRegex)

    if (matches.length === 1) {
      const firstLine = trimmedSegment.split('\n')[0]!.trim()
      const title = firstLine.length > 20 ? firstLine.slice(0, 20) : firstLine
      chapters.push({ title, content: formatSegment(trimmedSegment) })
      continue
    }

    for (let j = 1; j < matches.length; j += 2) {
      const title = matches[j]?.trim() || ''
      const chapterContent = matches[j + 1]?.trim() || ''
      if (chapterContent.length > 0) {
        chapters.push({
          title: title || `第${chapters.length + 1}章`,
          content: formatSegment(chapterContent),
        })
      }
    }
  }

  if (chapters.length === 0) {
    chapters.push({ title: '全文', content: formatSegment(content) })
  }

  return chapters
}

export function parseTxtFile(buffer: ArrayBuffer, filename: string): TxtParseResult {
  const encoding = detectEncoding(buffer)
  const content = new TextDecoder(encoding).decode(buffer).trim()

  const title = extractBookTitle(filename)
  const author = extractAuthor(content)
  const language = detectLanguage(content)
  const chapters = extractChapters(content, language)

  return { title, author, chapters, language }
}
