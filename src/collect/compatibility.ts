/**
 * 42 API 対応状況テーブル
 *
 * apidoc HTML から全エンドポイントを抽出し、openapi.yml との対応状況を表示する
 */

import { parse as parseHtml } from 'node-html-parser'
import { readOrCreateOpenApiDoc } from './openapi'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const APIDOC_HTML_URL = 'https://api.intra.42.fr/apidoc/2.0.html'

const METHOD_ORDER = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface ApiEndpoint {
  method: string
  path: string
}

export interface CompatibilityEntry {
  method: string
  path: string
  supported: boolean
}

// ─── 純粋関数 ────────────────────────────────────────────────────────────────

/**
 * apidoc HTML からエンドポイント一覧を抽出する
 *
 * 実際の HTML 構造:
 *   <div class='resource-item-method'>
 *     <a href='...'>
 *       <span class='method'>GET</span>
 *       <span class='url'>/v2/accreditations</span>
 *     </a>
 *   </div>
 */
export function parseApidocEndpoints(html: string): ApiEndpoint[] {
  const root = parseHtml(html)
  const items = root.querySelectorAll('.resource-item-method')
  const seen = new Set<string>()
  const endpoints: ApiEndpoint[] = []

  for (const item of items) {
    const method = item.querySelector('.method')?.text.trim()
    const path = item.querySelector('.url')?.text.trim()
    if (!method || !path) continue
    const key = `${method} ${path}`
    if (!seen.has(key)) {
      seen.add(key)
      endpoints.push({ method, path })
    }
  }

  return endpoints
}

/**
 * /v2 プレフィックスを除去し、:param を {param} に変換する
 */
export function normalizeEndpointPath(path: string): string {
  const withoutV2 = path.startsWith('/v2') ? path.slice(3) : path
  return withoutV2.replace(/:(\w+)/g, '{$1}')
}

/**
 * エンドポイント一覧と openapi.yml のパスを比較して対応状況を返す
 */
export function buildCompatibilityTable(
  endpoints: ApiEndpoint[],
  openapiPaths: Record<string, Record<string, unknown>>,
): CompatibilityEntry[] {
  return endpoints.map((ep) => {
    const normalized = normalizeEndpointPath(ep.path)
    const pathEntry = openapiPaths[normalized]
    const supported = !!pathEntry?.[ep.method.toLowerCase()]
    return { method: ep.method, path: normalized, supported }
  })
}

/**
 * メソッドでフィルタする。空配列の場合は全件を返す。
 */
export function filterByMethods(entries: CompatibilityEntry[], methods: string[]): CompatibilityEntry[] {
  if (methods.length === 0) return entries
  const upper = new Set(methods.map((m) => m.toUpperCase()))
  return entries.filter((e) => upper.has(e.method.toUpperCase()))
}

/**
 * パスの辞書順、同一パス内でメソッド順にソートする
 */
export function sortCompatibilityEntries(entries: CompatibilityEntry[]): CompatibilityEntry[] {
  return [...entries].sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path)
    if (pathCmp !== 0) return pathCmp
    return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method)
  })
}

/**
 * テーブル文字列を生成する
 */
export function formatCompatibilityTable(entries: CompatibilityEntry[]): string {
  const supportedCount = entries.filter((e) => e.supported).length
  const total = entries.length
  const pct = total > 0 ? ((supportedCount / total) * 100).toFixed(1) : '0.0'

  const header = 'METHOD      ENDPOINT                              COMPATIBILITY'
  const separator = '-'.repeat(header.length)

  const rows = entries.map((e) => {
    const method = e.method.padEnd(10)
    const path = e.path.padEnd(36)
    const compat = e.supported ? '⭕' : '❌'
    return `${method}  ${path}  ${compat}`
  })

  return [header, separator, ...rows, '', `${supportedCount}/${total} endpoints covered (${pct}%)`].join('\n')
}

// ─── オーケストレーション ────────────────────────────────────────────────────

/**
 * 対応状況テーブルを表示する
 */
export async function showCompatibility(methods?: string[] | null): Promise<void> {
  console.log(`[compatibility] フェッチ中: ${APIDOC_HTML_URL}`)
  const response = await fetch(APIDOC_HTML_URL)
  if (!response.ok) {
    throw new Error(`apidoc フェッチ失敗: ${response.status} ${response.statusText}`)
  }
  const html = await response.text()

  const endpoints = parseApidocEndpoints(html)
  const doc = readOrCreateOpenApiDoc()
  const openapiPaths = doc.paths ?? {}

  const table = buildCompatibilityTable(endpoints, openapiPaths)
  const filtered = methods ? filterByMethods(table, methods) : table
  const sorted = sortCompatibilityEntries(filtered)
  const output = formatCompatibilityTable(sorted)

  console.log(`\n${output}`)
}
