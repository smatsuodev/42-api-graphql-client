import { describe, expect, test } from 'bun:test'
import {
  parseApidocEndpoints,
  normalizeEndpointPath,
  buildCompatibilityTable,
  sortCompatibilityEntries,
  formatCompatibilityTable,
  filterByMethods,
  filterByRestricted,
  formatCompatibilityMarkdown,
  formatCompatibilityJson,
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
      { method: 'GET', path: '/v2/accreditations', restricted: false },
      { method: 'GET', path: '/v2/accreditations/:id', restricted: false },
      { method: 'POST', path: '/v2/accreditations', restricted: false },
      { method: 'DELETE', path: '/v2/accreditations/:id', restricted: false },
      { method: 'GET', path: '/v2/campus', restricted: false },
      { method: 'GET', path: '/v2/campus/:id', restricted: false },
      { method: 'GET', path: '/v2/users', restricted: false },
      { method: 'PATCH', path: '/v2/users/:id', restricted: false },
      { method: 'PUT', path: '/v2/users/:id/update_theme', restricted: false },
    ])
  })

  test('エンドポイントがない HTML の場合は空配列を返す', () => {
    const result = parseApidocEndpoints('<html><body>No endpoints here</body></html>')
    expect(result).toEqual([])
  })

  test('vpn_key を含むエンドポイントを restricted と判定する', () => {
    const html = `
    <div class='resource-item-method'><a>
      <span class='method'>GET</span>
      <span class='url'>/v2/users</span>
    </a></div>
    <div class='resource-item-method'><a>
      <i class='material-icons'>vpn_key</i>
      <span class='method'>GET</span>
      <span class='url'>/v2/secret</span>
    </a></div>
    `
    const result = parseApidocEndpoints(html)
    expect(result).toEqual([
      { method: 'GET', path: '/v2/users', restricted: false },
      { method: 'GET', path: '/v2/secret', restricted: true },
    ])
  })

  test('重複するエンドポイントは除去する', () => {
    const html = `
    <div class='resource-item-method'><a><span class='method'>GET</span><span class='url'>/v2/users</span></a></div>
    <div class='resource-item-method'><a><span class='method'>GET</span><span class='url'>/v2/users</span></a></div>
    <div class='resource-item-method'><a><span class='method'>POST</span><span class='url'>/v2/users</span></a></div>
    `
    const result = parseApidocEndpoints(html)
    expect(result).toEqual([
      { method: 'GET', path: '/v2/users', restricted: false },
      { method: 'POST', path: '/v2/users', restricted: false },
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
      { method: 'GET', path: '/v2/users', restricted: false },
      { method: 'GET', path: '/v2/campus', restricted: false },
    ]
    const openapiPaths: Record<string, Record<string, unknown>> = {
      '/users': { get: { summary: '' } },
    }
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'GET', path: '/campus', supported: false, restricted: false },
    ])
  })

  test('メソッドが異なる場合は supported: false', () => {
    const endpoints = [{ method: 'POST', path: '/v2/users', restricted: false }]
    const openapiPaths: Record<string, Record<string, unknown>> = {
      '/users': { get: { summary: '' } },
    }
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([{ method: 'POST', path: '/users', supported: false, restricted: false }])
  })

  test('パスが存在しない場合は supported: false', () => {
    const endpoints = [{ method: 'GET', path: '/v2/unknown', restricted: false }]
    const openapiPaths: Record<string, Record<string, unknown>> = {}
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([{ method: 'GET', path: '/unknown', supported: false, restricted: false }])
  })

  test('restricted が伝播する', () => {
    const endpoints = [
      { method: 'GET', path: '/v2/users', restricted: true },
    ]
    const openapiPaths: Record<string, Record<string, unknown>> = {
      '/users': { get: { summary: '' } },
    }
    const result = buildCompatibilityTable(endpoints, openapiPaths)
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: true },
    ])
  })
})

// ─── sortCompatibilityEntries ────────────────────────────────────────────────

describe('sortCompatibilityEntries', () => {
  const METHOD_ORDER = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']

  test('パスの辞書順でソートする', () => {
    const entries = [
      { method: 'GET', path: '/users', supported: false, restricted: false },
      { method: 'GET', path: '/campus', supported: false, restricted: false },
      { method: 'GET', path: '/accreditations', supported: false, restricted: false },
    ]
    const result = sortCompatibilityEntries(entries)
    expect(result.map((e) => e.path)).toEqual(['/accreditations', '/campus', '/users'])
  })

  test('同一パス内でメソッド順にソートする', () => {
    const entries = [
      { method: 'DELETE', path: '/users', supported: false, restricted: false },
      { method: 'GET', path: '/users', supported: false, restricted: false },
      { method: 'POST', path: '/users', supported: false, restricted: false },
      { method: 'PATCH', path: '/users', supported: false, restricted: false },
      { method: 'PUT', path: '/users', supported: false, restricted: false },
    ]
    const result = sortCompatibilityEntries(entries)
    expect(result.map((e) => e.method)).toEqual(METHOD_ORDER)
  })
})

// ─── filterByMethods ─────────────────────────────────────────────────────────

describe('filterByMethods', () => {
  const entries = [
    { method: 'GET', path: '/users', supported: true, restricted: false },
    { method: 'POST', path: '/users', supported: false, restricted: false },
    { method: 'GET', path: '/campus', supported: true, restricted: false },
    { method: 'DELETE', path: '/users/{id}', supported: false, restricted: false },
    { method: 'PATCH', path: '/users/{id}', supported: false, restricted: false },
  ]

  test('GET のみフィルタする', () => {
    const result = filterByMethods(entries, ['GET'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'GET', path: '/campus', supported: true, restricted: false },
    ])
  })

  test('複数メソッドでフィルタする', () => {
    const result = filterByMethods(entries, ['GET', 'POST'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'POST', path: '/users', supported: false, restricted: false },
      { method: 'GET', path: '/campus', supported: true, restricted: false },
    ])
  })

  test('空配列の場合は全件を返す', () => {
    const result = filterByMethods(entries, [])
    expect(result).toEqual(entries)
  })

  test('大文字小文字を区別しない', () => {
    const result = filterByMethods(entries, ['get'])
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'GET', path: '/campus', supported: true, restricted: false },
    ])
  })
})

// ─── formatCompatibilityTable ────────────────────────────────────────────────

describe('formatCompatibilityTable', () => {
  test('ボックス形式のテーブルを生成する', () => {
    const entries = [
      { method: 'GET', path: '/campus', supported: true, restricted: false },
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'POST', path: '/users', supported: false, restricted: false },
    ]
    const result = formatCompatibilityTable(entries)
    expect(result).toContain('| Method |')
    expect(result).toContain('| Endpoint |')
    expect(result).toContain('| Compatibility |')
    expect(result).toContain('+')
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
      { method: 'GET', path: '/campus', supported: true, restricted: false },
      { method: 'GET', path: '/users', supported: false, restricted: false },
    ]
    const result = formatCompatibilityTable(entries)
    expect(result).toContain('50.0%')
  })

  test('カラム幅がデータに合わせて調整される', () => {
    const entries = [
      { method: 'GET', path: '/very/long/endpoint/path', supported: true, restricted: false },
    ]
    const result = formatCompatibilityTable(entries)
    const lines = result.split('\n')
    const borderLine = lines[0]!
    const headerLine = lines[1]!
    const dataLine = lines[3]!
    expect(borderLine.length).toBe(headerLine.length)
    expect(borderLine.length).toBe(dataLine.length)
  })
})

// ─── filterByRestricted ──────────────────────────────────────────────────────

describe('filterByRestricted', () => {
  const entries = [
    { method: 'GET', path: '/users', supported: true, restricted: false },
    { method: 'GET', path: '/secret', supported: false, restricted: true },
    { method: 'POST', path: '/campus', supported: false, restricted: false },
  ]

  test('showRestricted が false の場合、restricted を除外する', () => {
    const result = filterByRestricted(entries, false)
    expect(result).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'POST', path: '/campus', supported: false, restricted: false },
    ])
  })

  test('showRestricted が true の場合、全件を返す', () => {
    const result = filterByRestricted(entries, true)
    expect(result).toEqual(entries)
  })
})

// ─── formatCompatibilityMarkdown ─────────────────────────────────────────────

describe('formatCompatibilityMarkdown', () => {
  test('Markdown テーブル形式で出力する', () => {
    const entries = [
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'GET', path: '/secret', supported: false, restricted: true },
    ]
    const result = formatCompatibilityMarkdown(entries)
    expect(result).toContain('| Method | Endpoint | Compatibility |')
    expect(result).toContain('| --- | --- | --- |')
    expect(result).toContain('| GET | /users | ⭕ |')
    expect(result).toContain('| GET | /secret | ❌ |')
    expect(result).toContain('1/2 endpoints covered (50.0%)')
  })

  test('空の場合は 0/0 を表示する', () => {
    const result = formatCompatibilityMarkdown([])
    expect(result).toContain('0/0 endpoints covered')
  })
})

// ─── formatCompatibilityJson ─────────────────────────────────────────────────

describe('formatCompatibilityJson', () => {
  test('JSON 形式で出力する', () => {
    const entries = [
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'POST', path: '/users', supported: false, restricted: true },
    ]
    const result = formatCompatibilityJson(entries)
    const parsed = JSON.parse(result)
    expect(parsed.entries).toEqual([
      { method: 'GET', path: '/users', supported: true, restricted: false },
      { method: 'POST', path: '/users', supported: false, restricted: true },
    ])
    expect(parsed.summary).toEqual({
      supported: 1,
      total: 2,
      percentage: '50.0',
    })
  })

  test('空の場合は 0/0 を出力する', () => {
    const result = formatCompatibilityJson([])
    const parsed = JSON.parse(result)
    expect(parsed.entries).toEqual([])
    expect(parsed.summary.supported).toBe(0)
    expect(parsed.summary.total).toBe(0)
  })
})
