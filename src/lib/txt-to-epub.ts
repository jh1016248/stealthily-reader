import JSZip from 'jszip'

interface Chapter {
  title: string
  content: string
}

interface EpubOptions {
  title: string
  author: string
  language?: string
  chapters: Chapter[]
}

export async function txtToEpub(options: EpubOptions): Promise<ArrayBuffer> {
  const {
    title,
    author,
    language = 'zh',
    chapters
  } = options

  const zip = new JSZip()

  // 1. 创建 META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  zip.file('META-INF/container.xml', containerXml)

  // 2. 创建 OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:identifier id="bookid">urn:uuid:${generateUUID()}</dc:identifier>
    <dc:date>${new Date().toISOString().split('T')[0]}</dc:date>
    <meta name="cover" content="cover-image"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="stylesheet" href="stylesheet.css" media-type="text/css"/>
    <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg"/>
    <item id="title-page" href="text/title-page.xhtml" media-type="application/xhtml+xml"/>
${chapters.map((_, index) =>
    `    <item id="chapter-${index + 1}" href="text/chapter${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
).join('\n')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title-page"/>
${chapters.map((_, index) =>
    `    <itemref idref="chapter-${index + 1}"/>`
).join('\n')}
  </spine>
</package>`
  zip.file('OEBPS/content.opf', contentOpf)

  // 3. 创建 OEBPS/toc.ncx
  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${generateUUID()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <navMap>
    <navPoint id="nav-title" playOrder="1">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="text/title-page.xhtml"/>
    </navPoint>
${chapters.map((chapter, index) =>
    `    <navPoint id="nav-chapter-${index + 1}" playOrder="${index + 2}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="text/chapter${index + 1}.xhtml"/>
    </navPoint>`
).join('\n')}
  </navMap>
</ncx>`
  zip.file('OEBPS/toc.ncx', tocNcx)

  // 4. 创建样式文件
  const stylesheet = `body {
  font-family: "Noto Serif", serif;
  line-height: 1.6;
  margin: 0;
  padding: 0;
  color: #333;
}

.chapter {
  margin: 2em 0;
}

.chapter-title {
  font-size: 1.5em;
  font-weight: bold;
  margin-bottom: 1em;
  text-align: center;
}

.chapter-content {
  text-indent: 2em;
  margin-bottom: 1em;
}

.title-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  text-align: center;
}

.book-title {
  font-size: 2em;
  margin-bottom: 2em;
}

.book-author {
  font-size: 1.2em;
  margin-bottom: 3em;
}`
  zip.file('OEBPS/stylesheet.css', stylesheet)

  // 5. 创建封面图片（使用一个简单的 SVG 占位符）
  const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
    <rect width="800" height="1200" fill="#f0f0f0"/>
    <text x="400" y="550" text-anchor="middle" font-family="Arial" font-size="48" font-weight="bold" fill="#333">${escapeXml(title)}</text>
    <text x="400" y="650" text-anchor="middle" font-family="Arial" font-size="36" fill="#333">作者：${escapeXml(author)}</text>
  </svg>`
  zip.file('OEBPS/images/cover.jpg', coverSvg)

  // 6. 创建标题页
  const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <div class="title-page">
    <h1 class="book-title">${escapeXml(title)}</h1>
    <p class="book-author">作者：${escapeXml(author)}</p>
  </div>
</body>
</html>`
  zip.file('OEBPS/text/title-page.xhtml', titlePage)

  // 7. 创建各个章节
  chapters.forEach((chapter, index) => {
    const chapterXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <div class="chapter">
    <h2 class="chapter-title">${escapeXml(chapter.title)}</h2>
    <div class="chapter-content">
${chapter.content.split('\n').map(line => `      <p>${escapeXml(line)}</p>`).join('\n')}
    </div>
  </div>
</body>
</html>`
    zip.file(`OEBPS/text/chapter${index + 1}.xhtml`, chapterXhtml)
  })

  // 生成 ZIP 文件
  return await zip.generateAsync({ type: 'arraybuffer' })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}