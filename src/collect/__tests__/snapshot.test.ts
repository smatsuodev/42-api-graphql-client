import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { saveSnapshot, loadSnapshot, removeSnapshot, type SnapshotData } from '../snapshot'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function createSnapshotData(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    endpoint: 'project_sessions',
    method: 'GET',
    nextPage: 3,
    maxPages: 50,
    offset: 1,
    items: [{ id: 1, name: 'Alice' }],
    coverage: {
      id: { hasValue: true, hasNull: false },
      name: { hasValue: true, hasNull: false },
    },
    savedAt: '2026-03-06T00:00:00.000Z',
    ...overrides,
  }
}

// ─── テスト ──────────────────────────────────────────────────────────────────

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'snapshot-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('saveSnapshot / loadSnapshot', () => {
  test('保存したスナップショットをそのまま読み込める', () => {
    const data = createSnapshotData()
    saveSnapshot(tmpDir, 'project_sessions', data)

    const loaded = loadSnapshot(tmpDir, 'project_sessions')
    expect(loaded).toEqual(data)
  })

  test('異なるsafeNameのスナップショットは独立している', () => {
    const data1 = createSnapshotData({ endpoint: 'cursus' })
    const data2 = createSnapshotData({ endpoint: 'campus' })

    saveSnapshot(tmpDir, 'cursus', data1)
    saveSnapshot(tmpDir, 'campus', data2)

    expect(loadSnapshot(tmpDir, 'cursus')).toEqual(data1)
    expect(loadSnapshot(tmpDir, 'campus')).toEqual(data2)
  })

  test('スナップショットを上書き保存できる', () => {
    const data1 = createSnapshotData({ nextPage: 3 })
    const data2 = createSnapshotData({ nextPage: 10 })

    saveSnapshot(tmpDir, 'project_sessions', data1)
    saveSnapshot(tmpDir, 'project_sessions', data2)

    const loaded = loadSnapshot(tmpDir, 'project_sessions')
    expect(loaded).toEqual(data2)
  })

  test('大量のitemsを含むスナップショットを保存・復元できる', () => {
    const items = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `item-${i}`,
    }))
    const data = createSnapshotData({ items })

    saveSnapshot(tmpDir, 'large', data)
    const loaded = loadSnapshot(tmpDir, 'large')
    expect(loaded!.items).toHaveLength(500)
  })
})

describe('loadSnapshot', () => {
  test('ファイルが存在しない場合はnullを返す', () => {
    const loaded = loadSnapshot(tmpDir, 'nonexistent')
    expect(loaded).toBeNull()
  })

  test('ディレクトリが存在しない場合はnullを返す', () => {
    const loaded = loadSnapshot(join(tmpDir, 'no-such-dir'), 'test')
    expect(loaded).toBeNull()
  })
})

describe('removeSnapshot', () => {
  test('スナップショットを削除できる', () => {
    const data = createSnapshotData()
    saveSnapshot(tmpDir, 'project_sessions', data)

    removeSnapshot(tmpDir, 'project_sessions')

    const loaded = loadSnapshot(tmpDir, 'project_sessions')
    expect(loaded).toBeNull()
  })

  test('存在しないスナップショットの削除はエラーにならない', () => {
    expect(() => {
      removeSnapshot(tmpDir, 'nonexistent')
    }).not.toThrow()
  })
})
