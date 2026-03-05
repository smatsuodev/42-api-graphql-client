import { defineConfig, type GatewayPlugin } from '@graphql-hive/gateway'

const TOKEN_ENDPOINT = 'https://api.intra.42.fr/oauth/token'
// トークン期限切れ前にリフレッシュするためのバッファ（秒）
const EXPIRY_BUFFER_SECONDS = 60

let cachedToken: string | null = null
let expiresAt = 0

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < expiresAt) {
    return cachedToken
  }

  const clientId = process.env.FT_API_CLIENT_ID
  const clientSecret = process.env.FT_API_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'FT_API_CLIENT_ID and FT_API_CLIENT_SECRET must be set in environment variables',
    )
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to obtain access token: ${res.status} ${res.statusText} - ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    expires_in: number
  }

  cachedToken = data.access_token
  expiresAt = now + (data.expires_in - EXPIRY_BUFFER_SECONDS) * 1000

  console.log(`[auth] Obtained new access token (expires in ${data.expires_in}s)`)

  return cachedToken
}

function useOAuthToken(): GatewayPlugin {
  return {
    async onFetch({ setOptions, options }) {
      const token = await getAccessToken()
      const existingHeaders: Record<string, string> = {}
      if (options.headers) {
        const h = new Headers(options.headers)
        h.forEach((value, key) => {
          existingHeaders[key] = value
        })
      }
      existingHeaders['authorization'] = `Bearer ${token}`
      setOptions({ ...options, headers: existingHeaders })
    },
  }
}

export const gatewayConfig = defineConfig({
  plugins: () => [useOAuthToken()],
})
