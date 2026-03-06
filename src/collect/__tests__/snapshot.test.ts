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
    offset: 0,
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
    const endpointDir = join(tmpDir, 'project_sessions')
    const data = createSnapshotData()
    saveSnapshot(endpointDir, data)

    const loaded = loadSnapshot(endpointDir)
    expect(loaded).toEqual(data)
  })

  test('異なるエンドポイントのスナップショットは独立している', () => {
    const dir1 = join(tmpDir, 'cursus')
    const dir2 = join(tmpDir, 'campus')
    const data1 = createSnapshotData({ endpoint: 'cursus' })
    const data2 = createSnapshotData({ endpoint: 'campus' })

    saveSnapshot(dir1, data1)
    saveSnapshot(dir2, data2)

    expect(loadSnapshot(dir1)).toEqual(data1)
    expect(loadSnapshot(dir2)).toEqual(data2)
  })

  test('スナップショットを上書き保存できる', () => {
    const endpointDir = join(tmpDir, 'project_sessions')
    const data1 = createSnapshotData({ nextPage: 3 })
    const data2 = createSnapshotData({ nextPage: 10 })

    saveSnapshot(endpointDir, data1)
    saveSnapshot(endpointDir, data2)

    const loaded = loadSnapshot(endpointDir)
    expect(loaded).toEqual(data2)
  })
})

describe('loadSnapshot', () => {
  test('ファイルが存在しない場合はnullを返す', () => {
    const loaded = loadSnapshot(join(tmpDir, 'nonexistent'))
    expect(loaded).toBeNull()
  })

  test('ディレクトリが存在しない場合はnullを返す', () => {
    const loaded = loadSnapshot(join(tmpDir, 'no-such-dir', 'nested'))
    expect(loaded).toBeNull()
  })
})

describe('removeSnapshot', () => {
  test('スナップショットを削除できる', () => {
    const endpointDir = join(tmpDir, 'project_sessions')
    const data = createSnapshotData()
    saveSnapshot(endpointDir, data)

    removeSnapshot(endpointDir)

    const loaded = loadSnapshot(endpointDir)
    expect(loaded).toBeNull()
  })

  test('存在しないスナップショットの削除はエラーにならない', () => {
    expect(() => {
      removeSnapshot(join(tmpDir, 'nonexistent'))
    }).not.toThrow()
  })
})
