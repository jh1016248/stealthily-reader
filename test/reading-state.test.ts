import assert from 'node:assert/strict'
import test from 'node:test'

import { getChapterWindow, getExpandedTocAncestorPaths } from '../src/lib/reading-state.ts'

test('keeps a stable three-chapter window around the selected chapter', () => {
  const chapters = ['001', '002', '003', '004', '005']
  assert.deepEqual(getChapterWindow(chapters, '003'), ['002', '003', '004'])
  assert.deepEqual(getChapterWindow(chapters, '001'), ['001', '002'])
  assert.deepEqual(getChapterWindow(chapters, '005'), ['004', '005'])
})

test('opens every ancestor group containing the current chapter', () => {
  const toc = [
    { label: '第一卷', subitems: [{ label: '第一部', subitems: [{ label: '第三章', href: 'chapter-3' }] }] },
    { label: '第四章', href: 'chapter-4' },
  ]

  assert.deepEqual(getExpandedTocAncestorPaths(toc, 'chapter-3'), ['0', '0.0'])
  assert.deepEqual(getExpandedTocAncestorPaths(toc, 'chapter-4'), [])
})
