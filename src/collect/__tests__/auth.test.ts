import { describe, expect, mock, test } from 'bun:test'
import { TokenManager } from '../auth'
import type { TokenManagerDeps } from '../auth'

// ─── テスト用ヘルパー ───────────────────────────────────────────────────────

function createMockDeps(overrides: Partial<TokenManagerDeps> = {}): TokenManagerDeps {
  return {
    fetch: mock(async () => {
      return new Response(JSON.stringify({ access_token: 'test-token', expires_in: 7200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as unknown as typeof globalThis.fetch,
    getEnv: (key: string) => {
      const env: Record<string, string> = {
        FT_API_CLIENT_ID: 'test-client-id',
        FT_API_CLIENT_SECRET: 'test-client-secret',
      }
      return env[key]
    },
    now: () => 1000000,
    ...overrides,
  }
}

const noopWait = mock(async () => {})

// ─── 環境変数バリデーション ──────────────────────────────────────────────────

describe('TokenManager - 環境変数バリデーション', () => {
  test('FT_API_CLIENT_IDが未設定の場合エラーをスローする', async () => {
    const manager = new TokenManager(createMockDeps({ getEnv: () => undefined }))

    expect(manager.getToken(noopWait)).rejects.toThrow('FT_API_CLIENT_ID と FT_API_CLIENT_SECRET')
  })

  test('FT_API_CLIENT_SECRETが空文字の場合エラーをスローする', async () => {
    const manager = new TokenManager(
      createMockDeps({
        getEnv: (key) => (key === 'FT_API_CLIENT_ID' ? 'id' : ''),
      }),
    )

    expect(manager.getToken(noopWait)).rejects.toThrow('FT_API_CLIENT_ID と FT_API_CLIENT_SECRET')
  })
})

// ─── トークン取得 ────────────────────────────────────────────────────────────

describe('TokenManager - トークン取得', () => {
  test('正常レスポンスからトークンを返す', async () => {
    const manager = new TokenManager(createMockDeps())

    const token = await manager.getToken(noopWait)

    expect(token).toBe('test-token')
  })

  test('トークンエンドポイントにPOSTリクエストを送る', async () => {
    const mockFetch = mock(async (_url: string | URL | Request, _init?: RequestInit) => {
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 7200 }), {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch }))

    await manager.getToken(noopWait)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = (mockFetch as any).mock.calls[0]
    expect(url).toBe('https://api.intra.42.fr/oauth/token')
    expect(init.method).toBe('POST')
  })

  test('client_credentialsグラントタイプでリクエストする', async () => {
    let capturedBody: string | undefined
    const mockFetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body?.toString()
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 7200 }), {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch }))

    await manager.getToken(noopWait)

    expect(capturedBody).toContain('grant_type=client_credentials')
    expect(capturedBody).toContain('client_id=test-client-id')
    expect(capturedBody).toContain('client_secret=test-client-secret')
  })

  test('waitForRateLimitを呼び出してからfetchする', async () => {
    const callOrder: string[] = []
    const wait = mock(async () => {
      callOrder.push('wait')
    })
    const mockFetch = mock(async () => {
      callOrder.push('fetch')
      return new Response(JSON.stringify({ access_token: 'token', expires_in: 7200 }), {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch }))

    await manager.getToken(wait)

    expect(callOrder).toEqual(['wait', 'fetch'])
  })
})

// ─── エラーハンドリング ──────────────────────────────────────────────────────

describe('TokenManager - エラーハンドリング', () => {
  test('APIが401を返した場合エラーをスローする', async () => {
    const mockFetch = mock(async () => {
      return new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' })
    }) as unknown as typeof globalThis.fetch
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch }))

    expect(manager.getToken(noopWait)).rejects.toThrow('トークン取得失敗: 401')
  })

  test('APIが500を返した場合エラーメッセージにレスポンスボディを含む', async () => {
    const mockFetch = mock(async () => {
      return new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    }) as unknown as typeof globalThis.fetch
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch }))

    expect(manager.getToken(noopWait)).rejects.toThrow('Internal Server Error')
  })
})

// ─── キャッシュ ──────────────────────────────────────────────────────────────

describe('TokenManager - キャッシュ', () => {
  test('有効期限内のトークンはキャッシュから返す', async () => {
    const mockFetch = mock(async () => {
      return new Response(JSON.stringify({ access_token: 'cached-token', expires_in: 7200 }), {
        status: 200,
      })
    }) as unknown as typeof globalThis.fetch

    let currentTime = 1000000
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch, now: () => currentTime }))

    // 1回目: fetchが呼ばれる
    const token1 = await manager.getToken(noopWait)
    expect(token1).toBe('cached-token')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // 2回目: キャッシュから返される (時間を少し進める)
    currentTime += 60000 // 60秒後
    const token2 = await manager.getToken(noopWait)
    expect(token2).toBe('cached-token')
    expect(mockFetch).toHaveBeenCalledTimes(1) // fetchは呼ばれない
  })

  test('有効期限切れ後はトークンを再取得する', async () => {
    let callCount = 0
    const mockFetch = mock(async () => {
      callCount++
      return new Response(
        JSON.stringify({
          access_token: `token-${callCount}`,
          expires_in: 7200,
        }),
        { status: 200 },
      )
    }) as unknown as typeof globalThis.fetch

    let currentTime = 1000000
    const manager = new TokenManager(createMockDeps({ fetch: mockFetch, now: () => currentTime }))

    const token1 = await manager.getToken(noopWait)
    expect(token1).toBe('token-1')

    // 有効期限の60秒前 = (7200-60)*1000 = 7140000ms 後にリフレッシュ
    currentTime += 7200 * 1000 // 確実に期限切れ
    const token2 = await manager.getToken(noopWait)
    expect(token2).toBe('token-2')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
