/**
 * filter[*] クエリパラメータ修正
 *
 * 42 API の filter パラメータはカンマ区切りで複数値を受け付けるが、
 * OpenAPI スキーマ生成ツールが以下のように誤った定義を出力することがある:
 *   - スカラー型 (type: integer) のまま定義される（配列であるべき）
 *   - style/explode が schema 内に配置される（パラメータレベルであるべき）
 *
 * filter[*] にマッチするクエリパラメータに対して:
 *   1. スカラー integer/number/string を type: array, items: { type: ... } に変換
 *   2. schema 内の style/explode を削除
 *   3. パラメータレベルに style: form, explode: false を設定
 */

import { writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { OPENAPI_PATH, YAML_DUMP_OPTIONS, readOrCreateOpenApiDoc } from './openapi'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const FILTER_PARAM_PATTERN = /^filter\[.+]$/

// スカラー → 配列に変換する対象の型
const SCALAR_TO_ARRAY_TYPES = new Set(['integer', 'number', 'string'])

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface Schema {
  type?: string
  items?: { type?: string }
  style?: string
  explode?: boolean
  [key: string]: unknown
}

interface OpenAPIParameter {
  name: string
  in: string
  style?: string
  explode?: boolean
  schema?: Schema
  [key: string]: unknown
}

interface OpenAPIOperation {
  parameters?: OpenAPIParameter[]
  [key: string]: unknown
}

interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation
}

interface OpenAPIDocument {
  paths?: Record<string, OpenAPIPathItem>
  [key: string]: unknown
}

// ─── 修正ロジック ────────────────────────────────────────────────────────────

export function fixFilterParams(doc: OpenAPIDocument): number {
  let fixedCount = 0

  if (!doc.paths) return fixedCount

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OpenAPIOperation | undefined
      if (!operation?.parameters) continue

      for (const param of operation.parameters) {
        if (param.in !== 'query') continue
        if (!FILTER_PARAM_PATTERN.test(param.name)) continue
        if (!param.schema) continue

        const schemaType = param.schema.type
        let changed = false

        // 1. スカラー型 (integer/number/string) を配列型に変換
        if (schemaType && SCALAR_TO_ARRAY_TYPES.has(schemaType)) {
          param.schema = {
            type: 'array',
            items: { type: schemaType },
          }
          changed = true
        }

        // 配列型でない場合はスキップ
        if (param.schema.type !== 'array') continue

        // 2. schema 内の style/explode を削除
        if (param.schema.style != null) {
          delete param.schema.style
          changed = true
        }
        if (param.schema.explode != null) {
          delete param.schema.explode
          changed = true
        }

        // 3. パラメータレベルに style: form, explode: false を設定
        if (param.style !== 'form') {
          param.style = 'form'
          changed = true
        }
        if (param.explode !== false) {
          param.explode = false
          changed = true
        }

        if (changed) {
          fixedCount++
          console.log(`  fixed: ${path} ${method.toUpperCase()} - ${param.name}`)
        }
      }
    }
  }

  return fixedCount
}

// ─── 公開関数 ────────────────────────────────────────────────────────────────

/**
 * openapi.yml の filter パラメータを修正する
 */
export function fixFilters(): void {
  const doc = readOrCreateOpenApiDoc() as OpenAPIDocument

  console.log(`\n=== filter パラメータ修正 ===`)
  const fixedCount = fixFilterParams(doc)

  if (fixedCount > 0) {
    const output = yaml.dump(doc, YAML_DUMP_OPTIONS)
    writeFileSync(OPENAPI_PATH, output)
    console.log(`Done: ${fixedCount} parameter(s) fixed`)
  } else {
    console.log('No parameters needed fixing')
  }
}
