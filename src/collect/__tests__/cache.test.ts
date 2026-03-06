import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { savePageCache, loadPageCache, loadAllCachedPages } from '../cache'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cache-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('savePageCache / loadPageCache', () => {
  test('保存したページキャッシュを読み込める', () => {
    const items = [{ id: 1 }, { id: 2 }]
    savePageCache(tmpDir, 1, items)

    const cached = loadPageCache(tmpDir, 1)
    expect(cached).not.toBeNull()
    expect(cached!.page).toBe(1)
    expect(cached!.items).toEqual(items)
    expect(cached!.fetchedAt).toBeTruthy()
  })

  test('存在しないページはnullを返す', () => {
    expect(loadPageCache(tmpDir, 99)).toBeNull()
  })

  test('ディレクトリが存在しない場合はnullを返す', () => {
    expect(loadPageCache(join(tmpDir, 'no-such-dir'), 1)).toBeNull()
  })

  test('異なるページ番号は独立している', () => {
    savePageCache(tmpDir, 1, [{ id: 1 }])
    savePageCache(tmpDir, 2, [{ id: 2 }])

    expect(loadPageCache(tmpDir, 1)!.items).toEqual([{ id: 1 }])
    expect(loadPageCache(tmpDir, 2)!.items).toEqual([{ id: 2 }])
  })

  test('同じページを上書き保存できる', () => {
    savePageCache(tmpDir, 1, [{ id: 1 }])
    savePageCache(tmpDir, 1, [{ id: 99 }])

    expect(loadPageCache(tmpDir, 1)!.items).toEqual([{ id: 99 }])
  })
})

describe('loadAllCachedPages', () => {
  test('全キャッシュ済みページをページ番号順で返す', () => {
    savePageCache(tmpDir, 3, [{ id: 3 }])
    savePageCache(tmpDir, 1, [{ id: 1 }])
    savePageCache(tmpDir, 2, [{ id: 2 }])

    const pages = loadAllCachedPages(tmpDir)
    expect(pages).toHaveLength(3)
    expect(pages[0]!.page).toBe(1)
    expect(pages[1]!.page).toBe(2)
    expect(pages[2]!.page).toBe(3)
  })

  test('キャッシュが空の場合は空配列を返す', () => {
    expect(loadAllCachedPages(tmpDir)).toEqual([])
  })

  test('ディレクトリが存在しない場合は空配列を返す', () => {
    expect(loadAllCachedPages(join(tmpDir, 'no-such-dir'))).toEqual([])
  })
})
