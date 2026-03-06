/**
 * 42 API のエンドポイントからレスポンスを収集し、Apidog 解析用の JSON を生成するスクリプト
 *
 * 各フィールドの型と null 許容性を判定するために、以下の 2 つの合成 JSON を出力する:
 *   - full.json: すべてのフィールドに非 null の値が入ったオブジェクト
 *   - nullable.json: 可能な限り null / 空配列のフィールドを持つオブジェクト
 *
 * レート制限:
 *   - 1 秒あたり 2 リクエストまで (500ms インターバル)
 *   - 1 時間あたり 1200 リクエストまで
 *
 * Usage: bun scripts/collect-responses.ts <endpoint> [--max-pages <n>]
 *   例: bun scripts/collect-responses.ts project_sessions
 *        bun scripts/collect-responses.ts cursus --max-pages 20
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.intra.42.fr/v2'
const TOKEN_ENDPOINT = 'https://api.intra.42.fr/oauth/token'

/** 短期レート制限: リクエスト間の最小インターバル (ms) */
const MIN_REQUEST_INTERVAL_MS = 500

/** 長期レート制限: 1 時間あたりの最大リクエスト数 */
const HOURLY_REQUEST_LIMIT = 1200

/** 1 時間 (ms) */
const ONE_HOUR_MS = 60 * 60 * 1000

/** 1 ページあたりの取得件数 */
const PAGE_SIZE = 100

/** 最大ページ数のデフォルト値 */
const DEFAULT_MAX_PAGES = 50

/** API リクエスト失敗時のリトライ回数 */
const MAX_RETRIES = 1

const OUTPUT_DIR = resolve(import.meta.dirname, 'output')

// ─── レート制限管理 ──────────────────────────────────────────────────────────

/** リクエストのタイムスタンプ履歴 (直近 1 時間分を保持) */
const requestTimestamps: number[] = []

/** 最後にリクエストを送信した時刻 */
let lastRequestTime = 0

/**
 * レート制限を考慮して待機する
 * - 直前のリクエストから MIN_REQUEST_INTERVAL_MS 以上経過するまで待機
 * - 直近 1 時間のリクエスト数が HOURLY_REQUEST_LIMIT に達している場合、
 *   最も古いリクエストから 1 時間経過するまで待機
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now()

  // 古いタイムスタンプを削除
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < now - ONE_HOUR_MS) {
    requestTimestamps.shift()
  }

  // 長期レート制限チェック
  if (requestTimestamps.length >= HOURLY_REQUEST_LIMIT) {
    const oldestInWindow = requestTimestamps[0]!
    const waitUntil = oldestInWindow + ONE_HOUR_MS
    const waitMs = waitUntil - now
    if (waitMs > 0) {
      console.log(
        `[rate-limit] 1 時間あたり ${HOURLY_REQUEST_LIMIT} リクエストに到達。${Math.ceil(waitMs / 1000)} 秒待機...`,
      )
      await Bun.sleep(waitMs)
    }
  }

  // 短期レート制限チェック
  const elapsed = Date.now() - lastRequestTime
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await Bun.sleep(MIN_REQUEST_INTERVAL_MS - elapsed)
  }

  lastRequestTime = Date.now()
  requestTimestamps.push(lastRequestTime)
}

// ─── OAuth2 トークン取得 ──────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string
  expires_in: number
}

let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken
  }

  const clientId = process.env.FT_API_CLIENT_ID
  const clientSecret = process.env.FT_API_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.error('エラー: 環境変数 FT_API_CLIENT_ID と FT_API_CLIENT_SECRET を設定してください')
    process.exit(1)
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  await waitForRateLimit()
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`トークン取得失敗: ${res.status} ${res.statusText} - ${body}`)
    process.exit(1)
  }

  const data = (await res.json()) as TokenResponse
  cachedToken = data.access_token
  // 期限切れ 60 秒前にリフレッシュ
  tokenExpiresAt = now + (data.expires_in - 60) * 1000

  console.log(`[auth] アクセストークンを取得 (有効期限: ${data.expires_in}s)`)
  return cachedToken
}

// ─── API リクエスト ──────────────────────────────────────────────────────────

async function fetchPage(endpoint: string, page: number): Promise<unknown[] | null> {
  const token = await getAccessToken()
  const url = `${API_BASE}/${endpoint}?page[number]=${page}&page[size]=${PAGE_SIZE}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await waitForRateLimit()

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const body = await res.text()
        console.warn(
          `[fetch] ${url} - ${res.status} ${res.statusText} (試行 ${attempt + 1}/${MAX_RETRIES + 1})`,
        )
        if (attempt < MAX_RETRIES) {
          console.warn(`[fetch] ${body}`)
          continue
        }
        console.error(`[fetch] 最大リトライ回数に到達。スキップします: ${body}`)
        return null
      }

      const data = await res.json()
      if (!Array.isArray(data)) {
        console.warn(`[fetch] レスポンスが配列ではありません: ${typeof data}`)
        return null
      }

      return data as unknown[]
    } catch (err) {
      console.warn(`[fetch] ネットワークエラー (試行 ${attempt + 1}/${MAX_RETRIES + 1}): ${err}`)
      if (attempt >= MAX_RETRIES) return null
    }
  }

  return null
}

// ─── フィールドカバレッジ追跡 ────────────────────────────────────────────────

interface FieldCoverage {
  /** 非 null / 非空の値を見つけたか */
  hasValue: boolean
  /** null / 空の値を見つけたか */
  hasNull: boolean
}

/** フィールドパス → カバレッジ状態 */
const coverage = new Map<string, FieldCoverage>()

/**
 * 値が「空」かどうかを判定する
 * - null, undefined → true
 * - 空配列 [] → true
 * - それ以外 → false (空文字列 "", 0, false は「有効な値」)
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * オブジェクトのフィールドを再帰的に走査し、カバレッジを更新する
 */
function updateCoverage(obj: Record<string, unknown>, prefix: string): void {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key

    if (!coverage.has(path)) {
      coverage.set(path, { hasValue: false, hasNull: false })
    }
    const entry = coverage.get(path)!

    if (isEmpty(value)) {
      entry.hasNull = true
    } else {
      entry.hasValue = true
    }

    // ネストオブジェクトを再帰的に走査
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      updateCoverage(value as Record<string, unknown>, path)
    }

    // 配列の場合、要素を走査してフィールドを収集
    if (Array.isArray(value) && value.length > 0) {
      for (const item of value) {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          updateCoverage(item as Record<string, unknown>, `${path}[]`)
        }
      }
    }
  }
}

/**
 * カバレッジの進捗を表示する
 */
function printCoverageProgress(): void {
  let total = 0
  let bothCovered = 0
  let valueOnly = 0
  let nullOnly = 0

  for (const entry of coverage.values()) {
    total++
    if (entry.hasValue && entry.hasNull) bothCovered++
    else if (entry.hasValue) valueOnly++
    else if (entry.hasNull) nullOnly++
  }

  const pct = total > 0 ? Math.round((bothCovered / total) * 100) : 0
  console.log(
    `[coverage] フィールド数: ${total}, 完全カバー: ${bothCovered} (${pct}%), 値のみ: ${valueOnly}, null のみ: ${nullOnly}`,
  )
}

/**
 * すべてのフィールドで非 null と null の両方が見つかったかどうか
 */
function isFullyCovered(): boolean {
  if (coverage.size === 0) return false
  for (const entry of coverage.values()) {
    if (!entry.hasValue || !entry.hasNull) return false
  }
  return true
}

// ─── 合成ロジック ────────────────────────────────────────────────────────────

/** 収集された全アイテム (フラットな配列) */
const allItems: Record<string, unknown>[] = []

/**
 * 収集された全アイテムから「全フィールドに値が入った」オブジェクトを合成する
 * 各フィールドについて、最初に見つかった非 null 値を採用する
 */
function synthesizeFull(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {}
  return mergeFields(items, false)
}

/**
 * 収集された全アイテムから「可能な限り null / 空のフィールド」を持つオブジェクトを合成する
 * 各フィールドについて、null / 空配列の値を優先的に採用する
 * null が見つからないフィールドは非 null 値を採用する (フィールドの存在を保証するため)
 */
function synthesizeNullable(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {}
  return mergeFields(items, true)
}

/**
 * 複数のオブジェクトからフィールドをマージして 1 つのオブジェクトを合成する
 * @param preferNull true の場合、null / 空の値を優先する
 */
function mergeFields(
  items: Record<string, unknown>[],
  preferNull: boolean,
): Record<string, unknown> {
  // まず全フィールドのキーを収集
  const allKeys = new Set<string>()
  for (const item of items) {
    for (const key of Object.keys(item)) {
      allKeys.add(key)
    }
  }

  const result: Record<string, unknown> = {}

  for (const key of allKeys) {
    if (preferNull) {
      // null / 空の値を優先
      const nullItem = items.find((item) => key in item && isEmpty(item[key]))
      if (nullItem !== undefined) {
        result[key] = nullItem[key] ?? null
      } else {
        // null が見つからない場合は値を使う（ネストオブジェクトは再帰処理）
        const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
        if (valueItem !== undefined) {
          result[key] = processNestedValue(items, key, preferNull)
        } else {
          result[key] = null
        }
      }
    } else {
      // 非 null の値を優先
      const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
      if (valueItem !== undefined) {
        result[key] = processNestedValue(items, key, preferNull)
      } else {
        // 非 null が見つからない場合は null / 空を使う
        const anyItem = items.find((item) => key in item)
        result[key] = anyItem ? (anyItem[key] ?? null) : null
      }
    }
  }

  return result
}

/**
 * ネストされた値を再帰的に処理する
 */
function processNestedValue(
  items: Record<string, unknown>[],
  key: string,
  preferNull: boolean,
): unknown {
  // 非 null の値を持つアイテムを探す
  const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
  if (!valueItem) return null

  const value = valueItem[key]

  // ネストオブジェクトの場合: 同じキーを持つ全アイテムのネストオブジェクトを収集して再帰マージ
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const nestedItems = items
      .filter(
        (item) =>
          key in item &&
          item[key] !== null &&
          typeof item[key] === 'object' &&
          !Array.isArray(item[key]),
      )
      .map((item) => item[key] as Record<string, unknown>)
    if (nestedItems.length > 0) {
      return mergeFields(nestedItems, preferNull)
    }
    return value
  }

  // 配列の場合: 非空の配列からフィールドを収集して合成
  if (Array.isArray(value)) {
    if (preferNull) {
      // nullable の場合は空配列を返す
      return []
    }
    // full の場合は配列要素がオブジェクトなら再帰マージ
    const allArrayItems: Record<string, unknown>[] = []
    for (const item of items) {
      const arr = item[key]
      if (Array.isArray(arr)) {
        for (const elem of arr) {
          if (elem !== null && typeof elem === 'object' && !Array.isArray(elem)) {
            allArrayItems.push(elem as Record<string, unknown>)
          }
        }
      }
    }
    if (allArrayItems.length > 0) {
      return [mergeFields(allArrayItems, preferNull)]
    }
    return value
  }

  return value
}

// ─── CLI パース ──────────────────────────────────────────────────────────────

function parseArgs(): { endpoint: string; maxPages: number; offset: number } {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: bun scripts/collect-responses.ts <endpoint> [--max-pages <n>] [--offset <n>]

42 API のエンドポイントからレスポンスを収集し、Apidog 解析用の JSON を生成します。

引数:
  endpoint      エンドポイントのパス (/v2/ 以降の部分)
                例: project_sessions, cursus, campus

オプション:
  --max-pages   最大ページ数 (デフォルト: ${DEFAULT_MAX_PAGES})
  --offset      取得を開始するページ番号 (デフォルト: 1)
  --help, -h    このヘルプを表示

例:
  bun scripts/collect-responses.ts project_sessions
  bun scripts/collect-responses.ts cursus --max-pages 20
  bun scripts/collect-responses.ts cursus --offset 5 --max-pages 10`)
    process.exit(0)
  }

  let endpoint = args[0]!
  let maxPages = DEFAULT_MAX_PAGES
  let offset = 1

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--max-pages' && args[i + 1]) {
      maxPages = Number.parseInt(args[i + 1]!, 10)
      if (Number.isNaN(maxPages) || maxPages < 1) {
        console.error('エラー: --max-pages は 1 以上の整数を指定してください')
        process.exit(1)
      }
      i++
    } else if (args[i] === '--offset' && args[i + 1]) {
      offset = Number.parseInt(args[i + 1]!, 10)
      if (Number.isNaN(offset) || offset < 1) {
        console.error('エラー: --offset は 1 以上の整数を指定してください')
        process.exit(1)
      }
      i++
    }
  }

  // 先頭の / を除去
  endpoint = endpoint.replace(/^\//, '')

  return { endpoint, maxPages, offset }
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { endpoint, maxPages, offset } = parseArgs()
  const safeName = endpoint.replace(/\//g, '_')
  const lastPage = offset + maxPages - 1

  console.log('\n=== 42 API レスポンス収集 ===')
  console.log(`エンドポイント: ${API_BASE}/${endpoint}`)
  console.log(`開始ページ: ${offset}`)
  console.log(`最大ページ数: ${maxPages}`)
  console.log(`ページサイズ: ${PAGE_SIZE}`)
  console.log(`出力先: ${OUTPUT_DIR}/${safeName}_*.json\n`)

  let totalItems = 0

  for (let page = offset; page <= lastPage; page++) {
    console.log(`[fetch] ページ ${page}/${lastPage} を取得中...`)

    const items = await fetchPage(endpoint, page)

    if (items === null) {
      console.warn(`[fetch] ページ ${page} の取得に失敗。スキップします。`)
      continue
    }

    if (items.length === 0) {
      console.log(`[fetch] ページ ${page} は空です。取得を終了します。`)
      break
    }

    totalItems += items.length
    console.log(`[fetch] ${items.length} 件取得 (累計: ${totalItems} 件)`)

    // カバレッジを更新
    for (const item of items) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>
        allItems.push(record)
        updateCoverage(record, '')
      }
    }

    printCoverageProgress()

    // 全フィールドでカバレッジが完了したら終了
    if (isFullyCovered()) {
      console.log(`\n[coverage] 全フィールドのカバレッジが完了しました！`)
      break
    }

    // 取得件数がページサイズ未満ならこれ以上ページがない
    if (items.length < PAGE_SIZE) {
      console.log(`[fetch] 最終ページに到達しました。`)
      break
    }
  }

  if (allItems.length === 0) {
    console.error('\nエラー: レスポンスを 1 件も取得できませんでした。')
    process.exit(1)
  }

  console.log(`\n合計 ${allItems.length} 件のレスポンスを収集しました。合成を開始します...\n`)

  // 合成
  const full = synthesizeFull(allItems)
  const nullable = synthesizeNullable(allItems)

  // 出力
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const fullPath = resolve(OUTPUT_DIR, `${safeName}_full.json`)
  const nullablePath = resolve(OUTPUT_DIR, `${safeName}_nullable.json`)

  writeFileSync(fullPath, JSON.stringify(full, null, 2) + '\n')
  writeFileSync(nullablePath, JSON.stringify(nullable, null, 2) + '\n')

  console.log(`[output] ${fullPath}`)
  console.log(`[output] ${nullablePath}`)

  // カバレッジサマリー
  console.log(`\n=== カバレッジサマリー ===`)
  let uncoveredValue = 0
  let uncoveredNull = 0
  for (const [path, entry] of coverage) {
    if (!entry.hasValue) {
      uncoveredValue++
      console.log(`  [値なし] ${path}`)
    }
    if (!entry.hasNull) {
      uncoveredNull++
      console.log(`  [null なし] ${path}`)
    }
  }
  if (uncoveredValue === 0 && uncoveredNull === 0) {
    console.log('  全フィールドで非 null / null の両方のサンプルが見つかりました。')
  } else {
    console.log(
      `\n  非 null 未発見: ${uncoveredValue} フィールド, null 未発見: ${uncoveredNull} フィールド`,
    )
  }

  console.log('\n完了！')
}

main()
