import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { fetchAllPages, PAGE_SIZE } from '../fetcher'

// ─── モジュールモック ────────────────────────────────────────────────────────

// auth モジュールをモックして getAccessToken を差し替え
mock.module('../auth', () => ({
  getAccessToken: mock(async () => 'mock-token'),
}))

// ─── ヘルパー ────────────────────────────────────────────────────────────────

const originalFetch = globalThis.fetch

function mockFetchResponses(responses: (unknown[] | null)[]) {
  let callIndex = 0
  globalThis.fetch = mock(async () => {
    const data = responses[callIndex++]
    if (data === null) {
      return new Response('Error', { status: 500 })
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch
}

function restoreFetch() {
  globalThis.fetch = originalFetch
}

// ─── fetchAllPages ───────────────────────────────────────────────────────────

describe('fetchAllPages', () => {
  beforeEach(() => {
    restoreFetch()
  })

  test('全ページのデータを結合して返す', async () => {
    // 1ページ目: PAGE_SIZE件 → 2ページ目をフェッチ、2ページ目: PAGE_SIZE未満 → 終了
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i }))
    const page2 = [{ id: PAGE_SIZE }, { id: PAGE_SIZE + 1 }]
    mockFetchResponses([page1, page2])

    const onItems = mock(() => {})
    const result = await fetchAllPages('users', 10, 1, () => false, onItems)

    expect(result.items).toHaveLength(PAGE_SIZE + 2)
    expect(result.items[0]).toEqual({ id: 0 })
    expect(result.items[PAGE_SIZE]).toEqual({ id: PAGE_SIZE })
  })

  test('onItemsが各ページの取得ごとに呼ばれる', async () => {
    mockFetchResponses([
      [{ id: 1 }, { id: 2 }],
      [], // 空ページで終了
    ])

    const onItems = mock(() => {})
    await fetchAllPages('users', 10, 1, () => false, onItems)

    expect(onItems).toHaveBeenCalledTimes(1)
    expect(onItems).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }])
  })

  test('空ページを検出したら取得を終了する', async () => {
    mockFetchResponses([
      [{ id: 1 }],
      [], // 空
    ])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
    )

    expect(result.items).toHaveLength(1)
  })

  test('isFullyCoveredがtrueを返したら取得を終了する', async () => {
    let coveredCallCount = 0
    mockFetchResponses([
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })),
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i + PAGE_SIZE })),
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i + PAGE_SIZE * 2 })),
    ])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => {
        coveredCallCount++
        return coveredCallCount >= 2 // 2ページ目でカバレッジ完了
      },
      () => {},
    )

    // 2ページ目でカバレッジ完了 → 3ページ目は取得しない
    expect(result.items).toHaveLength(PAGE_SIZE * 2)
  })

  test('maxPagesで指定されたページ数まで取得する', async () => {
    mockFetchResponses([
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })),
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i + PAGE_SIZE })),
    ])

    const result = await fetchAllPages(
      'users',
      2,
      1,
      () => false,
      () => {},
    )

    expect(result.items).toHaveLength(PAGE_SIZE * 2)
  })

  test('offsetで開始ページを指定できる', async () => {
    const fetchCalls: string[] = []
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      fetchCalls.push(url.toString())
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch

    await fetchAllPages(
      'users',
      3,
      5,
      () => false,
      () => {},
    )

    // 最初のページ取得URLにpage[number]=5が含まれること
    expect(fetchCalls[0]).toContain('page[number]=5')
  })

  test('取得件数がPAGE_SIZE未満なら最終ページと判断する', async () => {
    mockFetchResponses([
      Array.from({ length: PAGE_SIZE - 1 }, (_, i) => ({ id: i })), // PAGE_SIZE未満
    ])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
    )

    expect(result.items).toHaveLength(PAGE_SIZE - 1)
    expect(result.totalItems).toBe(PAGE_SIZE - 1)
  })

  test('totalItemsが正しく集計される', async () => {
    const page1 = Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i }))
    const page2 = [{ id: PAGE_SIZE }, { id: PAGE_SIZE + 1 }]
    mockFetchResponses([page1, page2])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
    )

    expect(result.totalItems).toBe(PAGE_SIZE + 2)
  })

  test('配列以外の要素はフィルタリングされる', async () => {
    mockFetchResponses([[{ id: 1 }, null, 'string', { id: 2 }] as unknown[]])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
    )

    // nullとstringはフィルタリングされ、オブジェクトのみ含まれる
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({ id: 1 })
    expect(result.items[1]).toEqual({ id: 2 })
  })

  test('initialItemsを渡すと結果の先頭に含まれる', async () => {
    const initialItems = [{ id: 100 }, { id: 101 }]
    mockFetchResponses([[{ id: 1 }, { id: 2 }]])

    const result = await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
      { initialItems },
    )

    expect(result.items).toHaveLength(4)
    expect(result.items[0]).toEqual({ id: 100 })
    expect(result.items[1]).toEqual({ id: 101 })
    expect(result.items[2]).toEqual({ id: 1 })
    expect(result.items[3]).toEqual({ id: 2 })
  })

  test('キャッシュヒット時はAPIを呼ばずキャッシュデータを使用する', async () => {
    const cachedItems = [{ id: 10 }, { id: 11 }]
    // 2ページ目のみAPIから取得
    mockFetchResponses([[{ id: 20 }]])

    const loadCachedPage = mock((page: number) => {
      if (page === 1) return cachedItems
      return null
    })
    const onPageData = mock((_page: number, _items: Record<string, unknown>[]) => {})

    const result = await fetchAllPages(
      'users',
      2,
      1,
      () => false,
      () => {},
      { loadCachedPage, onPageData },
    )

    expect(result.items).toHaveLength(3)
    expect(result.items[0]).toEqual({ id: 10 })
    expect(result.items[2]).toEqual({ id: 20 })
    // onPageData はキャッシュヒット・フェッチ両方で呼ばれる
    expect(onPageData).toHaveBeenCalledTimes(2)
    expect(onPageData.mock.calls[0]![0]).toBe(1) // cached page
    expect(onPageData.mock.calls[1]![0]).toBe(2) // fetched page
  })

  test('全ページがキャッシュ済みの場合はAPIを呼ばない', async () => {
    let fetchCalled = false
    globalThis.fetch = mock(async () => {
      fetchCalled = true
      return new Response(JSON.stringify([]), { status: 200 })
    }) as unknown as typeof globalThis.fetch

    const result = await fetchAllPages(
      'users',
      2,
      1,
      () => false,
      () => {},
      {
        loadCachedPage: (page) => {
          if (page <= 2) return [{ id: page }]
          return null
        },
      },
    )

    expect(result.items).toHaveLength(2)
    expect(fetchCalled).toBe(false)
  })

  test('onPageFetchedが各ページ取得後に次のページ番号と累積アイテムで呼ばれる', async () => {
    mockFetchResponses([
      Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })),
      [{ id: PAGE_SIZE }], // PAGE_SIZE未満で終了
    ])

    const onPageFetched = mock((_nextPage: number, _items: Record<string, unknown>[]) => {})
    await fetchAllPages(
      'users',
      10,
      1,
      () => false,
      () => {},
      { onPageFetched },
    )

    expect(onPageFetched).toHaveBeenCalledTimes(2)
    // 第1引数: next page
    expect(onPageFetched.mock.calls[0]![0]).toBe(2)
    expect(onPageFetched.mock.calls[1]![0]).toBe(3)
    // 第2引数: 累積アイテム配列
    expect(onPageFetched.mock.calls[0]![1]).toHaveLength(PAGE_SIZE)
    expect(onPageFetched.mock.calls[1]![1]).toHaveLength(PAGE_SIZE + 1)
  })
})

// ─── PAGE_SIZE定数 ───────────────────────────────────────────────────────────

describe('PAGE_SIZE', () => {
  test('100が設定されている', () => {
    expect(PAGE_SIZE).toBe(100)
  })
})
