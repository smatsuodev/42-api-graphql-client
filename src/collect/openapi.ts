/**
 * openapi.yml 読み書きユーティリティ
 *
 * openapi.yml が存在しない場合、最小限の OpenAPI 3.0 ドキュメントを自動生成する
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'

// ─── 定数 ────────────────────────────────────────────────────────────────────

export const OPENAPI_PATH = resolve(import.meta.dirname, '..', '..', 'openapi.yml')

export const YAML_DUMP_OPTIONS: yaml.DumpOptions = {
  lineWidth: -1,
  noRefs: true,
  quotingType: "'",
  forceQuotes: false,
}

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface OpenAPIDocument {
  openapi?: string
  info?: { title?: string; version?: string; [key: string]: unknown }
  tags?: unknown[]
  paths?: Record<string, Record<string, unknown>>
  components?: unknown
  servers?: { url?: string; [key: string]: unknown }[]
  [key: string]: unknown
}

// ─── ユーティリティ ──────────────────────────────────────────────────────────

/**
 * 新規 OpenAPI 3.0 ドキュメントの最小テンプレートを返す
 */
export function createMinimalOpenApiDoc(): OpenAPIDocument {
  return {
    openapi: '3.0.0',
    info: {
      title: '42 API',
      version: '1.0',
    },
    servers: [{ url: 'https://api.intra.42.fr/v2' }],
    paths: {},
  }
}

/**
 * openapi.yml を読み込む。ファイルが存在しない場合は最小テンプレートを生成して書き出す。
 */
export function readOrCreateOpenApiDoc(path: string = OPENAPI_PATH): OpenAPIDocument {
  if (!existsSync(path)) {
    console.log(`openapi.yml が見つかりません。新規作成します: ${path}`)
    const doc = createMinimalOpenApiDoc()
    const output = yaml.dump(doc, YAML_DUMP_OPTIONS)
    writeFileSync(path, output)
    return doc
  }

  const content = readFileSync(path, 'utf-8')
  return yaml.load(content) as OpenAPIDocument
}
