<template>
  <div
    class="slack-off-container"
    :class="{ 'mouse-inside': hideOnLeave ? isMouseInside : true }"
    :style="containerStyle"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @mousedown="onContainerMouseDown($event)"
    @click="onClickOutside"
  >
    <!-- 关闭按钮 -->
    <div class="btn-trigger btn-close-pos" @mousedown.stop @click.stop>
      <button class="btn-action btn-close" @click="backToLibrary">x</button>
    </div>

    <!-- 设置按钮 -->
    <div class="btn-trigger btn-settings-pos" @mousedown.stop @click.stop>
      <button
        class="btn-action btn-settings"
        @click="
          showSettings = !showSettings;
          showChapterList = false;
        "
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          />
        </svg>
      </button>
    </div>

    <!-- 设置面板 -->
    <div
      v-if="showSettings"
      class="float-panel settings-panel"
      @mousedown.stop
      @click.stop
    >
      <div class="settings-row">
        <label>字号</label>
        <div class="size-controls">
          <button @click="textSize = Math.max(8, textSize - 1)">-</button>
          <span>{{ textSize }}px</span>
          <button @click="textSize = Math.min(32, textSize + 1)">+</button>
        </div>
      </div>
      <div class="settings-row">
        <label>颜色</label>
        <div class="color-presets">
          <div
            v-for="c in colorPresets"
            :key="c"
            class="color-dot"
            :style="{ background: c }"
            :class="{ active: textColor === c }"
            @click="textColor = c"
          ></div>
          <input
            type="color"
            :value="textColor"
            @input="textColor = ($event.target as HTMLInputElement).value"
            class="color-picker"
          />
        </div>
      </div>
      <div class="settings-row">
        <label>背景</label>
        <div class="color-presets">
          <div
            v-for="c in bgPresets"
            :key="c"
            class="color-dot"
            :style="{ background: c }"
            :class="{ active: bgColor === c }"
            @click="bgColor = c"
          ></div>
          <input
            type="color"
            :value="bgColor"
            @input="bgColor = ($event.target as HTMLInputElement).value"
            class="color-picker"
          />
        </div>
      </div>
      <div class="settings-row">
        <label>透明度</label>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          v-model.number="bgOpacity"
          class="opacity-slider"
        />
      </div>
      <div class="settings-row">
        <label>移出隐藏</label>
        <div
          class="toggle-switch"
          :class="{ active: hideOnLeave }"
          @click="hideOnLeave = !hideOnLeave"
        >
          <div class="toggle-knob"></div>
        </div>
      </div>

      <!-- TTS 分隔线 -->
      <div class="settings-divider"></div>

      <!-- TTS 播控 -->
      <div class="settings-row tts-controls">
        <label>朗读</label>
        <div class="tts-buttons">
          <button
            class="tts-btn"
            :class="{ active: ttsState !== 'idle' }"
            @click="toggleTts"
            :title="ttsState === 'playing' ? '暂停' : ttsState === 'paused' ? '继续' : '播放'"
          >
            <svg v-if="ttsState === 'playing'" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          </button>
          <button
            class="tts-btn"
            :disabled="ttsState === 'idle'"
            @click="stopTts"
            title="停止"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
          </button>
        </div>
      </div>
      <div class="settings-row">
        <label>引擎</label>
        <select class="tts-voice-select" v-model="ttsEngine">
          <option value="edge">Edge 在线（推荐）</option>
          <option value="system">系统语音</option>
        </select>
      </div>
      <div v-if="ttsEngine === 'edge'" class="settings-row">
        <label>音色</label>
        <select class="tts-voice-select" v-model="ttsEdgeVoice">
          <option v-for="v in edgeVoices" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
      </div>
      <div v-else-if="ttsVoices.length > 0" class="settings-row">
        <label>语音</label>
        <select class="tts-voice-select" v-model="ttsVoice">
          <option v-for="v in ttsVoices" :key="v.id" :value="v.id">{{ v.name }}</option>
        </select>
      </div>
      <div class="settings-row">
        <label>语速</label>
        <div class="tts-rate-row">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            v-model.number="ttsRate"
            class="opacity-slider"
          />
          <span class="tts-rate-label">{{ ttsRate.toFixed(1) }}x</span>
        </div>
      </div>
    </div>

    <!-- 章节选择图标 -->
    <div class="btn-trigger btn-chapter-pos" @mousedown.stop @click.stop>
      <button
        class="btn-action btn-chapter"
        @click="
          showChapterList = !showChapterList;
          showSettings = false;
        "
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path
            d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
          />
        </svg>
      </button>
    </div>

    <!-- TTS 播放/暂停浮动按钮 -->
    <div v-if="ttsState !== 'idle'" class="btn-trigger btn-tts-pos" @mousedown.stop @click.stop>
      <button class="btn-action btn-tts-float" @click="toggleTts" :title="ttsState === 'playing' ? '暂停' : '继续'">
        <svg v-if="ttsState === 'playing'" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
    </div>

    <!-- 章节列表 -->
    <div
      v-if="showChapterList"
      ref="chapterListRef"
      class="float-panel chapter-dropdown"
      :style="{ fontSize: textSize + 'px' }"
      @mousedown.stop
      @click.stop
    >
      <div class="chapter-back" @click="backToLibrary" @mousedown.stop>
        返回书架
      </div>
      <template v-if="nestedChapters.length > 0">
        <template v-for="entry in chapterListEntries" :key="entry.path">
          <div
            v-if="entry.hasChildren"
            class="chapter-group"
            :style="{ paddingLeft: 14 + entry.depth * 16 + 'px' }"
            @click="toggleChapterGroup(entry.path)"
            @mousedown.stop
          >
            <span class="chapter-group-icon">{{
              expandedChapterGroups.has(entry.path) ? "▼" : "▶"
            }}</span>
            <span class="chapter-group-label">{{ entry.item.label }}</span>
          </div>
          <div
            v-else-if="entry.item.href"
            class="chapter-item"
            :class="{ active: isCurrentChapter(entry.item.href) }"
            :style="{ paddingLeft: 14 + entry.depth * 16 + 'px' }"
            @click="selectChapterByHref(entry.item.href)"
            @mousedown.stop
          >
            {{ entry.item.label }}
          </div>
        </template>
      </template>
      <template v-else>
        <div
          v-for="ch in chapters"
          :key="ch"
          class="chapter-item"
          :class="{ active: ch === currentChapterId }"
          @click="selectChapter(ch)"
          @mousedown.stop
        >
          {{ ch.replace(/^\d+_/, "") }}
        </div>
      </template>
    </div>

    <!-- 缩放手柄 -->
    <div
      class="resize-handle resize-n"
      @mousedown.stop.prevent="startResize('n')"
    ></div>
    <div
      class="resize-handle resize-s"
      @mousedown.stop.prevent="startResize('s')"
    ></div>
    <div
      class="resize-handle resize-e"
      @mousedown.stop.prevent="startResize('e')"
    ></div>
    <div
      class="resize-handle resize-w"
      @mousedown.stop.prevent="startResize('w')"
    ></div>
    <div
      class="resize-handle resize-ne"
      @mousedown.stop.prevent="startResize('ne')"
    ></div>
    <div
      class="resize-handle resize-nw"
      @mousedown.stop.prevent="startResize('nw')"
    ></div>
    <div
      class="resize-handle resize-se"
      @mousedown.stop.prevent="startResize('se')"
    ></div>
    <div
      class="resize-handle resize-sw"
      @mousedown.stop.prevent="startResize('sw')"
    ></div>

    <!-- 内容区域 -->
    <div class="content-area" ref="contentRef" @scroll="onScroll">
      <div class="content-wrapper">
        <div v-if="loading" class="loading">加载中...</div>
        <template v-else>
          <div v-if="loadingPrev" class="loading-prev">加载上一章...</div>
          <div
            v-for="chapter in chapterBlocks"
            :key="chapter.id"
            :data-chapter="chapter.id"
          >
            <div
              class="chapter-title"
              :style="{ color: textColor, fontSize: textSize + 2 + 'px' }"
            >
              {{ chapter.title }}
            </div>
            <div
              v-for="(block, bidx) in chapter.blocks"
              :key="bidx"
              class="text-block"
              :class="{ 'tts-active': isTtsBlock(chapter.id, bidx) }"
              :style="{ color: textColor, fontSize: textSize + 'px' }"
              @dblclick.stop="startTtsFromBlock(chapter.id, bidx)"
            >
              {{ block }}
            </div>
            <!-- 章节间大段空白：窗口推进（销毁上一章）发生在用户滚动经过空白区时，
                 DOM 变动对视口的影响落在空白里，阅读位置不会发生可见跳变 -->
            <div class="chapter-gap" aria-hidden="true"></div>
          </div>
          <div v-if="loadingNext" class="loading-next">加载下一章...</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { speak, stop as ttsStop, getVoices, onSpeechEvent } from "tauri-plugin-tts-api";
import type { Voice } from "tauri-plugin-tts-api";
import {
  getChapterWindow,
  getExpandedTocAncestorPaths,
  adjustScrollTopAfterTrim,
  hasScrolledAPageIntoNextChapter,
} from "../lib/reading-state";

const route = useRoute();
const router = useRouter();
const appWindow = getCurrentWindow();
const bookId = computed(() => route.params.bookId as string);

const contentRef = ref<HTMLElement | null>(null);
const chapterListRef = ref<HTMLElement | null>(null);
const isMouseInside = ref(false);
const isDragging = ref(false);
const showSettings = ref(false);
const showChapterList = ref(false);
const loading = ref(false);
const loadingNext = ref(false);
const loadingPrev = ref(false);
const chapters = ref<string[]>([]);
const currentChapterId = ref("");
interface ChapterTocItem {
  label: string;
  href?: string;
  subitems?: ChapterTocItem[];
}

interface ChapterListEntry {
  item: ChapterTocItem;
  path: string;
  depth: number;
  hasChildren: boolean;
}

const nestedChapters = ref<ChapterTocItem[]>([]);
const expandedChapterGroups = ref<Set<string>>(new Set());
const hrefToIndex = ref<Record<string, number>>({});
const chapterListEntries = computed<ChapterListEntry[]>(() => {
  const entries: ChapterListEntry[] = [];

  const appendEntries = (
    items: ChapterTocItem[],
    parentPath: string,
    depth: number,
  ) => {
    for (const [index, item] of items.entries()) {
      const path = parentPath ? `${parentPath}.${index}` : String(index);
      const hasChildren = Boolean(item.subitems?.length);
      entries.push({ item, path, depth, hasChildren });
      if (hasChildren && expandedChapterGroups.value.has(path)) {
        appendEntries(item.subitems!, path, depth + 1);
      }
    }
  };

  appendEntries(nestedChapters.value, "", 0);
  return entries;
});
const chapterBlocks = ref<
  Array<{ id: string; title: string; blocks: string[] }>
>([]);
const textSize = ref(16);
const textColor = ref("#e0e0e0");
const bgColor = ref("#1a1a1a");
const bgOpacity = ref(20);
const hideOnLeave = ref(true);

// TTS 状态
const ttsVoices = ref<Voice[]>([]);
const ttsVoice = ref("");
const ttsRate = ref(1.0);
const ttsEngine = ref<"edge" | "system">("edge");
const ttsEdgeVoice = ref("zh-CN-XiaoxiaoNeural");
const edgeVoices = ref<Array<{ id: string; name: string }>>([]);
const ttsState = ref<"idle" | "playing" | "paused">("idle");
const ttsChapterId = ref("");
const ttsBlockIndex = ref(0);

let ttsUnlisten: (() => void) | null = null;

const colorPresets = [
  "#ffffff",
  "#e0e0e0",
  "#a0a0a0",
  "#666666",
  "#333333",
  "#000000",
];
const bgPresets = [
  "#ffffff",
  "#000000",
  "#1a1a1a",
  "#2c3e50",
  "#1e3a2f",
  "#3b1f1f",
  "#1f1f3b",
];

const containerStyle = computed(() => ({
  background:
    bgColor.value +
    Math.round(bgOpacity.value * 2.55)
      .toString(16)
      .padStart(2, "0"),
}));

const onMouseEnter = () => {
  isMouseInside.value = true;
};
const onMouseLeave = () => {
  if (isDragging.value || showSettings.value || showChapterList.value) return;
  isMouseInside.value = false;
};

const onClickOutside = () => {
  if (showSettings.value) showSettings.value = false;
  if (showChapterList.value) showChapterList.value = false;
};

const onContainerMouseDown = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (
    target.closest(
      ".btn-trigger, .resize-handle, .float-panel, button, input, select",
    )
  )
    return;
  isDragging.value = true;
  appWindow.startDragging();
  setTimeout(() => {
    isDragging.value = false;
  }, 500);
};

const dirMap: Record<
  string,
  | "North"
  | "South"
  | "East"
  | "West"
  | "NorthEast"
  | "NorthWest"
  | "SouthEast"
  | "SouthWest"
> = {
  n: "North",
  s: "South",
  e: "East",
  w: "West",
  ne: "NorthEast",
  nw: "NorthWest",
  se: "SouthEast",
  sw: "SouthWest",
};

const startResize = (direction: string) => {
  appWindow.startResizeDragging(dirMap[direction]);
};

// 保存/加载进度（scroll 为相对于当前章节 div 顶部的偏移）
const saveProgress = async () => {
  try {
    const readingChapterId = deriveCurrentChapterId();
    const chapterEl = contentRef.value?.querySelector(
      `[data-chapter="${readingChapterId}"]`,
    ) as HTMLElement | null;
    const scroll = chapterEl
      ? contentRef.value!.scrollTop - chapterEl.offsetTop
      : 0;
    const progress = await invoke<{ entries: Record<string, any> }>(
      "load_progress",
    );
    progress.entries[bookId.value] = {
      chapter: readingChapterId,
      scroll: Math.max(0, scroll),
    };
    await invoke("save_progress", { progress });
  } catch {}
};

const loadProgress = async () => {
  try {
    const progress = await invoke<{
      entries: Record<string, { chapter: string; scroll: number }>;
    }>("load_progress");
    return progress.entries[bookId.value] || null;
  } catch {
    return null;
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    await invoke("save_settings", {
      settings: {
        font_size: textSize.value,
        text_color: textColor.value,
        bg_color: bgColor.value,
        bg_opacity: bgOpacity.value,
        hide_on_leave: hideOnLeave.value,
        tts_voice: ttsVoice.value || null,
        tts_rate: ttsRate.value,
        tts_engine: ttsEngine.value,
        tts_edge_voice: ttsEdgeVoice.value,
      },
    });
  } catch {}
};

const loadSettings = async () => {
  try {
    const settings = await invoke<any>("load_settings");
    if (settings?.font_size) textSize.value = settings.font_size;
    if (settings?.text_color) textColor.value = settings.text_color;
    if (settings?.bg_color) bgColor.value = settings.bg_color;
    if (settings?.bg_opacity !== undefined)
      bgOpacity.value = settings.bg_opacity;
    if (settings?.hide_on_leave !== undefined)
      hideOnLeave.value = settings.hide_on_leave;
    if (settings?.tts_voice) ttsVoice.value = settings.tts_voice;
    if (settings?.tts_rate) ttsRate.value = settings.tts_rate;
    if (settings?.tts_engine === "system" || settings?.tts_engine === "edge")
      ttsEngine.value = settings.tts_engine;
    if (settings?.tts_edge_voice) ttsEdgeVoice.value = settings.tts_edge_voice;
  } catch {}
};

const setFlatChapterToc = () => {
  nestedChapters.value = chapters.value.map((chapter) => ({
    label: chapter.replace(/^\d+_/, ""),
    href: chapter,
  }));
  hrefToIndex.value = Object.fromEntries(
    chapters.value.map((chapter, index) => [chapter, index]),
  );
};

const loadChapters = async () => {
  chapters.value = await invoke("list_chapters", { bookId: bookId.value });
  try {
    const toc = await invoke<string | null>("load_toc", {
      bookId: bookId.value,
    });
    if (toc) {
      const tocData = JSON.parse(toc);
      nestedChapters.value = tocData.nested || [];
      hrefToIndex.value = tocData.hrefToIndex || {};
    } else {
      setFlatChapterToc();
    }
  } catch {
    setFlatChapterToc();
  }
};

const toggleChapterGroup = (path: string) => {
  const expanded = new Set(expandedChapterGroups.value);
  if (expanded.has(path)) {
    expanded.delete(path);
  } else {
    expanded.add(path);
  }
  expandedChapterGroups.value = expanded;
};

const expandCurrentChapterAncestors = (chapterId: string) => {
  const targetHref =
    Object.entries(hrefToIndex.value).find(
      ([, chapterIndex]) => chapters.value[chapterIndex] === chapterId,
    )?.[0] || chapterId;
  const ancestorPaths = getExpandedTocAncestorPaths(
    nestedChapters.value,
    targetHref,
  );

  if (ancestorPaths.length > 0) {
    expandedChapterGroups.value = new Set([
      ...expandedChapterGroups.value,
      ...ancestorPaths,
    ]);
  }
};

const selectChapterByHref = (href: string) => {
  // Find the chapter by href using the index mapping
  const hrefBase = href.split("#")[0];
  const chapterIndex = hrefToIndex.value[hrefBase];
  if (chapterIndex !== undefined && chapterIndex < chapters.value.length) {
    selectChapter(chapters.value[chapterIndex]);
  }
};

const isCurrentChapter = (href: string): boolean => {
  const hrefBase = href.split("#")[0];
  const chapterIndex = hrefToIndex.value[hrefBase];
  if (chapterIndex !== undefined && chapterIndex < chapters.value.length) {
    return chapters.value[chapterIndex] === currentChapterId.value;
  }
  return false;
};

const fetchChapterData = async (chapterId: string) => {
  const content = await invoke<string>("read_chapter", {
    bookId: bookId.value,
    chapterId,
  });
  const blocks = content.split("\n").filter((line) => line.trim());
  const title = chapterId.replace(/^\d+_/, "");
  return { id: chapterId, title, blocks };
};

const deriveCurrentChapterId = (): string => {
  if (!contentRef.value) return currentChapterId.value;
  const scrollTop = contentRef.value.scrollTop;
  let detectedId = chapterBlocks.value[0]?.id || "";
  for (const chapter of chapterBlocks.value) {
    const el = contentRef.value.querySelector(
      `[data-chapter="${chapter.id}"]`,
    ) as HTMLElement | null;
    if (el && el.offsetTop <= scrollTop) detectedId = chapter.id;
  }
  return detectedId;
};

const getWindowChapterIds = (centerChapterId: string): string[] =>
  getChapterWindow(chapters.value, centerChapterId);

const loadChapterWindow = async (centerChapterId: string) => {
  loading.value = true;
  const windowIds = getWindowChapterIds(centerChapterId);
  const results = await Promise.all(
    windowIds.map((id) => fetchChapterData(id)),
  );
  chapterBlocks.value = results;
  currentChapterId.value = centerChapterId;
  loading.value = false;
  saveProgress();
};

// 两章窗口（当前章 + 下一章）下不再需要按窗口大小 trim；
// 上一章的销毁时机由 advanceChapterWindow 按滚动位置决定。

const restoreProgress = async () => {
  const saved = await loadProgress();
  if (!saved?.chapter || !chapters.value.includes(saved.chapter)) {
    // 新书或无进度，自动加载第一章
    if (chapters.value.length > 0) {
      await loadChapterWindow(chapters.value[0]);
    }
    return;
  }
  await loadChapterWindow(saved.chapter);
  await nextTick();
  if (contentRef.value) {
    const chapterEl = contentRef.value.querySelector(
      `[data-chapter="${saved.chapter}"]`,
    ) as HTMLElement | null;
    if (chapterEl) {
      contentRef.value.scrollTop = chapterEl.offsetTop + (saved.scroll || 0);
      lastScrollTop = contentRef.value.scrollTop;
      suppressAutoLoadUntil = Date.now() + 500;
    }
  }
};

const selectChapter = async (chapterId: string) => {
  showChapterList.value = false;
  await loadChapterWindow(chapterId);
  await nextTick();
  if (contentRef.value) {
    const chapterEl = contentRef.value.querySelector(
      `[data-chapter="${chapterId}"]`,
    ) as HTMLElement | null;
    if (chapterEl) {
      contentRef.value.scrollTop = chapterEl.offsetTop;
      lastScrollTop = contentRef.value.scrollTop;
      suppressAutoLoadUntil = Date.now() + 500;
    }
  }
};

let scrollTimer: ReturnType<typeof setTimeout> | null = null;
let lastScrollTop = 0;
// 程序化调整 scrollTop 后的冷却期：防止补偿结果落在顶部 50px 内
// 触发"加载上一章"，把刚销毁的章节又加回来造成来回跳动
let suppressAutoLoadUntil = 0;

const onScroll = () => {
  if (!contentRef.value || loading.value) return;
  const { scrollTop, clientHeight } = contentRef.value;

  currentChapterId.value = deriveCurrentChapterId();

  const isUserScrollingUp = scrollTop < lastScrollTop - 2;
  if (
    scrollTop < 50 &&
    isUserScrollingUp &&
    !loadingPrev.value &&
    Date.now() > suppressAutoLoadUntil
  ) {
    loadPreviousChapter();
  }
  if (!loadingNext.value && Date.now() > suppressAutoLoadUntil) {
    advanceChapterWindow();
  }
  lastScrollTop = scrollTop;

  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => saveProgress(), 300);
};

/**
 * 窗口推进：滚入下一章超过一页后，销毁上一章（当前章升为第一章），
 * 再把新的下一章追加进来，保持窗口始终为 [当前章, 下一章]。
 * 由于推进条件保证了 scrollTop 远大于被移除章节的高度，
 * 滚动补偿后视口一定还停留在原阅读位置。
 */
const advanceChapterWindow = async () => {
  const container = contentRef.value;
  if (!container || chapterBlocks.value.length < 2) return;

  const firstId = chapterBlocks.value[0].id;
  const firstEl = container.querySelector(
    `[data-chapter="${firstId}"]`,
  ) as HTMLElement | null;
  if (!firstEl) return;

  // 未滚入下一章超过一页且未触底，不推进
  if (
    !hasScrolledAPageIntoNextChapter(
      container.scrollTop,
      container.clientHeight,
      firstEl.offsetHeight,
      container.scrollHeight,
    )
  )
    return;

  const firstIdx = chapters.value.indexOf(firstId);
  if (firstIdx < 0) return;

  loadingNext.value = true;
  const removedHeight = firstEl.offsetHeight;
  const scrollTopBefore = container.scrollTop;

  // 1. 销毁上一章，并在重渲染后补偿滚动位置
  chapterBlocks.value.shift();
  await nextTick();
  container.scrollTop = adjustScrollTopAfterTrim(scrollTopBefore, removedHeight);
  suppressAutoLoadUntil = Date.now() + 500;
  lastScrollTop = container.scrollTop;

  // 2. 追加新的下一章（firstIdx 是刚销毁的章节，当前章为 firstIdx+1，
  //    因此要追加的是 firstIdx+2，否则会把当前章重复显示一遍）
  const upcomingIdx = firstIdx + 2;
  if (upcomingIdx < chapters.value.length) {
    const upcomingId = chapters.value[upcomingIdx];
    const data = await fetchChapterData(upcomingId);
    if (data) chapterBlocks.value.push(data);
  }

  saveProgress();
  loadingNext.value = false;
};

const loadPreviousChapter = async () => {
  const firstBlock = chapterBlocks.value[0];
  if (!firstBlock) return;
  const firstIdx = chapters.value.findIndex((c) => c === firstBlock.id);
  if (firstIdx <= 0) return;
  if (loadingPrev.value) return;

  loadingPrev.value = true;
  const prevChapterId = chapters.value[firstIdx - 1];
  const scrollTopBefore = contentRef.value?.scrollTop || 0;

  const data = await fetchChapterData(prevChapterId);
  if (data) chapterBlocks.value.unshift(data);
  await nextTick();

  const newEl = contentRef.value?.querySelector(
    `[data-chapter="${prevChapterId}"]`,
  ) as HTMLElement | null;
  if (newEl && contentRef.value) {
    contentRef.value.scrollTop = scrollTopBefore + newEl.offsetHeight;
  }
  suppressAutoLoadUntil = Date.now() + 500;
  lastScrollTop = contentRef.value?.scrollTop || 0;

  // 窗口回到两章：移除底部的下一章
  if (chapterBlocks.value.length > 2) chapterBlocks.value.pop();
  saveProgress();
  loadingPrev.value = false;
};

const backToLibrary = () => {
  stopTts();
  router.push("/");
};

// === TTS 逻辑 ===
const isTtsBlock = (chapterId: string, blockIdx: number): boolean => {
  return ttsState.value === "playing" && ttsChapterId.value === chapterId && ttsBlockIndex.value === blockIdx;
};

const getCurrentChapterBlocks = (): string[] => {
  const ch = chapterBlocks.value.find((c) => c.id === currentChapterId.value);
  return ch?.blocks || [];
};

// 朗读跟随：把正在朗读的段落滚动到视口中央
const scrollToTtsBlock = () => {
  if (!contentRef.value) return;
  const blocks = contentRef.value.querySelectorAll(
    `[data-chapter="${ttsChapterId.value}"] .text-block`,
  );
  const el = blocks[ttsBlockIndex.value] as HTMLElement | undefined;
  if (!el) return;
  const container = contentRef.value;
  const target = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
  container.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
};

const speakBlock = async () => {
  const ch = chapterBlocks.value.find((c) => c.id === ttsChapterId.value);
  if (!ch || ttsBlockIndex.value >= ch.blocks.length) {
    // 本章读完，自动续读下一章
    if (ttsState.value === "playing") {
      const idx = chapters.value.indexOf(ttsChapterId.value);
      const nextId = chapters.value[idx + 1];
      if (nextId) {
        if (chapterBlocks.value.some((c) => c.id === nextId)) {
          // 下一章已在窗口内，直接接上（滚动跟随会自动推进窗口）
          ttsChapterId.value = nextId;
          ttsBlockIndex.value = 0;
          speakBlock();
          return;
        }
        // 不在窗口内则加载
        await loadChapterWindow(nextId);
        ttsBlockIndex.value = 0;
        speakBlock();
        return;
      }
    }
    ttsState.value = "idle";
    return;
  }
  const text = ch.blocks[ttsBlockIndex.value];
  scrollToTtsBlock();

  if (ttsEngine.value === "edge") {
    // 短段落合并策略：从当前段向后累计，直到 ≥150 字或达到单次上限 400 字，
    // 一次生成一组，减少请求次数与段间衔接点
    const mergeFrom = (start: number): { text: string; count: number } => {
      let merged = "";
      let end = start;
      while (end < ch!.blocks.length) {
        const b = ch!.blocks[end];
        if (merged && merged.length + b.length > 400) break;
        merged += (merged ? "，" : "") + b;
        end++;
        if (merged.length >= 150) break;
      }
      return { text: merged, count: end - start };
    };

    const group = mergeFrom(ttsBlockIndex.value);
    // 预取下一组：当前组播放期间后台合成，消除段间停顿
    const nextGroup = mergeFrom(ttsBlockIndex.value + group.count);
    if (nextGroup.text) {
      invoke("edge_tts_prefetch", {
        text: nextGroup.text,
        voice: ttsEdgeVoice.value,
        rate: ttsRate.value,
      }).catch(() => {});
    }
    // 网络偶发失败指数退避重试（最多 5 次），避免朗读中途悄悄停止
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await invoke("edge_tts_speak", {
          text: group.text,
          voice: ttsEdgeVoice.value,
          rate: ttsRate.value,
        });
        // 自然播完，读下一组
        if (ttsState.value === "playing") {
          ttsBlockIndex.value += group.count;
          speakBlock();
        }
        return;
      } catch (e) {
        if (e === "stopped") return; // 用户主动停止
        console.error(`Edge TTS 第 ${attempt} 次失败:`, e);
        if (attempt < 5) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        } else {
          ttsState.value = "idle";
        }
      }
    }
    return;
  }

  try {
    await speak({
      text,
      language: null,
      voiceId: ttsVoice.value || null,
      rate: ttsRate.value,
      pitch: null,
      volume: null,
      queueMode: null,
    });
  } catch (e) {
    console.error("TTS speak error:", e);
    ttsState.value = "idle";
  }
};

// 按当前引擎停止朗读（各引擎都发停止）
const stopAllTts = async () => {
  try {
    if (ttsEngine.value === "edge") await invoke("edge_tts_stop");
  } catch {}
  await ttsStop();
};

const startTts = async (fromBlockIndex = 0) => {
  const blocks = getCurrentChapterBlocks();
  if (blocks.length === 0) return;

  await stopAllTts();
  ttsChapterId.value = currentChapterId.value;
  ttsBlockIndex.value = fromBlockIndex;
  ttsState.value = "playing";
  await speakBlock();
};

const startTtsFromBlock = async (chapterId: string, blockIdx: number) => {
  await stopAllTts();
  ttsChapterId.value = chapterId;
  ttsBlockIndex.value = blockIdx;
  ttsState.value = "playing";
  await speakBlock();
};

const toggleTts = async () => {
  if (ttsState.value === "idle") {
    await startTts();
  } else if (ttsState.value === "playing") {
    await stopAllTts();
    ttsState.value = "paused";
  } else if (ttsState.value === "paused") {
    ttsState.value = "playing";
    await speakBlock();
  }
};

const stopTts = async () => {
  await stopAllTts();
  ttsState.value = "idle";
};

const loadTtsVoices = async () => {
  try {
    const all = await getVoices();
    ttsVoices.value = all
    if (!ttsVoice.value && ttsVoices.value.length > 0) {
      ttsVoice.value = ttsVoices.value[0].id;
    }
  } catch (e) {
    console.error("Failed to load TTS voices:", e);
  }
};

// Auto-save settings on change
watch([textSize, textColor, bgColor, bgOpacity, hideOnLeave, ttsVoice, ttsRate, ttsEngine, ttsEdgeVoice], saveSettings);
watch(currentChapterId, expandCurrentChapterAncestors);

// 打开章节列表时自动滚到当前章节
watch(showChapterList, (val) => {
  if (val) {
    setTimeout(() => {
      const active = chapterListRef.value?.querySelector(
        ".chapter-item.active",
      );
      active?.scrollIntoView({ block: "center" });
    }, 50);
  }
});

onMounted(async () => {
  await loadSettings();
  await loadChapters();
  if (chapters.value.length === 0) return;
  await restoreProgress();

  // TTS 初始化
  await loadTtsVoices();
  try {
    edgeVoices.value = await invoke<Array<{ id: string; name: string }>>(
      "edge_tts_voices",
    );
  } catch (e) {
    console.error("Failed to load edge voices:", e);
  }
  ttsUnlisten = await onSpeechEvent("speech:finish", () => {
    // 仅系统语音引擎走插件事件推进；Edge 引擎在 speakBlock 内自行推进
    if (ttsEngine.value === "system" && ttsState.value === "playing") {
      ttsBlockIndex.value++;
      speakBlock();
    }
  });
  const ttsUnlistenCancel = await onSpeechEvent("speech:cancel", () => {
    // 仅系统语音引擎响应取消事件；其他引擎的 stopAllTts 也会触发插件 stop，
    // 若不区分会把刚设为 playing 的状态误重置，导致只播一段就停
    if (ttsEngine.value === "system") {
      ttsState.value = "idle";
    }
  });

  const unlistenEnter = await listen("cursor-enter", () => onMouseEnter());
  const unlistenLeave = await listen("cursor-leave", () => onMouseLeave());

  // 监听窗口焦点变化
  // 当 Dock 图标被点击激活窗口时显示内容
  const unlistenFocus = await appWindow.onFocusChanged(
    ({ payload: focused }) => {
      if (focused) {
        // 窗口获得焦点（ Dock 点击激活）
        isMouseInside.value = true;
      }
      // 注意：窗口失去焦点时不再自动隐藏内容
      // 这样用户可以点击其他应用后，再点击 Dock 图标重新显示
    },
  );

  onUnmounted(() => {
    stopTts();
    unlistenEnter();
    unlistenLeave();
    unlistenFocus();
    ttsUnlisten?.();
    ttsUnlistenCancel();
  });
});
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
  content: "";
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

.btn-tts-pos {
  bottom: 8px;
  right: 40px;
}

.btn-tts-float {
  border-color: rgba(100, 180, 255, 0.5);
  color: rgba(100, 180, 255, 0.8);
  background: rgba(0, 60, 120, 0.4);
}

.btn-tts-float:hover {
  background: rgba(0, 60, 120, 0.6);
  color: #fff;
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
  max-height: calc(100vh - 50px);
  overflow-y: auto;
  scrollbar-width: none;
}

.settings-panel::-webkit-scrollbar {
  display: none;
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

.chapter-group {
  padding: 7px 14px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.chapter-group:hover {
  background: rgba(255, 255, 255, 0.1);
}

.chapter-group-icon {
  font-size: 10px;
  opacity: 0.6;
}

.chapter-subitem {
  padding-left: 28px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  margin-left: 8px;
  margin-top: 2px;
}

.chapter-item {
  padding: 7px 14px;
  color: rgba(255, 255, 255, 0.7);
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

.chapter-title {
  font-weight: 600;
  padding: 16px 0 6px;
  text-indent: 0;
  user-select: none;
}

.text-block {
  line-height: 1.9;
  text-indent: 2em;
  word-break: break-all;
  margin-bottom: 4px;
}

.chapter-gap {
  height: 50vh;
}

.loading,
.loading-prev,
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

/* TTS */
.settings-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 10px 0;
}

.tts-buttons {
  display: flex;
  gap: 6px;
}

.tts-btn {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: none;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.tts-btn svg {
  width: 14px;
  height: 14px;
}

.tts-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.tts-btn.active {
  border-color: rgba(100, 180, 255, 0.5);
  color: rgba(100, 180, 255, 0.9);
}

.tts-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.tts-voice-select {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
  max-width: 140px;
  outline: none;
}

.tts-voice-select option {
  background: #1a1a1a;
  color: #e0e0e0;
}

.tts-rate-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.tts-rate-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  min-width: 32px;
  text-align: right;
}

.text-block.tts-active {
  background: rgba(100, 180, 255, 0.12);
  border-radius: 4px;
  margin-left: -6px;
  margin-right: -6px;
  padding-left: 8px;
  padding-right: 8px;
}
</style>
