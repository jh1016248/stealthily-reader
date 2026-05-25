<template>
  <div class="slack-off-container" :class="{ 'mouse-inside': isMouseInside }" :style="containerStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave" @mousedown="onContainerMouseDown($event)">
    <!-- 关闭按钮 -->
    <div class="btn-trigger btn-close-pos" @mousedown.stop>
      <button class="btn-action btn-close" @click="closeApp">x</button>
    </div>

    <!-- 导入按钮 -->
    <div class="btn-trigger btn-import-pos" @mousedown.stop>
      <button class="btn-action btn-import" @click="importBook">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </button>
    </div>

    <!-- 缩放手柄 -->
    <div class="resize-handle resize-n" @mousedown.stop.prevent="startResize('n')"></div>
    <div class="resize-handle resize-s" @mousedown.stop.prevent="startResize('s')"></div>
    <div class="resize-handle resize-e" @mousedown.stop.prevent="startResize('e')"></div>
    <div class="resize-handle resize-w" @mousedown.stop.prevent="startResize('w')"></div>
    <div class="resize-handle resize-ne" @mousedown.stop.prevent="startResize('ne')"></div>
    <div class="resize-handle resize-nw" @mousedown.stop.prevent="startResize('nw')"></div>
    <div class="resize-handle resize-se" @mousedown.stop.prevent="startResize('se')"></div>
    <div class="resize-handle resize-sw" @mousedown.stop.prevent="startResize('sw')"></div>

    <!-- 内容区域 -->
    <div class="content-area">
      <div class="content-wrapper library">
        <div class="library-header" :style="{ color: textColor }">
          <span class="library-title">我的书架</span>
          <span class="library-count" v-if="books.length">{{ books.length }} 本</span>
        </div>
        <div v-if="loading" class="loading" :style="{ color: textColor }">{{ loadingText }}</div>
        <div v-if="loading" class="loading">{{ loadingText }}</div>
        <template v-else>
          <div v-if="books.length === 0" class="empty-hint">
            <p>点击 + 导入小说</p>
          </div>
          <div v-for="book in books" :key="book.id" class="book-card" :style="{ borderColor: textColor + '18' }" @click="openBook(book.id)">
            <div class="book-info">
              <div class="book-title" :style="{ color: textColor }">{{ book.title }}</div>
              <div class="book-author" :style="{ color: textColor + '80' }">{{ book.author }}</div>
            </div>
            <button class="btn-delete" :style="{ color: textColor + '60' }" @click.stop="deleteBook(book.id)" @mousedown.stop>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { confirm } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'
import { parseEpubFile, generateChapterId } from '@/lib/epub-parser'
import { parseTxtFile, buildToc } from '@/lib/txt-parser'
import { txtToEpub } from '@/lib/txt-to-epub'
import { listen } from '@tauri-apps/api/event'

const router = useRouter()

interface Book {
  id: string
  title: string
  author: string
  language: string
  created_at: string
}

const isMouseInside = ref(false)
const isDragging = ref(false)
const bgColor = ref('#1a1a1a')
const bgOpacity = ref(85)
const textColor = ref('#e0e0e0')

const containerStyle = computed(() => ({
  background: bgColor.value + Math.round(bgOpacity.value * 2.55).toString(16).padStart(2, '0'),
}))
const loading = ref(false)
const loadingText = ref('')
const books = ref<Book[]>([])

const onMouseEnter = () => { isMouseInside.value = true }
const onMouseLeave = () => { if (isDragging.value) return; isMouseInside.value = false }

const appWindow = getCurrentWindow()

const onContainerMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.btn-trigger, .resize-handle, .book-card, .btn-delete, button, input, .float-panel')) return
  isDragging.value = true
  appWindow.startDragging()
  setTimeout(() => { isDragging.value = false }, 500)
}

const dirMap: Record<string, 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'> = {
  n: 'North', s: 'South', e: 'East', w: 'West',
  ne: 'NorthEast', nw: 'NorthWest', se: 'SouthEast', sw: 'SouthWest',
}

const startResize = (direction: string) => {
  appWindow.startResizeDragging(dirMap[direction])
}

const loadBooks = async () => {
  console.log('[LibraryView] Loading books...')
  try {
    const result = await invoke('list_books') as Book[]
    console.log('[LibraryView] Books loaded:', result)
    books.value = result
  } catch (error) {
    console.error('[LibraryView] Failed to load books:', error)
    books.value = []
  }
}

const importBook = async () => {
  console.log('[import] Starting import process...')
  await invoke('debug_log', { message: 'Starting import process...' })

  const filePath = await invoke<string | null>('select_file')
  console.log('[import] Selected file:', filePath)
  await invoke('debug_log', { message: `Selected file: ${filePath}` })

  if (!filePath) return

  const ext = filePath.split('.').pop()?.toLowerCase()
  let shouldConvert = false

  console.log('[import] File extension:', ext)
  await invoke('debug_log', { message: `File extension: ${ext}` })

  // 如果是 TXT 文件，询问用户处理方式
  if (ext === 'txt') {
    console.log('[import] TXT file detected, asking user for conversion preference')
    await invoke('debug_log', { message: 'TXT file detected, asking user for conversion preference' })

    try {
      shouldConvert = await confirm(
        '检测到 TXT 文件。是否转换为 EPUB 格式以获得更好的阅读体验？',
        { title: '文件格式选择', kind: 'info' }
      )
      console.log('[import] User chose to convert:', shouldConvert)
      await invoke('debug_log', { message: `User chose to convert: ${shouldConvert}` })

      if (!shouldConvert) {
        // 直接作为 TXT 处理
        console.log('[import] Processing as TXT directly...')
        await invoke('debug_log', { message: 'Processing as TXT directly...' })
        await processTxtFile(filePath)
        return
      }
    } catch (confirmError) {
      console.error('[import] Confirmation dialog failed:', confirmError)
      await invoke('debug_log', { message: `Confirmation dialog failed: ${confirmError}` })
      // 如果确认失败，默认转换为 EPUB
      shouldConvert = true
    }
  }

  loading.value = true
  loadingText.value = ext === 'txt' ? '转换为 EPUB...' : '解析中...'

  try {
    console.log('[import] Calling processFile...')
    await invoke('debug_log', { message: 'Calling processFile...' })
    await processFile(filePath, ext === 'txt' && shouldConvert)
    console.log('[import] processFile completed, calling loadBooks...')
    await invoke('debug_log', { message: 'processFile completed, calling loadBooks...' })
    await loadBooks()
    console.log('[import] Import completed successfully')
    await invoke('debug_log', { message: 'Import completed successfully' })
  } catch (e: any) {
    console.error('[import] failed:', e?.message || e?.toString?.() || e)
    console.error('[import] stack:', e?.stack)
    loadingText.value = `导入失败: ${e?.message || e}`
    await invoke('debug_log', { message: `Import failed: ${e?.message || e}` })
  } finally {
    loading.value = false
  }
}

const processFile = async (filePath: string, convertToEpub: boolean) => {
  console.log('[import] processFile started:', { filePath, convertToEpub })
  const buffer = await invoke<ArrayBuffer>('read_file_binary', { path: filePath })
  console.log('[import] reading file:', filePath)
  console.log('[import] buffer size:', buffer.byteLength)
  console.log('[import] convertToEpub:', convertToEpub)

  const bookId = `book_${Date.now()}`
  console.log('[import] generated bookId:', bookId)
  let title = ''
  let author = ''
  let language = 'und'
  const chapters: Array<{ chapterId: string; content: string }> = []

  if (convertToEpub) {
    // 将 TXT 转换为 EPUB 格式保存
    console.log('[import] converting txt to epub...')
    const filename = filePath.replace(/\\/g, '/').split('/').pop() || 'unknown'
    console.log('[import] filename:', filename)
    const txtResult = parseTxtFile(buffer, filename)
    console.log('[import] parseTxtResult:', txtResult)

    title = txtResult.title
    author = txtResult.author
    language = txtResult.language
    console.log('[import] extracted:', { title, author, language })

    // 准备章节数据
    console.log('[import] preparing chapters...')
    for (let i = 0; i < txtResult.chapters.length; i++) {
      const ch = txtResult.chapters[i]
      const chapterId = generateChapterId(i, ch.title)
      chapters.push({
        chapterId,
        content: ch.content,
      })
      console.log(`[import] chapter ${i + 1}: ${ch.title} (${chapterId})`)
    }

    // 创建 EPUB 文件
    loadingText.value = '生成 EPUB...'
    console.log('[import] txtResult chapters:', txtResult.chapters.length)
    console.log('[import] txtResult title:', txtResult.title)
    console.log('[import] calling txtToEpub...')
    const epubBuffer = await txtToEpub({
      title,
      author,
      language,
      chapters: txtResult.chapters.map(ch => ({
        title: ch.title,
        content: ch.content
      }))
    })
    console.log('[import] txtToEpub completed')

    // 保存 EPUB 文件
    console.log('[import] epubBuffer size:', epubBuffer.byteLength)
    console.log('[import] saving epub file...')
    await invoke('save_epub_file', {
      bookId,
      epubBuffer: Array.from(new Uint8Array(epubBuffer))
    })
    console.log('[import] epub file saved')

    // 保存书籍信息
    console.log('[import] saving book metadata...')
    await invoke('save_book', {
      metadata: {
        id: bookId,
        title,
        author,
        language,
        created_at: new Date().toISOString(),
      },
    })
    console.log('[import] book metadata saved')

    // 保存章节
    console.log('[import] saving chapters...')
    for (let i = 0; i < chapters.length; i++) {
      console.log(`[import] saving chapter ${i + 1}: ${chapters[i].chapterId}`)
      await invoke('save_chapter', {
        bookId,
        chapterId: chapters[i].chapterId,
        content: chapters[i].content,
      })
      loadingText.value = `保存中... (${i + 1}/${chapters.length})`
    }
    console.log('[import] all chapters saved')

    // 保存 TOC 供阅读视图使用
    if (txtResult.chapters.length > 0) {
      const tocData = buildToc(txtResult.chapters)
      await invoke('save_toc', { bookId, toc: JSON.stringify(tocData) })
    }

  } else {
    const filename = filePath.replace(/\\/g, '/').split('/').pop() || 'unknown'

    if (filename.toLowerCase().endsWith('.epub')) {
      const result = await parseEpubFile(buffer)
      title = result.metadata.title
      author = result.metadata.author
      language = result.metadata.language
      for (let i = 0; i < result.chapters.length; i++) {
        const ch = result.chapters[i]
        chapters.push({
          chapterId: generateChapterId(i, ch.title),
          content: ch.content,
        })
      }
      if (result.nestedToc && result.nestedToc.length > 0) {
        await invoke('save_toc', { bookId, toc: JSON.stringify({
          nested: result.nestedToc,
          flat: result.flatToc,
          hrefToIndex: result.hrefToChapterIndex,
        }) })
      }
    } else {
      const result = parseTxtFile(buffer, filename)
      title = result.title
      author = result.author
      language = result.language
      for (let i = 0; i < result.chapters.length; i++) {
        const ch = result.chapters[i]
        chapters.push({
          chapterId: generateChapterId(i, ch.title),
          content: ch.content,
        })
      }
      if (result.chapters.length > 0) {
        const tocData = buildToc(result.chapters)
        await invoke('save_toc', { bookId, toc: JSON.stringify(tocData) })
      }
    }

    loadingText.value = `保存中... (0/${chapters.length})`
    await invoke('save_book', {
      metadata: {
        id: bookId,
        title,
        author,
        language,
        created_at: new Date().toISOString(),
      },
    })
    for (let i = 0; i < chapters.length; i++) {
      await invoke('save_chapter', {
        bookId,
        chapterId: chapters[i].chapterId,
        content: chapters[i].content,
      })
      loadingText.value = `保存中... (${i + 1}/${chapters.length})`
    }
  }
  console.log('[import] processFile completed for:', filePath)
  console.log('[import] reloading books list...')
  await loadBooks()
  console.log('[import] books list reloaded')
}

const processTxtFile = async (filePath: string, buffer?: ArrayBuffer) => {
  console.log('[import] processTxtFile called with:', { filePath, buffer: !!buffer })
  await invoke('debug_log', { message: `processTxtFile called with: ${filePath}, buffer: ${!!buffer}` })

  try {
    const bufferArray = buffer || await invoke<ArrayBuffer>('read_file_binary', { path: filePath })
    console.log('[import] buffer size:', bufferArray.byteLength)
    await invoke('debug_log', { message: `Buffer size: ${bufferArray.byteLength}` })

    const uint8 = new Uint8Array(bufferArray)
    const filename = filePath.replace(/\\/g, '/').split('/').pop() || 'unknown'
    const ext = filePath.split('.').pop()?.toLowerCase()

    console.log('[import] ext:', ext, 'filename:', filename)
    await invoke('debug_log', { message: `File extension: ${ext}, filename: ${filename}` })

    console.log('[import] Calling parseTxtFile...')
    await invoke('debug_log', { message: 'Calling parseTxtFile...' })
    const result = parseTxtFile(uint8.buffer, filename)
    console.log('[import] parseTxtFile result:', result)
    await invoke('debug_log', { message: `parseTxtFile result: title=${result.title}, author=${result.author}, language=${result.language}, chapters=${result.chapters.length}` })

    const bookId = `book_${Date.now()}`
    console.log('[import] generated bookId:', bookId)
    const title = result.title
    const author = result.author
    const language = result.language
    const chapters: Array<{ chapterId: string; content: string }> = []

    for (let i = 0; i < result.chapters.length; i++) {
      const ch = result.chapters[i]
      chapters.push({
        chapterId: generateChapterId(i, ch.title),
        content: ch.content,
      })
    }

  // Save TOC data for chapter list UI and navigation
  if (result.chapters.length > 0) {
    const tocData = buildToc(result.chapters)
    await invoke('save_toc', { bookId, toc: JSON.stringify(tocData) })
  }

  loadingText.value = `保存中... (0/${chapters.length})`

  await invoke('save_book', {
    metadata: {
      id: bookId,
      title,
      author,
      language,
      created_at: new Date().toISOString(),
    },
  })

  for (let i = 0; i < chapters.length; i++) {
    await invoke('save_chapter', {
      bookId,
      chapterId: chapters[i].chapterId,
      content: chapters[i].content,
    })
    loadingText.value = `保存中... (${i + 1}/${chapters.length})`
  }
  } catch (e: any) {
    console.error('[import] processTxtFile failed:', e?.message || e)
    await invoke('debug_log', { message: `processTxtFile failed: ${e?.message || e}` })
    throw e
  }
}

const openBook = (bookId: string) => {
  router.push(`/book/${bookId}`)
}

const deleteBook = async (bookId: string) => {
  const book = books.value.find(b => b.id === bookId)
  const confirmed = await confirm(`确定删除《${book?.title || ''}》？`)
  if (!confirmed) return
  await invoke('delete_book', { bookId })
  await loadBooks()
}

const closeApp = () => {
  appWindow.close()
}

onMounted(async () => {
  await loadBooks()
  try {
    const settings = await invoke<any>('load_settings')
    if (settings?.text_color) textColor.value = settings.text_color
    if (settings?.bg_color) bgColor.value = settings.bg_color
    if (settings?.bg_opacity !== undefined) bgOpacity.value = settings.bg_opacity
  } catch {}
  try {
    const settings = await invoke<any>('load_settings')
    if (settings?.window_bounds) {
      const b = settings.window_bounds
      const screen = await currentMonitor()
      if (screen) {
        const s = screen.size
        const pos = screen.position
        if (b.x >= pos.x && b.y >= pos.y && b.width <= s.width && b.height <= s.height) {
          appWindow.setPosition(new LogicalPosition(b.x, b.y))
          appWindow.setSize(new LogicalSize(b.width, b.height))
        }
      }
    }
  } catch {}
  const unlistenEnter = await listen('cursor-enter', () => onMouseEnter())
  const unlistenLeave = await listen('cursor-leave', () => onMouseLeave())
  const unlistenFocus = await appWindow.onFocusChanged(({ payload: focused }) => {
    if (focused) isMouseInside.value = true
  })
  onUnmounted(() => { unlistenEnter(); unlistenLeave(); unlistenFocus() })
})
</script>

<style scoped>
.slack-off-container {
  width: 100vw;
  height: 100vh;
  background: transparent;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  user-select: none;
}

/* 按钮触发区域 */
.btn-trigger {
  position: absolute;
  width: 28px;
  height: 28px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-trigger::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 1px;
  border-radius: 1px;
  background: rgba(150, 150, 150, 0.15);
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.mouse-inside .btn-trigger::after {
  opacity: 1;
}

.btn-trigger:hover::after {
  opacity: 0 !important;
}

.btn-trigger .btn-action {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.4);
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.mouse-inside .btn-trigger .btn-action {
  opacity: 0.2;
  pointer-events: auto;
}

.btn-trigger:hover .btn-action {
  opacity: 1;
}

.btn-action svg {
  width: 14px;
  height: 14px;
}

.btn-close-pos {
  top: 4px;
  right: 8px;
}

.btn-close-pos .btn-close {
  font-size: 13px;
}

.btn-import-pos {
  bottom: 8px;
  right: 8px;
}

.btn-import {
  background: rgba(0, 150, 0, 0.4);
  border-color: rgba(0, 255, 0, 0.3);
  color: rgba(0, 255, 0, 0.6);
}

.btn-import:hover {
  background: rgba(0, 150, 0, 0.6);
  color: #fff;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 40px 20px;
  opacity: 0;
  transition: opacity 0.15s;
  scrollbar-width: none;
}

.content-area::-webkit-scrollbar {
  display: none;
}

.mouse-inside .content-area {
  opacity: 1;
}

.content-wrapper {
  max-width: 600px;
  margin: 0 auto;
}

.library-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library-title {
  font-size: 24px;
  font-weight: 600;
}

.library-count {
  font-size: 14px;
  opacity: 0.7;
}

.empty-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 40px 0;
}

.loading {
  text-align: center;
  padding: 40px 0;
}

.book-card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
}

.book-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateX(4px);
}

.book-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 16px;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-author {
  font-size: 14px;
  opacity: 0.7;
}

.btn-delete {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 4px;
}

.book-card:hover .btn-delete {
  opacity: 0.6;
}

.btn-delete:hover {
  opacity: 1;
}

/* 缩放手柄 */
.resize-handle {
  position: absolute;
  z-index: 30;
}

.resize-n {
  top: -3px;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: n-resize;
}
.resize-s {
  bottom: -3px;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: s-resize;
}
.resize-e {
  right: -3px;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: e-resize;
}
.resize-w {
  left: -3px;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: w-resize;
}
.resize-ne {
  top: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  cursor: ne-resize;
}
.resize-nw {
  top: -3px;
  left: -3px;
  width: 12px;
  height: 12px;
  cursor: nw-resize;
}
.resize-se {
  bottom: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  cursor: se-resize;
}
.resize-sw {
  bottom: -3px;
  left: -3px;
  width: 12px;
  height: 12px;
  cursor: sw-resize;
}
</style>