import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { createMinimalOpenApiDoc, readOrCreateOpenApiDoc } from '../openapi'

// ─── テスト用一時ディレクトリ ────────────────────────────────────────────────

const TMP_DIR = resolve(import.meta.dirname, '.tmp-openapi-test')

function tmpPath(name: string): string {
  return resolve(TMP_DIR, name)
}

// テストごとに一時ディレクトリを作成・削除
afterEach(() => {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, { recursive: true })
  }
})

function ensureTmpDir(): void {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true })
  }
}

// ─── createMinimalOpenApiDoc ─────────────────────────────────────────────────

describe('createMinimalOpenApiDoc', () => {
  test('必須フィールドを含む OpenAPI ドキュメントを返す', () => {
    const doc = createMinimalOpenApiDoc()
    expect(doc.openapi).toBe('3.0.0')
    expect(doc.info?.title).toBe('42 API')
    expect(doc.info?.version).toBe('1.0')
    expect(doc.paths).toEqual({})
  })

  test('servers に 42 API の URL を含む', () => {
    const doc = createMinimalOpenApiDoc()
    expect(doc.servers).toHaveLength(1)
    expect(doc.servers![0]!.url).toBe('https://api.intra.42.fr/v2')
  })
})

// ─── readOrCreateOpenApiDoc ──────────────────────────────────────────────────

describe('readOrCreateOpenApiDoc', () => {
  test('ファイルが存在しない場合、新規作成してドキュメントを返す', () => {
    ensureTmpDir()
    const path = tmpPath('new-openapi.yml')
    expect(existsSync(path)).toBe(false)

    const doc = readOrCreateOpenApiDoc(path)

    expect(existsSync(path)).toBe(true)
    expect(doc.openapi).toBe('3.0.0')
    expect(doc.paths).toEqual({})
  })

  test('新規作成されたファイルが有効な YAML である', () => {
    ensureTmpDir()
    const path = tmpPath('valid-yaml.yml')

    readOrCreateOpenApiDoc(path)

    const content = readFileSync(path, 'utf-8')
    const parsed = yaml.load(content) as Record<string, unknown>
    expect(parsed.openapi).toBe('3.0.0')
    expect(parsed.paths).toEqual({})
  })

  test('既存ファイルがある場合はそのまま読み込む', () => {
    ensureTmpDir()
    const path = tmpPath('existing.yml')
    const existingDoc = {
      openapi: '3.0.0',
      info: { title: 'Existing API', version: '2.0' },
      paths: { '/users': { get: { summary: 'Get users' } } },
    }
    writeFileSync(path, yaml.dump(existingDoc))

    const doc = readOrCreateOpenApiDoc(path)

    expect(doc.info?.title).toBe('Existing API')
    expect(doc.paths).toHaveProperty('/users')
  })
})
