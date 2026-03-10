import { describe, expect, test } from 'bun:test'
import {
  parseApidocEndpoints,
  normalizeEndpointPath,
  buildCompatibilityTable,
  sortCompatibilityEntries,
  formatCompatibilityTable,
  filterByMethods,
} from '../compatibility'

// ─── テスト用HTMLフィクスチャ ─────────────────────────────────────────────────

const SAMPLE_APIDOC_HTML = `
<html><body>
<div class='resource-item-method'><a href='#'>
  <span class='method'>GET</span>
  <span class='url'>/v2/accreditations</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>GET</span>
  <span class='url'>/v2/accreditations/:id</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>POST</span>
  <span class='url'>/v2/accreditations</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>DELETE</span>
  <span class='url'>/v2/accreditations/:id</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>GET</span>
  <span class='url'>/v2/campus</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>GET</span>
  <span class='url'>/v2/campus/:id</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>GET</span>
  <span class='url'>/v2/users</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>PATCH</span>
  <span class='url'>/v2/users/:id</span>
</a></div>
<div class='resource-item-method'><a href='#'>
  <span class='method'>PUT</span>
  <span class='url'>/v2/users/:id/update_theme</span>
</a></div>
</body></html>
`

// ─── parseApidocEndpoints ─────────────────────────────────────────────────────

describe('parseApidocEndpoints', () => {
  test('HTML からエンドポイント一覧を抽出する', () => {
    const result = parseApidocEndpoints(SAMPLE_APIDOC_HTML)
    expect(result).toEqual([
      { method: 'GET', path: '/v2/accreditations' },
      { method: 'GET', path: '/v2/accreditations/:id' },
      { method: 'POST', path: '/v2/accreditations' },
      { method: 'DELETE', path: '/v2/accreditations/:id' },
      { method: 'GET', path: '/v2/campus' },
      { method: 'GET', path: '/v2/campus/:id' },
      { method: 'GET', path: '/v2/users' },
      { method: 'PATCH', path: '/v2/users/:id' },
      { method: 'PUT', path: '/v2/users/:id/update_theme' },
    ])
  })

  test('エンドポイントがない HTML の場合は空配列を返す', () => {
    const result = parseApidocEndpoints('<html><body>No endpoints here</body></html>')
    expect(result).toEqual([])
  })

  test('重複するエンドポイントは除去する', () => {
    const html = `
    <div class='resource-item-method'><a><span class='method'>GET</span><span class='url'>/v2/users</span></a></div>
    <div class='resource-item-method'><a><span class='method'>GET</span><span class='url'>/v2/users</span></a></div>
    <div class='resource-item-method'><a><span class='method'>POST</span><span class='url'>/v2/users</span></a></div>
    `
    const result = parseApidocEndpoints(html)
    expect(result).toEqual([
      { method: 'GET', path: '/v2/users' },
      { method: 'POST', path: '/v2/users' },
    ])
  })
})

// ─── normalizeEndpointPath ───────────────────────────────────────────────────

describe('normalizeEndpointPath', () => {
  test('/v2 プレフィックスを除去する', () => {
    expect(normalizeEndpointPath('/v2/users')).toBe('/users')
  })

  test('/v2 プレフィックスがないパスはそのまま返す', () => {
    expect(normalizeEndpointPath('/users')).toBe('/users')
  })

  test('ネストしたパスの /v2 を除去する', () => {
    expect(normalizeEndpointPath('/v2/users/:id/projects')).toBe('/users/{id}/projects')
  })

  test(':id パラメータを {id} に変換する', () => {
    expect(normalizeEndpointPath('/v2/users/:id')).toBe('/users/{id}')
  })

  test('複数のパスパラメータを変換する', () => {
    expect(normalizeEndpointPath('/v2/users/:user_id/projects/:id')).toBe(
      '/users/{user_id}/projects/{id}',
    )
  })
})

// ─── buildCompatibilityTable ─────────────────────────────────────────────────

describe('buildCompatibilityTable', () => {
  test('対応済みエンドポイントに supported: true を設定する', () => {
    const endpoints = [
      { method: 'GET', path: '/v2/users' },
      { method: 'GET', path: '/v2/campus' },
    ]
    const openapiPaths: Record<string, Record<string, unknown>> = {
      '/users': { get: { summary: '' } },
    }
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true },
      { method: 'GET', path: '/campus', supported: false },
    ])
  })

  test('メソッドが異なる場合は supported: false', () => {
    const endpoints = [{ method: 'POST', path: '/v2/users' }]
    const openapiPaths: Record<string, Record<string, unknown>> = {
      '/users': { get: { summary: '' } },
    }
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([{ method: 'POST', path: '/users', supported: false }])
  })

  test('パスが存在しない場合は supported: false', () => {
    const endpoints = [{ method: 'GET', path: '/v2/unknown' }]
    const openapiPaths: Record<string, Record<string, unknown>> = {}
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([{ method: 'GET', path: '/unknown', supported: false }])
  })
})

// ─── sortCompatibilityEntries ────────────────────────────────────────────────

describe('sortCompatibilityEntries', () => {
  const METHOD_ORDER = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

  test('パスの辞書順でソートする', () => {
    const entries = [
      { method: 'GET', path: '/users', supported: false },
      { method: 'GET', path: '/campus', supported: false },
      { method: 'GET', path: '/accreditations', supported: false },
    ]
    const result = sortCompatibilityEntries(entries)
    expect(result.map((e) => e.path)).toEqual(['/accreditations', '/campus', '/users'])
  })

  test('同一パス内でメソッド順にソートする', () => {
    const entries = [
      { method: 'DELETE', path: '/users', supported: false },
      { method: 'GET', path: '/users', supported: false },
      { method: 'POST', path: '/users', supported: false },
      { method: 'PATCH', path: '/users', supported: false },
      { method: 'PUT', path: '/users', supported: false },
    ]
    const result = sortCompatibilityEntries(entries)
    expect(result.map((e) => e.method)).toEqual(METHOD_ORDER)
  })
})

// ─── filterByMethods ─────────────────────────────────────────────────────────

describe('filterByMethods', () => {
  const entries = [
    { method: 'GET', path: '/users', supported: true },
    { method: 'POST', path: '/users', supported: false },
    { method: 'GET', path: '/campus', supported: true },
    { method: 'DELETE', path: '/users/{id}', supported: false },
    { method: 'PATCH', path: '/users/{id}', supported: false },
  ]

  test('GET のみフィルタする', () => {
    const result = filterByMethods(entries, ['GET'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true },
      { method: 'GET', path: '/campus', supported: true },
    ])
  })

  test('複数メソッドでフィルタする', () => {
    const result = filterByMethods(entries, ['GET', 'POST'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true },
      { method: 'POST', path: '/users', supported: false },
      { method: 'GET', path: '/campus', supported: true },
    ])
  })

  test('空配列の場合は全件を返す', () => {
    const result = filterByMethods(entries, [])
    expect(result).toEqual(entries)
  })

  test('大文字小文字を区別しない', () => {
    const result = filterByMethods(entries, ['get'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true },
      { method: 'GET', path: '/campus', supported: true },
    ])
  })
})

// ─── formatCompatibilityTable ────────────────────────────────────────────────

describe('formatCompatibilityTable', () => {
  test('テーブルとサマリーを含む文字列を生成する', () => {
    const entries = [
      { method: 'GET', path: '/campus', supported: true },
      { method: 'GET', path: '/users', supported: true },
      { method: 'POST', path: '/users', supported: false },
    ]
    const result = formatCompatibilityTable(entries)
    expect(result).toContain('METHOD')
    expect(result).toContain('ENDPOINT')
    expect(result).toContain('COMPATIBILITY')
    expect(result).toContain('⭕')
    expect(result).toContain('❌')
    expect(result).toContain('2/3 endpoints covered')
  })

  test('空の場合は 0/0 を表示する', () => {
    const result = formatCompatibilityTable([])
    expect(result).toContain('0/0 endpoints covered')
  })

  test('パーセンテージを表示する', () => {
    const entries = [
      { method: 'GET', path: '/campus', supported: true },
      { method: 'GET', path: '/users', supported: false },
    ]
    const result = formatCompatibilityTable(entries)
    expect(result).toContain('50.0%')
  })
})
