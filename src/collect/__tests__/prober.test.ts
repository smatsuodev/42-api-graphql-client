import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { isBooleanLikeField, probeBooleanFields, probeNullableFields } from '../prober'

// auth モジュールをモック
mock.module('../auth', () => ({
  getAccessToken: mock(async () => 'mock-token'),
}))

// ─── ヘルパー ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch

function restoreFetch() {
  globalThis.fetch = originalFetch
}

// ─── probeNullableFields ─────────────────────────────────────────────────────

describe('probeNullableFields', () => {
  beforeEach(() => {
    restoreFetch()
  })

  test('結果が返ったフィールドはnullableと判定される', async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = new URL(url.toString())
      if (u.searchParams.get('filter[login]') === 'null') {
        return new Response(JSON.stringify([{ id: 1, login: null }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    const result = await probeNullableFields('users', ['login'])

    expect(result.nullableFields).toContain('login')
    expect(result.nonNullableFields.size).toBe(0)
    expect(result.probeItems).toHaveLength(1)
    expect(result.probeItems[0]).toEqual({ id: 1, login: null })
  })

  test('空配列が返ったフィールドはnon-nullableと判定される', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    const result = await probeNullableFields('users', ['login'])

    expect(result.nonNullableFields).toContain('login')
    expect(result.nullableFields.size).toBe(0)
    expect(result.probeItems).toHaveLength(0)
  })

  test('APIエラー時はfailedFieldsに記録される', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Error', { status: 500 })
    }) as unknown as typeof globalThis.fetch

    const result = await probeNullableFields('users', ['login'])

    expect(result.failedFields).toContain('login')
    expect(result.nullableFields.size).toBe(0)
    expect(result.nonNullableFields.size).toBe(0)
  })

  test('複数フィールドを判定できる', async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = new URL(url.toString())
      // login は nullable (結果あり)
      if (u.searchParams.get('filter[login]') === 'null') {
        return new Response(JSON.stringify([{ id: 1, login: null }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // email は non-nullable (空)
      if (u.searchParams.get('filter[email]') === 'null') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      // campus_id は失敗
      if (u.searchParams.get('filter[campus_id]') === 'null') {
        return new Response('Error', { status: 500 })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    const result = await probeNullableFields('users', ['login', 'email', 'campus_id'])

    expect(result.nullableFields).toEqual(new Set(['login']))
    expect(result.nonNullableFields).toEqual(new Set(['email']))
    expect(result.failedFields).toEqual(['campus_id'])
    expect(result.probeItems).toHaveLength(1)
  })

  test('フィールドリストが空の場合は空の結果を返す', async () => {
    const result = await probeNullableFields('users', [])

    expect(result.nullableFields.size).toBe(0)
    expect(result.nonNullableFields.size).toBe(0)
    expect(result.probeItems).toHaveLength(0)
    expect(result.failedFields).toHaveLength(0)
  })

  test('probeItemsに重複アイテムが含まれない', async () => {
    // 同じ id=1 のアイテムが複数フィールドの probe で返される場合
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = new URL(url.toString())
      if (u.searchParams.get('filter[login]') === 'null') {
        return new Response(JSON.stringify([{ id: 1, login: null, email: null }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (u.searchParams.get('filter[email]') === 'null') {
        return new Response(JSON.stringify([{ id: 1, login: null, email: null }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    const result = await probeNullableFields('users', ['login', 'email'])

    // id ベースで重複排除
    expect(result.probeItems).toHaveLength(1)
  })
})

// ─── isBooleanLikeField ─────────────────────────────────────────────────────

describe('isBooleanLikeField', () => {
  test('? サフィックスのフィールドはtrueを返す', () => {
    expect(isBooleanLikeField('staff?')).toBe(true)
    expect(isBooleanLikeField('alumni?')).toBe(true)
  })

  test('is_ プレフィックスのフィールドはtrueを返す', () => {
    expect(isBooleanLikeField('is_active')).toBe(true)
    expect(isBooleanLikeField('is_launched')).toBe(true)
  })

  test('通常のフィールドはfalseを返す', () => {
    expect(isBooleanLikeField('login')).toBe(false)
    expect(isBooleanLikeField('email')).toBe(false)
    expect(isBooleanLikeField('campus_id')).toBe(false)
  })
})

// ─── probeBooleanFields ─────────────────────────────────────────────────────

describe('probeBooleanFields', () => {
  beforeEach(() => {
    restoreFetch()
  })

  test('true/falseで2リクエスト送信される', async () => {
    const urls: string[] = []
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      urls.push(url.toString())
      return new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    await probeBooleanFields('users', ['staff?'])

    const filterValues = urls.map((u) => new URL(u).searchParams.get('filter[staff?]'))
    expect(filterValues).toContain('true')
    expect(filterValues).toContain('false')
  })

  test('取得アイテムがprobeItemsに含まれる', async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const u = new URL(url.toString())
      if (u.searchParams.get('filter[staff?]') === 'true') {
        return new Response(JSON.stringify([{ id: 1, 'staff?': true }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify([{ id: 2, 'staff?': false }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    const result = await probeBooleanFields('users', ['staff?'])

    expect(result.probeItems).toHaveLength(2)
    expect(result.probeItems).toContainEqual({ id: 1, 'staff?': true })
    expect(result.probeItems).toContainEqual({ id: 2, 'staff?': false })
  })

  test('seenIdsで重複排除される', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    const seenIds = new Set<unknown>([1])
    const result = await probeBooleanFields('users', ['staff?'], seenIds)

    expect(result.probeItems).toHaveLength(0)
  })

  test('true/false間で同一idが重複排除される', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    const result = await probeBooleanFields('users', ['staff?'])

    // true と false で同じ id=1 が返るが、1件にまとまる
    expect(result.probeItems).toHaveLength(1)
  })

  test('APIエラー時にfailedFieldsに記録される', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Error', { status: 500 })
    }) as unknown as typeof globalThis.fetch

    const result = await probeBooleanFields('users', ['staff?'])

    expect(result.failedFields).toContain('staff?')
    // 同一フィールドは1回のみ記録
    expect(result.failedFields.filter((f) => f === 'staff?')).toHaveLength(1)
  })

  test('空リストで空結果を返す', async () => {
    const result = await probeBooleanFields('users', [])

    expect(result.probeItems).toHaveLength(0)
    expect(result.failedFields).toHaveLength(0)
    expect(result.probedFieldCount).toBe(0)
  })
})
