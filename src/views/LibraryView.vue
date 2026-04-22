<template>
  <div class="slack-off-container" :class="{ 'mouse-inside': isMouseInside }" :style="containerStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave" @mousedown="onContainerMouseDown">
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
import { parseTxtFile } from '@/lib/txt-parser'
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
const onMouseLeave = () => { isMouseInside.value = false }

const appWindow = getCurrentWindow()

const onContainerMouseDown = () => {
  appWindow.startDragging()
}

const dirMap: Record<string, 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest'> = {
  n: 'North', s: 'South', e: 'East', w: 'West',
  ne: 'NorthEast', nw: 'NorthWest', se: 'SouthEast', sw: 'SouthWest',
}

const startResize = (direction: string) => {
  appWindow.startResizeDragging(dirMap[direction])
}

const loadBooks = async () => {
  books.value = await invoke('list_books')
}

const importBook = async () => {
  const filePath = await invoke<string | null>('select_file')
  if (!filePath) return

  loading.value = true
  loadingText.value = '解析中...'

  try {
    console.log('[import] reading file:', filePath)
    const buffer = await invoke<ArrayBuffer>('read_file_binary', { path: filePath })
    console.log('[import] buffer size:', buffer.byteLength)
    const uint8 = new Uint8Array(buffer)
    const ext = filePath.split('.').pop()?.toLowerCase()
    console.log('[import] ext:', ext)

    const bookId = `book_${Date.now()}`
    let title = ''
    let author = ''
    let language = 'und'
    const chapters: Array<{ chapterId: string; content: string }> = []

    if (ext === 'epub') {
      console.log('[import] parsing epub...')
      const result = await parseEpubFile(uint8.buffer)
      console.log('[import] parsed, title:', result.metadata.title, 'chapters:', result.chapters.length)
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
    } else {
      const filename = filePath.split(/[/\\]/).pop() || 'unknown'
      const result = parseTxtFile(uint8.buffer, filename)
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

    await loadBooks()
  } catch (e: any) {
    console.error('[import] failed:', e?.message || e?.toString?.() || e)
    console.error('[import] stack:', e?.stack)
    loadingText.value = `导入失败: ${e?.message || e}`
  } finally {
    loading.value = false
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
  top: 4px;
  right: 40px;
}

/* 缩放手柄 */
.resize-handle {
  position: absolute;
  z-index: 30;
}

.resize-n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: n-resize; }
.resize-s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: s-resize; }
.resize-e { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: e-resize; }
.resize-w { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: w-resize; }
.resize-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: ne-resize; }
.resize-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nw-resize; }
.resize-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: se-resize; }
.resize-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: sw-resize; }

/* 内容区域 */
.content-area {
  flex: 1;
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 12px 10px 40px;
  pointer-events: none;
  opacity: 0;
  scrollbar-width: none;
}

.content-area::-webkit-scrollbar {
  display: none;
}

.mouse-inside .content-area {
  pointer-events: auto;
  opacity: 1;
}

.content-wrapper {
  max-width: 600px;
  margin: 0 auto;
}

/* 书架样式 */
.library {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.library-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 4px 10px;
}

.library-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.library-count {
  font-size: 12px;
  opacity: 0.5;
}

.empty-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  padding: 60px 20px;
  font-size: 13px;
  letter-spacing: 1px;
}

.book-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.book-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateX(2px);
}

.book-info {
  flex: 1;
  min-width: 0;
}

.book-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  font-size: 12px;
  margin-top: 3px;
}

.btn-delete {
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.book-card:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  color: rgba(255, 100, 100, 0.8);
}

.btn-delete svg {
  width: 14px;
  height: 14px;
}

.loading {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 20px;
  font-size: 14px;
}
</style>
