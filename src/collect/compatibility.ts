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
  restricted: boolean
}

export interface CompatibilityEntry {
  method: string
  path: string
  supported: boolean
  restricted: boolean
}

export type CompatOutputFormat = 'ascii' | 'markdown' | 'json'

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
      const restricted = item.text.includes('vpn_key')
      endpoints.push({ method, path, restricted })
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
    return { method: ep.method, path: normalized, supported, restricted: ep.restricted }
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
 * restricted エンドポイントをフィルタする。showRestricted が true の場合は全件を返す。
 */
export function filterByRestricted(entries: CompatibilityEntry[], showRestricted: boolean): CompatibilityEntry[] {
  if (showRestricted) return entries
  return entries.filter((e) => !e.restricted)
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

  const headers = ['Method', 'Endpoint', 'Compatibility']
  const rows = entries.map((e) => [e.method, e.path, e.supported ? '⭕' : '❌'])

  const colWidths = headers.map((h, i) => {
    const dataMax = rows.reduce((max, row) => Math.max(max, row[i]!.length), 0)
    return Math.max(h.length, dataMax)
  })

  const border = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+'
  const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(colWidths[i]!)} `).join('|') + '|'
  const dataRows = rows.map(
    (row) => '|' + row.map((cell, i) => ` ${cell.padEnd(colWidths[i]!)} `).join('|') + '|',
  )

  return [border, headerRow, border, ...dataRows, border, '', `${supportedCount}/${total} endpoints covered (${pct}%)`].join('\n')
}

/**
 * Markdown テーブル形式でフォーマットする
 */
export function formatCompatibilityMarkdown(entries: CompatibilityEntry[]): string {
  const supportedCount = entries.filter((e) => e.supported).length
  const total = entries.length
  const pct = total > 0 ? ((supportedCount / total) * 100).toFixed(1) : '0.0'

  const header = '| Method | Endpoint | Compatibility |'
  const separator = '| --- | --- | --- |'

  const rows = entries.map((e) => {
    const compat = e.supported ? '⭕' : '❌'
    return `| ${e.method} | ${e.path} | ${compat} |`
  })

  return [header, separator, ...rows, '', `${supportedCount}/${total} endpoints covered (${pct}%)`].join('\n')
}

/**
 * JSON 形式でフォーマットする
 */
export function formatCompatibilityJson(entries: CompatibilityEntry[]): string {
  const supportedCount = entries.filter((e) => e.supported).length
  const total = entries.length
  const pct = total > 0 ? ((supportedCount / total) * 100).toFixed(1) : '0.0'

  return JSON.stringify({
    entries: entries.map((e) => ({
      method: e.method,
      path: e.path,
      supported: e.supported,
      restricted: e.restricted,
    })),
    summary: {
      supported: supportedCount,
      total,
      percentage: pct,
    },
  }, null, 2)
}

/**
 * 指定フォーマットで出力文字列を生成する
 */
export function formatCompatibility(entries: CompatibilityEntry[], format: CompatOutputFormat): string {
  switch (format) {
    case 'markdown':
      return formatCompatibilityMarkdown(entries)
    case 'json':
      return formatCompatibilityJson(entries)
    default:
      return formatCompatibilityTable(entries)
  }
}

// ─── オーケストレーション ────────────────────────────────────────────────────

/**
 * 対応状況テーブルを表示する
 */
export async function showCompatibility(options: {
  methods?: string[] | null
  showRestricted?: boolean
  format?: CompatOutputFormat
}): Promise<void> {
  const { methods, showRestricted = false, format = 'ascii' } = options

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
  const restrictedFiltered = filterByRestricted(filtered, showRestricted)
  const sorted = sortCompatibilityEntries(restrictedFiltered)
  const output = formatCompatibility(sorted, format)

  console.log(`\n${output}`)
}
