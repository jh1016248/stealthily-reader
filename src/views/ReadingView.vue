<template>
  <div class="slack-off-container" :class="{ 'mouse-inside': isMouseInside }" @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave" @mousedown="onContainerMouseDown">
    <!-- 关闭按钮 -->
    <div class="btn-trigger btn-close-pos" @mousedown.stop>
      <button class="btn-action btn-close" @click="backToLibrary">x</button>
    </div>

    <!-- 设置按钮 -->
    <div class="btn-trigger btn-settings-pos" @mousedown.stop>
      <button class="btn-action btn-settings" @click="showSettings = !showSettings; showChapterList = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="float-panel settings-panel" @mousedown.stop @click.stop>
      <div class="settings-row">
        <label>字号</label>
        <div class="size-controls">
          <button @click="textSize = Math.max(12, textSize - 1)">-</button>
          <span>{{ textSize }}px</span>
          <button @click="textSize = Math.min(32, textSize + 1)">+</button>
        </div>
      </div>
      <div class="settings-row">
        <label>颜色</label>
        <div class="color-presets">
          <div v-for="c in colorPresets" :key="c" class="color-dot" :style="{ background: c }"
            :class="{ active: textColor === c }" @click="textColor = c"></div>
          <input type="color" :value="textColor" @input="textColor = ($event.target as HTMLInputElement).value"
            class="color-picker" />
        </div>
      </div>
    </div>

    <!-- 章节选择图标 -->
    <div class="btn-trigger btn-chapter-pos" @mousedown.stop>
      <button class="btn-action btn-chapter" @click="showChapterList = !showChapterList; showSettings = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </button>
    </div>

    <!-- 章节列表 -->
    <div v-if="showChapterList" class="float-panel chapter-dropdown" @mousedown.stop @click.stop>
      <div class="chapter-back" @click="backToLibrary">返回书架</div>
      <div v-for="ch in chapters" :key="ch" class="chapter-item" :class="{ active: ch === currentChapterId }"
        @click="selectChapter(ch)">
        {{ ch.replace(/^\d+_/, '') }}
      </div>
    </div>

    <!-- 缩放手柄 -->
    <div class="resize-handle resize-n" @mousedown.stop.prevent="startResize('n', $event)"></div>
    <div class="resize-handle resize-s" @mousedown.stop.prevent="startResize('s', $event)"></div>
    <div class="resize-handle resize-e" @mousedown.stop.prevent="startResize('e', $event)"></div>
    <div class="resize-handle resize-w" @mousedown.stop.prevent="startResize('w', $event)"></div>
    <div class="resize-handle resize-ne" @mousedown.stop.prevent="startResize('ne', $event)"></div>
    <div class="resize-handle resize-nw" @mousedown.stop.prevent="startResize('nw', $event)"></div>
    <div class="resize-handle resize-se" @mousedown.stop.prevent="startResize('se', $event)"></div>
    <div class="resize-handle resize-sw" @mousedown.stop.prevent="startResize('sw', $event)"></div>

    <!-- 内容区域 -->
    <div class="content-area" ref="contentRef" @scroll="onScroll">
      <div class="content-wrapper">
        <div v-if="loading" class="loading">加载中...</div>
        <template v-else>
          <div v-for="(block, index) in contentBlocks" :key="index" class="text-block"
            :style="{ color: textColor, fontSize: textSize + 'px' }">
            {{ block }}
          </div>
          <div v-if="loadingNext" class="loading-next">加载下一章...</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi'

const route = useRoute()
const router = useRouter()
const appWindow = getCurrentWindow()
const bookId = computed(() => route.params.bookId as string)

const contentRef = ref<HTMLElement | null>(null)
const isMouseInside = ref(false)
const showSettings = ref(false)
const showChapterList = ref(false)
const loading = ref(false)
const loadingNext = ref(false)
const chapters = ref<string[]>([])
const currentChapterId = ref('')
const contentBlocks = ref<string[]>([])
const textSize = ref(16)
const textColor = ref('#e0e0e0')

const colorPresets = ['#e0e0e0', '#ffffff', '#a0d8ef', '#c8e6c9', '#ffccbc', '#e1bee7']

const onMouseEnter = () => { isMouseInside.value = true }
const onMouseLeave = () => {
  isMouseInside.value = false
  showChapterList.value = false
}

// 拖拽移动窗口
let dragLastX = 0
let dragLastY = 0

const onContainerMouseDown = (e: MouseEvent) => {
  dragLastX = e.screenX
  dragLastY = e.screenY

  const onMouseMove = (ev: MouseEvent) => {
    appWindow.setPosition(new LogicalPosition(ev.screenX - 100, ev.screenY - 10))
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 缩放窗口
let resizeDir = ''
let resizeLastX = 0
let resizeLastY = 0

const startResize = (direction: string, e: MouseEvent) => {
  resizeDir = direction
  resizeLastX = e.screenX
  resizeLastY = e.screenY

  const onMouseMove = async (ev: MouseEvent) => {
    const dx = ev.screenX - resizeLastX
    const dy = ev.screenY - resizeLastY
    resizeLastX = ev.screenX
    resizeLastY = ev.screenY

    const bounds = await appWindow.outerSize()
    const pos = await appWindow.outerPosition()
    const w = bounds.width
    const h = bounds.height

    switch (direction) {
      case 'n':
        appWindow.setSize(new LogicalSize(w, h - dy))
        appWindow.setPosition(new LogicalPosition(pos.x, pos.y + dy))
        break
      case 's':
        appWindow.setSize(new LogicalSize(w, h + dy))
        break
      case 'e':
        appWindow.setSize(new LogicalSize(w + dx, h))
        break
      case 'w':
        appWindow.setSize(new LogicalSize(w - dx, h))
        appWindow.setPosition(new LogicalPosition(pos.x + dx, pos.y))
        break
      case 'ne':
        appWindow.setSize(new LogicalSize(w + dx, h - dy))
        appWindow.setPosition(new LogicalPosition(pos.x, pos.y + dy))
        break
      case 'nw':
        appWindow.setSize(new LogicalSize(w - dx, h - dy))
        appWindow.setPosition(new LogicalPosition(pos.x + dx, pos.y + dy))
        break
      case 'se':
        appWindow.setSize(new LogicalSize(w + dx, h + dy))
        break
      case 'sw':
        appWindow.setSize(new LogicalSize(w - dx, h + dy))
        appWindow.setPosition(new LogicalPosition(pos.x + dx, pos.y))
        break
    }
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 保存/加载进度
const saveProgress = async () => {
  try {
    const progress = await invoke<Record<string, string>>('load_progress')
    progress[bookId.value] = currentChapterId.value
    await invoke('save_progress', { progress: { entries: progress } })
  } catch {}
}

const loadProgress = async (): Promise<string | null> => {
  try {
    const progress = await invoke<{ entries: Record<string, string> }>('load_progress')
    return progress.entries[bookId.value] || null
  } catch {
    return null
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    const bounds = await appWindow.outerPosition()
    const size = await appWindow.outerSize()
    const current = await invoke<any>('load_settings')
    await invoke('save_settings', {
      settings: {
        font_size: textSize.value,
        text_color: textColor.value,
        window_bounds: {
          x: bounds.x,
          y: bounds.y,
          width: size.width,
          height: size.height,
        },
      },
    })
  } catch {}
}

const loadSettings = async () => {
  try {
    const settings = await invoke<any>('load_settings')
    if (settings?.font_size) textSize.value = settings.font_size
    if (settings?.text_color) textColor.value = settings.text_color
    if (settings?.window_bounds) {
      const b = settings.window_bounds
      appWindow.setPosition(new LogicalPosition(b.x, b.y))
      appWindow.setSize(new LogicalSize(b.width, b.height))
    }
  } catch {}
}

const loadChapters = async () => {
  chapters.value = await invoke('list_chapters', { bookId: bookId.value })
}

const loadChapterContent = async (chapterId: string) => {
  loading.value = true
  const content = await invoke<string>('read_chapter', { bookId: bookId.value, chapterId })
  contentBlocks.value = content.split('\n').filter(line => line.trim())
  currentChapterId.value = chapterId
  loading.value = false
  if (contentRef.value) {
    contentRef.value.scrollTop = 0
  }
  saveProgress()
}

const selectChapter = (chapterId: string) => {
  showChapterList.value = false
  loadChapterContent(chapterId)
}

const onScroll = () => {
  if (!contentRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = contentRef.value
  if (scrollHeight - scrollTop - clientHeight < 50 && !loadingNext.value) {
    loadNextChapter()
  }
}

const loadNextChapter = async () => {
  const idx = chapters.value.findIndex(c => c === currentChapterId.value)
  if (idx < 0 || idx >= chapters.value.length - 1) return

  loadingNext.value = true
  const nextChapterId = chapters.value[idx + 1]
  if (!nextChapterId) { loadingNext.value = false; return }
  const content = await invoke<string>('read_chapter', { bookId: bookId.value, chapterId: nextChapterId })
  const blocks = content.split('\n').filter(line => line.trim())
  contentBlocks.value.push(...blocks)
  currentChapterId.value = nextChapterId
  saveProgress()
  loadingNext.value = false
}

const backToLibrary = () => {
  router.push('/')
}

// Auto-save settings on change
watch([textSize, textColor], saveSettings)

// Save bounds on window events
const onBoundsChanged = () => { saveSettings() }
let unlistenFns: Array<() => void> = []

onMounted(async () => {
  await loadSettings()
  await loadChapters()
  const savedChapter = await loadProgress()
  const startChapter = savedChapter && chapters.value.includes(savedChapter)
    ? savedChapter
    : chapters.value[0]
  if (startChapter) {
    await loadChapterContent(startChapter)
  }
  unlistenFns.push(await appWindow.onMoved(onBoundsChanged))
  unlistenFns.push(await appWindow.onResized(onBoundsChanged))
})

onUnmounted(() => {
  unlistenFns.forEach(fn => fn())
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
  background: rgba(150, 150, 150, 0.2);
  opacity: 0;
  transition: opacity 0.15s;
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

.btn-trigger:hover .btn-action {
  opacity: 1;
  pointer-events: auto;
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

.btn-settings-pos {
  top: 4px;
  right: 40px;
}

.btn-chapter-pos {
  bottom: 8px;
  right: 8px;
}

/* 浮动面板 */
.float-panel {
  z-index: 25;
  background: rgba(25, 25, 25, 0.95);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.settings-panel {
  position: absolute;
  top: 32px;
  right: 8px;
  padding: 12px 16px;
  min-width: 200px;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-row + .settings-row {
  margin-top: 10px;
}

.settings-row label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  flex-shrink: 0;
}

.size-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.size-controls button {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: none;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.size-controls button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.size-controls span {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  min-width: 36px;
  text-align: center;
}

.color-presets {
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
}

.color-dot.active {
  border-color: #fff;
}

.color-dot:hover {
  border-color: rgba(255, 255, 255, 0.5);
}

.color-picker {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  background: none;
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-picker::-webkit-color-swatch {
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

/* 章节列表 */
.chapter-dropdown {
  position: absolute;
  bottom: 36px;
  right: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 6px 0;
  min-width: 200px;
  max-width: 320px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.chapter-dropdown::-webkit-scrollbar {
  width: 4px;
}

.chapter-dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.chapter-back {
  padding: 7px 14px;
  color: rgba(255, 150, 150, 0.7);
  font-size: 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.chapter-back:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chapter-item {
  padding: 7px 14px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chapter-item.active {
  color: #fff;
  background: rgba(255, 255, 255, 0.15);
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 40px 32px 50px;
  pointer-events: none;
  opacity: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.mouse-inside .content-area {
  pointer-events: auto;
  opacity: 1;
}

.content-area::-webkit-scrollbar {
  width: 4px;
}

.content-area::-webkit-scrollbar-track {
  background: transparent;
}

.content-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.content-wrapper {
  max-width: 600px;
  margin: 0 auto;
}

.text-block {
  line-height: 1.9;
  text-indent: 2em;
  word-break: break-all;
  margin-bottom: 4px;
}

.loading,
.loading-next {
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  padding: 20px;
  font-size: 14px;
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
</style>
