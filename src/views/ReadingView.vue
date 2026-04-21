<template>
  <div class="slack-off-container" :class="{ 'mouse-inside': hideOnLeave ? isMouseInside : true }" :style="containerStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave" @mousedown="onContainerMouseDown" @click="onClickOutside">
    <!-- 关闭按钮 -->
    <div class="btn-trigger btn-close-pos" @mousedown.stop @click.stop>
      <button class="btn-action btn-close" @click="backToLibrary">x</button>
    </div>

    <!-- 设置按钮 -->
    <div class="btn-trigger btn-settings-pos" @mousedown.stop @click.stop>
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
      <div class="settings-row">
        <label>背景</label>
        <div class="color-presets">
          <div v-for="c in bgPresets" :key="c" class="color-dot" :style="{ background: c }"
            :class="{ active: bgColor === c }" @click="bgColor = c"></div>
          <input type="color" :value="bgColor" @input="bgColor = ($event.target as HTMLInputElement).value"
            class="color-picker" />
        </div>
      </div>
      <div class="settings-row">
        <label>透明度</label>
        <input type="range" min="0" max="100" step="1" v-model.number="bgOpacity" class="opacity-slider" />
      </div>
      <div class="settings-row">
        <label>移出隐藏</label>
        <div class="toggle-switch" :class="{ active: hideOnLeave }" @click="hideOnLeave = !hideOnLeave">
          <div class="toggle-knob"></div>
        </div>
      </div>
    </div>

    <!-- 章节选择图标 -->
    <div class="btn-trigger btn-chapter-pos" @mousedown.stop @click.stop>
      <button class="btn-action btn-chapter" @click="showChapterList = !showChapterList; showSettings = false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </button>
    </div>

    <!-- 章节列表 -->
    <div v-if="showChapterList" ref="chapterListRef" class="float-panel chapter-dropdown" @mousedown.stop @click.stop>
      <div class="chapter-back" @click="backToLibrary">返回书架</div>
      <div v-for="ch in chapters" :key="ch" class="chapter-item" :class="{ active: ch === currentChapterId }"
        @click="selectChapter(ch)">
        {{ ch.replace(/^\d+_/, '') }}
      </div>
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
    <div class="content-area" ref="contentRef" @scroll="onScroll">
      <div class="content-wrapper">
        <div v-if="loading" class="loading">加载中...</div>
        <template v-else>
          <div v-for="chapter in chapterBlocks" :key="chapter.id" :data-chapter="chapter.id">
            <div class="chapter-title">{{ chapter.title }}</div>
            <div v-for="(block, bidx) in chapter.blocks" :key="bidx" class="text-block"
              :style="{ color: textColor, fontSize: textSize + 'px' }">
              {{ block }}
            </div>
          </div>
          <div v-if="loadingNext" class="loading-next">加载下一章...</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'

const route = useRoute()
const router = useRouter()
const appWindow = getCurrentWindow()
const bookId = computed(() => route.params.bookId as string)

const contentRef = ref<HTMLElement | null>(null)
const chapterListRef = ref<HTMLElement | null>(null)
const isMouseInside = ref(false)
const showSettings = ref(false)
const showChapterList = ref(false)
const loading = ref(false)
const loadingNext = ref(false)
const chapters = ref<string[]>([])
const currentChapterId = ref('')
const chapterBlocks = ref<Array<{ id: string; title: string; blocks: string[] }>>([])
const textSize = ref(16)
const textColor = ref('#e0e0e0')
const bgColor = ref('#1a1a1a')
const bgOpacity = ref(85)
const hideOnLeave = ref(true)

const colorPresets = ['#e0e0e0', '#ffffff', '#a0d8ef', '#c8e6c9', '#ffccbc', '#e1bee7']
const bgPresets = ['#ffffff', '#000000', '#1a1a1a', '#2c3e50', '#1e3a2f', '#3b1f1f', '#1f1f3b']

const containerStyle = computed(() => ({
  background: bgColor.value + Math.round(bgOpacity.value * 2.55).toString(16).padStart(2, '0'),
}))

const onMouseEnter = () => {
  isMouseInside.value = true
}
const onMouseLeave = () => {
  if (showSettings.value || showChapterList.value) return
  isMouseInside.value = false
}

const onClickOutside = () => {
  if (showSettings.value) showSettings.value = false
  if (showChapterList.value) showChapterList.value = false
}

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

// 保存/加载进度（scroll 为相对于当前章节 div 顶部的偏移）
const saveProgress = async () => {
  try {
    const chapterEl = contentRef.value?.querySelector(`[data-chapter="${currentChapterId.value}"]`) as HTMLElement | null
    const scroll = chapterEl ? (contentRef.value!.scrollTop - chapterEl.offsetTop) : 0
    const progress = await invoke<{ entries: Record<string, any> }>('load_progress')
    progress.entries[bookId.value] = {
      chapter: currentChapterId.value,
      scroll: Math.max(0, scroll),
    }
    await invoke('save_progress', { progress })
  } catch {}
}

const loadProgress = async () => {
  try {
    const progress = await invoke<{ entries: Record<string, { chapter: string; scroll: number }> }>('load_progress')
    return progress.entries[bookId.value] || null
  } catch {
    return null
  }
}

// 保存设置
const saveSettings = async () => {
  try {
    await invoke('save_settings', {
      settings: {
        font_size: textSize.value,
        text_color: textColor.value,
        bg_color: bgColor.value,
        bg_opacity: bgOpacity.value,
        hide_on_leave: hideOnLeave.value,
      },
    })
  } catch {}
}

const loadSettings = async () => {
  try {
    const settings = await invoke<any>('load_settings')
    if (settings?.font_size) textSize.value = settings.font_size
    if (settings?.text_color) textColor.value = settings.text_color
    if (settings?.bg_color) bgColor.value = settings.bg_color
    if (settings?.bg_opacity !== undefined) bgOpacity.value = settings.bg_opacity
    if (settings?.hide_on_leave !== undefined) hideOnLeave.value = settings.hide_on_leave
  } catch {}
}

const loadChapters = async () => {
  chapters.value = await invoke('list_chapters', { bookId: bookId.value })
}

const loadChapterContent = async (chapterId: string) => {
  loading.value = true
  const content = await invoke<string>('read_chapter', { bookId: bookId.value, chapterId })
  const blocks = content.split('\n').filter(line => line.trim())
  const title = chapterId.replace(/^\d+_/, '')
  chapterBlocks.value = [{ id: chapterId, title, blocks }]
  currentChapterId.value = chapterId
  loading.value = false
  if (contentRef.value) {
    contentRef.value.scrollTop = 0
  }
  saveProgress()
}

const restoreProgress = async () => {
  const saved = await loadProgress()
  if (!saved?.chapter || !chapters.value.includes(saved.chapter)) return
  await loadChapterContent(saved.chapter)
  await nextTick()
  if (contentRef.value) {
    contentRef.value.scrollTop = saved.scroll || 0
  }
}

const selectChapter = (chapterId: string) => {
  showChapterList.value = false
  loadChapterContent(chapterId)
}

let scrollTimer: ReturnType<typeof setTimeout> | null = null

const onScroll = () => {
  if (!contentRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = contentRef.value
  if (scrollHeight - scrollTop - clientHeight < 50 && !loadingNext.value) {
    loadNextChapter()
  }
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => saveProgress(), 300)
}

const loadNextChapter = async () => {
  const idx = chapters.value.findIndex(c => c === currentChapterId.value)
  if (idx < 0 || idx >= chapters.value.length - 1) return

  loadingNext.value = true
  const nextChapterId = chapters.value[idx + 1]
  if (!nextChapterId) { loadingNext.value = false; return }
  const content = await invoke<string>('read_chapter', { bookId: bookId.value, chapterId: nextChapterId })
  const blocks = content.split('\n').filter(line => line.trim())
  const title = nextChapterId.replace(/^\d+_/, '')
  chapterBlocks.value.push({ id: nextChapterId, title, blocks })
  currentChapterId.value = nextChapterId
  saveProgress()
  loadingNext.value = false
  await nextTick()
  const chapterEl = contentRef.value?.querySelector(`[data-chapter="${nextChapterId}"]`) as HTMLElement | null
  if (chapterEl) {
    chapterEl.scrollIntoView({ block: 'start' })
  }
}

const backToLibrary = () => {
  router.push('/')
}

// Auto-save settings on change
watch([textSize, textColor, bgColor, bgOpacity, hideOnLeave], saveSettings)

// 打开章节列表时自动滚到当前章节
watch(showChapterList, (val) => {
  if (val) {
    setTimeout(() => {
      const active = chapterListRef.value?.querySelector('.chapter-item.active')
      active?.scrollIntoView({ block: 'center' })
    }, 50)
  }
})

onMounted(async () => {
  await loadSettings()
  await loadChapters()
  await restoreProgress()

  const unlistenEnter = await listen('cursor-enter', () => onMouseEnter())
  const unlistenLeave = await listen('cursor-leave', () => onMouseLeave())
  onUnmounted(() => { unlistenEnter(); unlistenLeave() })
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
  backdrop-filter: none;
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

.opacity-slider {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
}

.opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
}

.toggle-switch {
  width: 36px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-switch.active {
  background: rgba(255, 255, 255, 0.5);
}

.toggle-knob {
  width: 16px;
  height: 16px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s;
}

.toggle-switch.active .toggle-knob {
  left: 18px;
}

/* 章节列表 */
.chapter-dropdown {
  position: absolute;
  bottom: 36px;
  right: 8px;
  max-height: 300px;
  overflow-y: scroll;
  padding: 6px 0;
  scrollbar-width: none;
}

.chapter-dropdown::-webkit-scrollbar {
  display: none;
}

.chapter-dropdown {
  min-width: 200px;
  max-width: 320px;
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
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 40px 32px 50px;
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

.chapter-title {
  color: rgba(255, 255, 0.5);
  font-size: 14px;
  padding: 12px 0 6px;
  text-indent: 0;
  user-select: none;
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
