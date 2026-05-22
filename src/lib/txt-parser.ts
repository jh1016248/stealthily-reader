interface TxtParseResult {
  title: string
  author: string
  chapters: Array<{ title: string; content: string }>
  language: string
}

interface TocItem {
  label: string
  href: string
  expanded?: boolean
  subitems?: TocItem[]
}

interface TocData {
  nested: TocItem[]
  flat: TocItem[]
  hrefToIndex: Record<string, number>
}

const volumeRegex = /第[零〇一二三四五六七八九十0-9]+[卷篇]/

export function buildToc(chapters: Array<{ title: string }>): TocData {
  const flat: TocItem[] = chapters.map((ch, i) => ({
    label: ch.title,
    href: `chapter-${i}`
  }))

  const hrefToIndex: Record<string, number> = {}
  flat.forEach((item, i) => { hrefToIndex[item.href] = i })

  // 构建嵌套结构：卷/篇作为分组，章/回/节作为子项
  const nested: TocItem[] = []
  let currentGroup: TocItem | null = null

  for (let i = 0; i < flat.length; i++) {
    const item = flat[i]
    if (volumeRegex.test(item.label)) {
      // 卷/篇：创建分组
      currentGroup = { label: item.label, href: item.href, expanded: false, subitems: [] }
      nested.push(currentGroup)
    } else if (currentGroup) {
      // 章在卷下
      currentGroup.subitems!.push(item)
    } else {
      // 卷之前的章节直接放在顶层
      nested.push(item)
    }
  }

  return { nested, flat, hrefToIndex }
}

function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // BOM 检测
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le'
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be'
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8'

  // 尝试严格 UTF-8 解码
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer.slice(0, 4096))
    return 'utf-8'
  } catch {
    // 非 UTF-8，统计高位字节判断是否为 GBK
    const sampleLength = Math.min(1024, bytes.length)
    let highByteCount = 0
    for (let i = 0; i < sampleLength; i++) {
      if (bytes[i]! >= 0x80) highByteCount++
    }
    return highByteCount / sampleLength > 0.3 ? 'gbk' : 'utf-8'
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
  const basename = filename.replace(/\\/g, '/').split('/').pop() || filename

  const match = basename.match(/《([^》]+)》/)
  if (match) return match[1]

  const cleanName = basename.replace(/\.[^.]+$/, '')
  return cleanName.replace(/【[^】]+】/, '').trim() || cleanName
}

function extractAuthor(content: string): string {
  const fileHeader = content.slice(0, 1024)
  const authorMatch =
    fileHeader.match(/[【\[]?作者[】\]]?[:：]\s*(.+)/) ||
    fileHeader.match(/[【\[]?\s*(.+)\s+著/)
  return authorMatch ? authorMatch[1].trim() : ''
}

function extractChapters(content: string, language: string): Array<{ title: string; content: string }> {
  let chapterRegex: RegExp
  if (language === 'zh') {
    chapterRegex = new RegExp(
      '(?:^|\\n|\\s)' +
        '(' +
        [
          '第[零〇一二三四五六七八九十0-9]+[章卷节回讲篇封](?:[：:、\\s　\\(\\)0-9]*[^\\n-]{0,24})',
          '(?:楔子|前言|引言|序言|序章|总论|概论|后记|尾声|终章)(?:[：:、\\s　][^\\n-]{0,24})?',
        ].join('|') +
        ')',
      'gu'
    )
  } else {
    chapterRegex = /(?:^|\n|\s)(?:(Chapter|Part)\s+(\d+|[IVXLCDM]+)(?:[:.\-–—]?\s+[^\n]*)?)/gi
  }

  const formatContent = (text: string): string => {
    return text
      .replace(/-{8,}|_{8,}|━{8,}/g, '\n')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line)
      .join('\n')
  }

  // 直接对全文按章节标题分割
  const parts = content.split(chapterRegex)

  const chapters: Array<{ title: string; content: string }> = []

  // 如果前言内容够长，作为单独章节
  const preamble = formatContent(parts[0] || '')
  if (preamble.length > 50) {
    chapters.push({ title: '前言', content: preamble })
  }

  for (let i = 1; i < parts.length; i += 2) {
    let title = (parts[i] || '').trim()
    // 去掉标题中的装饰线
    title = title.replace(/[━\-]{4,}/g, '').trim()
    const rawContent = parts[i + 1] || ''
    const formatted = formatContent(rawContent)

    if (formatted.length > 0 || title) {
      chapters.push({
        title: title || `第${chapters.length + 1}章`,
        content: formatted
      })
    }
  }

  if (chapters.length === 0) {
    chapters.push({ title: '全文', content: formatContent(content) })
  }

  return chapters
}

export function parseTxtFile(buffer: ArrayBuffer, filename: string): TxtParseResult {
  const encoding = detectEncoding(buffer)
  let content: string

  try {
    const decoder = encoding === 'gbk' ?
      new TextDecoder('gbk', { fatal: false }) :
      new TextDecoder(encoding, { fatal: false })
    content = decoder.decode(buffer).trim()
  } catch {
    content = new TextDecoder('utf-8', { fatal: false }).decode(buffer).trim()
  }

  const title = extractBookTitle(filename)
  const author = extractAuthor(content)
  const language = detectLanguage(content)
  const chapters = extractChapters(content, language)

  return { title, author, chapters, language }
}
