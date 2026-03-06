/**
 * OAuth2 Client Credentials トークン管理
 *
 * 環境変数 FT_API_CLIENT_ID, FT_API_CLIENT_SECRET を使用して
 * 42 API のアクセストークンを取得・キャッシュする
 */

const TOKEN_ENDPOINT = 'https://api.intra.42.fr/oauth/token'

interface TokenResponse {
  access_token: string
  expires_in: number
}

/** テスタビリティのための依存性注入インターフェース */
export interface TokenManagerDeps {
  fetch: typeof globalThis.fetch
  getEnv: (key: string) => string | undefined
  now: () => number
}

const defaultDeps: TokenManagerDeps = {
  fetch: globalThis.fetch,
  getEnv: (key) => process.env[key],
  now: () => Date.now(),
}

/**
 * トークン管理クラス
 * テスト時には依存性を注入可能
 */
export class TokenManager {
  private cachedToken: string | null = null
  private tokenExpiresAt = 0
  private deps: TokenManagerDeps

  constructor(deps: Partial<TokenManagerDeps> = {}) {
    this.deps = { ...defaultDeps, ...deps }
  }

  /**
   * OAuth2 Client Credentials でアクセストークンを取得する
   * キャッシュ済みのトークンが有効ならそれを返す
   */
  async getToken(waitForRateLimit: () => Promise<void>): Promise<string> {
    const now = this.deps.now()
    if (this.cachedToken && now < this.tokenExpiresAt) {
      return this.cachedToken
    }

    const clientId = this.deps.getEnv('FT_API_CLIENT_ID')
    const clientSecret = this.deps.getEnv('FT_API_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error('環境変数 FT_API_CLIENT_ID と FT_API_CLIENT_SECRET を設定してください')
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    })

    await waitForRateLimit()
    const res = await this.deps.fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`トークン取得失敗: ${res.status} ${res.statusText} - ${body}`)
    }

    const data = (await res.json()) as TokenResponse
    this.cachedToken = data.access_token
    // 期限切れ 60 秒前にリフレッシュ
    this.tokenExpiresAt = now + (data.expires_in - 60) * 1000

    console.log(`[auth] アクセストークンを取得 (有効期限: ${data.expires_in}s)`)
    return this.cachedToken
  }
}

// ─── 後方互換の関数インターフェース ──────────────────────────────────────────

const defaultManager = new TokenManager()

/**
 * OAuth2 Client Credentials でアクセストークンを取得する
 * キャッシュ済みのトークンが有効ならそれを返す
 *
 * @param waitForRateLimit レート制限待機関数 (トークン取得リクエストもレート制限対象)
 */
export async function getAccessToken(waitForRateLimit: () => Promise<void>): Promise<string> {
  return defaultManager.getToken(waitForRateLimit)
}
