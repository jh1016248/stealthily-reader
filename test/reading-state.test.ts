import assert from 'node:assert/strict'
import test from 'node:test'

import { getChapterWindow, getExpandedTocAncestorPaths, adjustScrollTopAfterTrim, hasScrolledAPageIntoNextChapter } from '../src/lib/reading-state.ts'

test('keeps a two-chapter window: current chapter plus the next one', () => {
  const chapters = ['001', '002', '003', '004', '005']
  assert.deepEqual(getChapterWindow(chapters, '003'), ['003', '004'])
  assert.deepEqual(getChapterWindow(chapters, '001'), ['001', '002'])
  assert.deepEqual(getChapterWindow(chapters, '005'), ['005'])
})

test('opens every ancestor group containing the current chapter', () => {
  const toc = [
    { label: '第一卷', subitems: [{ label: '第一部', subitems: [{ label: '第三章', href: 'chapter-3' }] }] },
    { label: '第四章', href: 'chapter-4' },
  ]

  assert.deepEqual(getExpandedTocAncestorPaths(toc, 'chapter-3'), ['0', '0.0'])
  assert.deepEqual(getExpandedTocAncestorPaths(toc, 'chapter-4'), [])
})

test('compensates scroll position whenever the top chapter is trimmed', () => {
  // 用户还在阅读中间章节末尾：scrollTop 小于被移除的顶部章节高度，
  // 旧逻辑此时跳过补偿导致视口跳到下一章底部；新逻辑必须补偿。
  assert.equal(adjustScrollTopAfterTrim(800, 1000), 0)
  assert.equal(adjustScrollTopAfterTrim(3000, 1000), 2000)
  assert.equal(adjustScrollTopAfterTrim(0, 500), 0)
})

test('advances the chapter window only after scrolling a full page into the next chapter', () => {
  const firstChapterHeight = 1000
  const clientHeight = 600

  // 还在第一章内
  assert.equal(hasScrolledAPageIntoNextChapter(500, clientHeight, firstChapterHeight), false)
  // 刚跨过第一章边界，但不足一页
  assert.equal(hasScrolledAPageIntoNextChapter(1200, clientHeight, firstChapterHeight), false)
  // 已滚入下一章超过一页
  assert.equal(hasScrolledAPageIntoNextChapter(1600, clientHeight, firstChapterHeight), true)
  assert.equal(hasScrolledAPageIntoNextChapter(2500, clientHeight, firstChapterHeight), true)
})

test('advances at the bottom even when the next chapter is shorter than a page', () => {
  // 下一章只有 400px（不足一屏 600px），总高 1400
  // 触底时 scrollTop = 1400 - 600 = 800，达不到 1000 + 600，但仍应推进
  assert.equal(hasScrolledAPageIntoNextChapter(780, 600, 1000, 1400), true)
  // 未触底且不足一页，不推进
  assert.equal(hasScrolledAPageIntoNextChapter(700, 600, 1000, 1400), false)
})
