import { describe, expect, test } from 'bun:test'
import { CoverageTracker, synthesizeFull, synthesizeNullable } from '../synthesizer'

// ─── synthesizeFull ──────────────────────────────────────────────────────────

describe('synthesizeFull', () => {
  test('空配列を渡すと空オブジェクトを返す', () => {
    const result = synthesizeFull([])
    expect(result).toEqual({})
  })

  test('単一アイテムの場合そのまま返す', () => {
    const items = [{ id: 1, name: 'Alice' }]
    const result = synthesizeFull(items)
    expect(result).toEqual({ id: 1, name: 'Alice' })
  })

  test('複数アイテムから各フィールドの非null値を合成する', () => {
    const items = [
      { id: 1, name: null, email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: null },
    ]
    const result = synthesizeFull(items as Record<string, unknown>[])
    expect(result.id).toBe(1)
    expect(result.name).toBe('Bob')
    expect(result.email).toBe('alice@example.com')
  })

  test('すべてのアイテムでnullのフィールドはnullになる', () => {
    const items = [
      { id: 1, nickname: null },
      { id: 2, nickname: null },
    ]
    const result = synthesizeFull(items as Record<string, unknown>[])
    expect(result.nickname).toBeNull()
  })

  test('一部のアイテムにしか存在しないフィールドも合成される', () => {
    const items = [{ id: 1 }, { id: 2, extra: 'data' }]
    const result = synthesizeFull(items)
    expect(result.extra).toBe('data')
  })

  test('ネストオブジェクトを再帰的にマージする', () => {
    const items = [
      { id: 1, user: { name: null, age: 25 } },
      { id: 2, user: { name: 'Bob', age: null } },
    ]
    const result = synthesizeFull(items as Record<string, unknown>[])
    const user = result.user as Record<string, unknown>
    expect(user.name).toBe('Bob')
    expect(user.age).toBe(25)
  })

  test('配列フィールドでは非空の配列を優先する', () => {
    const items = [
      { id: 1, tags: [] },
      { id: 2, tags: ['a', 'b'] },
    ]
    const result = synthesizeFull(items as Record<string, unknown>[])
    expect(Array.isArray(result.tags)).toBe(true)
    expect((result.tags as unknown[]).length).toBeGreaterThan(0)
  })
})

// ─── synthesizeNullable ──────────────────────────────────────────────────────

describe('synthesizeNullable', () => {
  test('空配列を渡すと空オブジェクトを返す', () => {
    const result = synthesizeNullable([])
    expect(result).toEqual({})
  })

  test('nullの値が存在する場合はnullを優先する', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: null },
    ]
    const result = synthesizeNullable(items as Record<string, unknown>[])
    expect(result.name).toBeNull()
  })

  test('空配列を優先する', () => {
    const items = [
      { id: 1, tags: ['a'] },
      { id: 2, tags: [] },
    ]
    const result = synthesizeNullable(items as Record<string, unknown>[])
    expect(result.tags).toEqual([])
  })

  test('nullが存在しないフィールドは非null値を採用する', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]
    const result = synthesizeNullable(items as Record<string, unknown>[])
    // name は全てnon-null → nullable の合成結果はネスト処理で値を保持
    expect(result.name).toBeDefined()
  })
})

// ─── CoverageTracker ─────────────────────────────────────────────────────────

describe('CoverageTracker', () => {
  test('初期状態ではisFullyCoveredはfalseを返す', () => {
    const tracker = new CoverageTracker()
    expect(tracker.isFullyCovered()).toBe(false)
  })

  test('全フィールドで非nullとnullの両方が見つかるとisFullyCoveredがtrueになる', () => {
    const tracker = new CoverageTracker()
    tracker.update({ id: 1, name: 'Alice' })
    tracker.update({ id: null, name: null } as unknown as Record<string, unknown>)
    expect(tracker.isFullyCovered()).toBe(true)
  })

  test('値のみのフィールドがあるとisFullyCoveredはfalseを返す', () => {
    const tracker = new CoverageTracker()
    tracker.update({ id: 1, name: 'Alice' })
    tracker.update({ id: null, name: 'Bob' } as unknown as Record<string, unknown>)
    // name は非null のみ → 未カバー
    expect(tracker.isFullyCovered()).toBe(false)
  })

  test('nullのみのフィールドがあるとisFullyCoveredはfalseを返す', () => {
    const tracker = new CoverageTracker()
    tracker.update({ id: 1, name: null } as unknown as Record<string, unknown>)
    tracker.update({ id: null, name: null } as unknown as Record<string, unknown>)
    // name は null のみ → 未カバー
    expect(tracker.isFullyCovered()).toBe(false)
  })

  test('ネストオブジェクトのフィールドも追跡する', () => {
    const tracker = new CoverageTracker()
    tracker.update({ user: { name: 'Alice' } })
    tracker.update({ user: { name: null } } as unknown as Record<string, unknown>)
    // user は非null のみ, user.name は両方カバー → user がnull未カバー
    expect(tracker.isFullyCovered()).toBe(false)
  })

  test('空配列はnullとして扱われる', () => {
    const tracker = new CoverageTracker()
    tracker.update({ tags: [] })
    tracker.update({ tags: ['a'] })
    expect(tracker.isFullyCovered()).toBe(true)
  })

  // ─── シリアライズ / デシリアライズ ──────────────────────────────────────

  test('空のtrackerのtoJSON()は空オブジェクトを返す', () => {
    const tracker = new CoverageTracker()
    expect(tracker.toJSON()).toEqual({})
  })

  test('update後のtoJSON()はフィールドカバレッジを含むオブジェクトを返す', () => {
    const tracker = new CoverageTracker()
    tracker.update({ id: 1, name: null } as unknown as Record<string, unknown>)

    const json = tracker.toJSON()
    expect(json).toEqual({
      id: { hasValue: true, hasNull: false },
      name: { hasValue: false, hasNull: true },
    })
  })

  test('fromJSON()で復元したtrackerは元と同じisFullyCovered()の結果を返す', () => {
    const original = new CoverageTracker()
    original.update({ id: 1, name: 'Alice' })
    original.update({ id: null, name: null } as unknown as Record<string, unknown>)
    expect(original.isFullyCovered()).toBe(true)

    const restored = CoverageTracker.fromJSON(original.toJSON())
    expect(restored.isFullyCovered()).toBe(true)
  })

  test('fromJSON()で復元したtrackerのtoJSON()は元と一致する', () => {
    const original = new CoverageTracker()
    original.update({ id: 1, name: null, user: { age: 25 } } as unknown as Record<string, unknown>)

    const json = original.toJSON()
    const restored = CoverageTracker.fromJSON(json)
    expect(restored.toJSON()).toEqual(json)
  })

  test('fromJSON()で復元したtrackerに追加updateができる', () => {
    const original = new CoverageTracker()
    original.update({ id: 1, name: 'Alice' })

    const restored = CoverageTracker.fromJSON(original.toJSON())
    expect(restored.isFullyCovered()).toBe(false)

    restored.update({ id: null, name: null } as unknown as Record<string, unknown>)
    expect(restored.isFullyCovered()).toBe(true)
  })
})
