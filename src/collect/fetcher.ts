/**
 * 42 API ページネーション取得 + レート制限
 *
 * レート制限:
 *   - 1 秒あたり 2 リクエストまで (500ms インターバル)
 *   - 1 時間あたり 1200 リクエストまで
 */

import { getAccessToken } from './auth'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.intra.42.fr/v2'

/** 短期レート制限: リクエスト間の最小インターバル (ms) */
const MIN_REQUEST_INTERVAL_MS = 500

/** 長期レート制限: 1 時間あたりの最大リクエスト数 */
const HOURLY_REQUEST_LIMIT = 1200

/** 1 時間 (ms) */
const ONE_HOUR_MS = 60 * 60 * 1000

/** 1 ページあたりの取得件数 */
export const PAGE_SIZE = 100

/** API リクエスト失敗時のリトライ回数 */
const MAX_RETRIES = 1

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
export async function waitForRateLimit(): Promise<void> {
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

// ─── API リクエスト ──────────────────────────────────────────────────────────

async function fetchPage(endpoint: string, page: number): Promise<unknown[] | null> {
  const token = await getAccessToken(waitForRateLimit)
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

// ─── ページネーション収集 ────────────────────────────────────────────────────

export interface FetchResult {
  items: Record<string, unknown>[]
  totalItems: number
}

export interface FetchOptions {
  /** 復元済みの初期アイテム (スナップショットからの復元用) */
  initialItems?: Record<string, unknown>[]
  /** 各ページ取得後に呼ばれるコールバック (次のページ番号と累積アイテムを引数に取る) */
  onPageFetched?: (nextPage: number, currentItems: Record<string, unknown>[]) => void
  /** ページキャッシュからアイテムを読み込む。null を返すとキャッシュミス */
  loadCachedPage?: (page: number) => Record<string, unknown>[] | null
  /** ページデータ取得後に呼ばれるコールバック (キャッシュヒット・フェッチ両方) */
  onPageData?: (page: number, items: Record<string, unknown>[]) => void
}

/**
 * エンドポイントから全ページのデータを収集する
 */
export async function fetchAllPages(
  endpoint: string,
  maxPages: number,
  offset: number,
  isFullyCovered: () => boolean,
  onItems: (items: Record<string, unknown>[]) => void,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const { initialItems = [], onPageFetched, loadCachedPage, onPageData } = options
  const lastPage = offset + maxPages - 1
  const allItems: Record<string, unknown>[] = [...initialItems]
  let totalItems = 0

  for (let page = offset; page <= lastPage; page++) {
    // キャッシュ確認
    const cached = loadCachedPage?.(page) ?? null
    if (cached) {
      console.log(`[cache] ページ ${page} はキャッシュから読み込みました (${cached.length} 件)`)
      totalItems += cached.length
      allItems.push(...cached)
      onItems(cached)
      onPageData?.(page, cached)
      onPageFetched?.(page + 1, [...allItems])
      continue
    }

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

    const records: Record<string, unknown>[] = []
    for (const item of items) {
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        records.push(item as Record<string, unknown>)
      }
    }

    allItems.push(...records)
    onItems(records)
    onPageData?.(page, records)
    onPageFetched?.(page + 1, [...allItems])

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

  return { items: allItems, totalItems }
}
