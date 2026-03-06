/**
 * apidoc HTML パーサー
 *
 * 42 API の apidoc ページから sort / filter / range / page パラメータ情報を抽出する
 */

import { parse as parseHtml } from 'node-html-parser'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface ApidocParams {
  sort: string[]
  filter: string[]
  range: string[]
  hasPage: boolean
}

// ─── URL 構築 ─────────────────────────────────────────────────────────────────

const APIDOC_BASE = 'https://api.intra.42.fr/apidoc/2.0'

export function buildApidocUrl(endpoint: string): string {
  return `${APIDOC_BASE}/${endpoint}/index.html`
}

// ─── HTML パース ──────────────────────────────────────────────────────────────

/**
 * apidoc HTML をパースしてパラメータ情報を抽出する
 */
export function parseApidocHtml(html: string): ApidocParams {
  const root = parseHtml(html)

  // パラメータテーブルの各行を取得
  const rows = root.querySelectorAll('#method-params table.table tbody tr')

  let sort: string[] = []
  let filter: string[] = []
  let range: string[] = []
  let hasPage = false

  for (const row of rows) {
    const paramName = row.querySelector('td strong')?.text.trim()
    if (!paramName) continue

    if (paramName === 'sort') {
      sort = extractCodeValues(row)
    } else if (paramName === 'filter') {
      filter = extractCodeValues(row)
    } else if (paramName === 'range') {
      range = extractCodeValues(row)
    } else if (paramName === 'page[number]' || paramName === 'page[size]') {
      hasPage = true
    }
  }

  return { sort, filter, range, hasPage }
}

/**
 * テーブル行から "Must be one of: <code>...</code>" のコード値を抽出する
 */
function extractCodeValues(row: ReturnType<ReturnType<typeof parseHtml>['querySelector']>): string[] {
  if (!row) return []
  const codes = row.querySelectorAll('td:nth-child(2) > span code')
  return codes.map((code) => code.text.trim()).filter(Boolean)
}

// ─── フェッチ + パース ────────────────────────────────────────────────────────

/**
 * apidoc ページをフェッチしてパラメータ情報を取得する
 */
export async function fetchApidocParams(endpoint: string): Promise<ApidocParams> {
  const url = buildApidocUrl(endpoint)
  console.log(`[apidoc] フェッチ中: ${url}`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`apidoc フェッチ失敗: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  return parseApidocHtml(html)
}
