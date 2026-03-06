/**
 * collect-responses.ts の出力 (full.json / nullable.json) を元に
 * openapi.yml のレスポンススキーマを自動生成・更新するスクリプト
 *
 * Usage:
 *   bun scripts/update-schema.ts [--method <METHOD>] <endpoint-path> <full.json> [nullable.json]
 *
 * 例:
 *   bun scripts/update-schema.ts /cursus scripts/output/cursus_full.json scripts/output/cursus_nullable.json
 *   bun scripts/update-schema.ts --method GET /users/{id} scripts/output/users_full.json
 *   bun scripts/update-schema.ts /project_sessions scripts/output/project_sessions_full.json scripts/output/project_sessions_nullable.json
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { readOrCreateOpenApiDoc } from '../src/collect/openapi'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const OPENAPI_PATH = resolve(import.meta.dirname, '..', 'openapi.yml')

const YAML_DUMP_OPTIONS: yaml.DumpOptions = {
  lineWidth: -1,
  noRefs: true,
  quotingType: "'",
  forceQuotes: false,
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']

// ─── 型定義 ──────────────────────────────────────────────────────────────────

interface OpenAPISchema {
  type?: string
  nullable?: boolean
  items?: OpenAPISchema
  properties?: Record<string, OpenAPISchema>
  required?: string[]
  [key: string]: unknown
}

interface OpenAPIOperation {
  summary?: string
  deprecated?: boolean
  description?: string
  operationId?: string
  tags?: string[]
  parameters?: unknown[]
  responses?: Record<string, OpenAPIResponse>
  security?: unknown[]
  [key: string]: unknown
}

interface OpenAPIResponse {
  description?: string
  content?: {
    'application/json'?: {
      schema?: OpenAPISchema
      example?: unknown
    }
    [contentType: string]: unknown
  }
  headers?: Record<string, unknown>
  [key: string]: unknown
}

interface OpenAPIPathItem {
  [method: string]: OpenAPIOperation
}

interface OpenAPIDocument {
  openapi?: string
  info?: unknown
  tags?: unknown[]
  paths?: Record<string, OpenAPIPathItem>
  components?: unknown
  servers?: unknown[]
  [key: string]: unknown
}

// ─── 型推論エンジン ──────────────────────────────────────────────────────────

/**
 * JS の値から OpenAPI スキーマを再帰的に推論する
 *
 * @param fullValue    _full.json 側の値 (非 null が期待される)
 * @param nullableValue _nullable.json 側の値 (null なら nullable: true)
 */
function inferSchema(fullValue: unknown, nullableValue?: unknown): OpenAPISchema {
  // nullable 判定: nullableValue が明示的に null の場合
  const isNullable = nullableValue === null && fullValue !== null

  // fullValue が null の場合 (nullable.json が無い、または両方 null)
  if (fullValue === null || fullValue === undefined) {
    // nullableValue から型推論を試みる
    if (nullableValue !== null && nullableValue !== undefined) {
      return inferSchema(nullableValue)
    }
    // 両方 null — 型不明
    return { type: 'null' }
  }

  // プリミティブ型
  if (typeof fullValue === 'boolean') {
    const schema: OpenAPISchema = { type: 'boolean' }
    if (isNullable) schema.nullable = true
    return schema
  }

  if (typeof fullValue === 'number') {
    const schema: OpenAPISchema = {
      type: Number.isInteger(fullValue) ? 'integer' : 'number',
    }
    if (isNullable) schema.nullable = true
    return schema
  }

  if (typeof fullValue === 'string') {
    const schema: OpenAPISchema = { type: 'string' }
    if (isNullable) schema.nullable = true
    return schema
  }

  // 配列
  if (Array.isArray(fullValue)) {
    const schema: OpenAPISchema = { type: 'array' }
    if (isNullable) schema.nullable = true

    if (fullValue.length > 0) {
      // 配列の先頭要素で items を推論
      const fullItem = fullValue[0]
      // nullable 側が配列で要素があればそこからも推論
      const nullableItem =
        Array.isArray(nullableValue) && nullableValue.length > 0 ? nullableValue[0] : undefined
      schema.items = inferSchema(fullItem, nullableItem)
    } else {
      // 空配列 — items の型が不明
      schema.items = {}
    }

    return schema
  }

  // オブジェクト
  if (typeof fullValue === 'object') {
    const fullObj = fullValue as Record<string, unknown>
    const nullableObj =
      nullableValue !== null && typeof nullableValue === 'object' && !Array.isArray(nullableValue)
        ? (nullableValue as Record<string, unknown>)
        : undefined

    const schema: OpenAPISchema = { type: 'object' }
    if (isNullable) schema.nullable = true

    const properties: Record<string, OpenAPISchema> = {}
    const required: string[] = []

    // full のキーを基準にする (full は全フィールドが含まれているはず)
    const allKeys = new Set([
      ...Object.keys(fullObj),
      ...(nullableObj ? Object.keys(nullableObj) : []),
    ])

    for (const key of allKeys) {
      const fv = key in fullObj ? fullObj[key] : undefined
      const nv = nullableObj && key in nullableObj ? nullableObj[key] : undefined

      properties[key] = inferSchema(fv, nv)
      required.push(key)
    }

    if (Object.keys(properties).length > 0) {
      schema.properties = properties
    }
    if (required.length > 0) {
      schema.required = required
    }

    return schema
  }

  return {}
}

// ─── OpenAPI ドキュメント更新 ────────────────────────────────────────────────

function buildResponseSchema(fullJson: unknown, nullableJson?: unknown): OpenAPISchema {
  return inferSchema(fullJson, nullableJson)
}

function updateOpenAPIDocument(
  doc: OpenAPIDocument,
  endpointPath: string,
  method: string,
  schema: OpenAPISchema,
): { action: 'created' | 'updated' } {
  if (!doc.paths) {
    doc.paths = {}
  }

  const methodLower = method.toLowerCase()
  let action: 'created' | 'updated'

  if (doc.paths[endpointPath]) {
    // 既存パス
    const pathItem = doc.paths[endpointPath]

    if (pathItem[methodLower]) {
      // 既存メソッド — レスポンススキーマのみ更新 (parameters 等は保持)
      action = 'updated'
      const operation = pathItem[methodLower] as OpenAPIOperation

      if (!operation.responses) {
        operation.responses = {}
      }

      if (!operation.responses['200']) {
        operation.responses['200'] = {
          description: '',
          headers: {},
        }
      }

      const response200 = operation.responses['200']
      if (!response200.content) {
        response200.content = {}
      }
      response200.content['application/json'] = {
        schema,
      }
    } else {
      // パスは存在するが、メソッドが無い — 新規メソッド追加
      action = 'created'
      pathItem[methodLower] = createNewOperation(schema)
    }
  } else {
    // 新規パス
    action = 'created'
    doc.paths[endpointPath] = {
      [methodLower]: createNewOperation(schema),
    }
  }

  return { action }
}

function createNewOperation(schema: OpenAPISchema): OpenAPIOperation {
  return {
    summary: '',
    deprecated: false,
    description: '',
    tags: [],
    parameters: [],
    responses: {
      '200': {
        description: '',
        content: {
          'application/json': {
            schema,
          },
        },
        headers: {},
      },
    },
    security: [],
  }
}

// ─── スキーマ統計 ────────────────────────────────────────────────────────────

interface SchemaStats {
  totalFields: number
  nullableFields: number
  objectFields: number
  arrayFields: number
}

function countSchemaStats(schema: OpenAPISchema, stats?: SchemaStats): SchemaStats {
  if (!stats) {
    stats = { totalFields: 0, nullableFields: 0, objectFields: 0, arrayFields: 0 }
  }

  if (schema.properties) {
    for (const [, propSchema] of Object.entries(schema.properties)) {
      stats.totalFields++
      if (propSchema.nullable) stats.nullableFields++
      if (propSchema.type === 'object') stats.objectFields++
      if (propSchema.type === 'array') stats.arrayFields++

      // 再帰
      if (propSchema.properties) {
        countSchemaStats(propSchema, stats)
      }
      if (propSchema.items) {
        countSchemaStats(propSchema.items, stats)
      }
    }
  }

  return stats
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function printUsage(): void {
  console.log(`Usage: bun scripts/update-schema.ts [--method <METHOD>] <endpoint-path> <full.json> [nullable.json]

collect-responses.ts の出力を元に openapi.yml のレスポンススキーマを更新します。

引数:
  endpoint-path   OpenAPI のパス (例: /cursus, /users/{id}, /project_sessions)
  full.json       全フィールドに非 null 値が入った JSON ファイル
  nullable.json   nullable フィールドに null が入った JSON ファイル (省略可能)

オプション:
  --method        HTTP メソッド (デフォルト: GET)
  --dry-run       実際にファイルを書き換えず、生成されるスキーマのみ表示
  --help, -h      このヘルプを表示

例:
  bun scripts/update-schema.ts /cursus scripts/output/cursus_full.json scripts/output/cursus_nullable.json
  bun scripts/update-schema.ts --method POST /users scripts/output/users_full.json
  bun scripts/update-schema.ts --dry-run /campus scripts/output/campus_full.json scripts/output/campus_nullable.json`)
}

interface ParsedArgs {
  method: string
  endpointPath: string
  fullJsonPath: string
  nullableJsonPath: string | null
  dryRun: boolean
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage()
    process.exit(0)
  }

  let method = 'GET'
  let dryRun = false
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--method' && args[i + 1]) {
      method = args[i + 1]!.toUpperCase()
      if (!HTTP_METHODS.includes(method.toLowerCase())) {
        console.error(`エラー: 不正な HTTP メソッド: ${method}`)
        process.exit(1)
      }
      i++
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg.startsWith('-')) {
      console.error(`エラー: 不明なオプション: ${arg}`)
      process.exit(1)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length < 2) {
    console.error('エラー: endpoint-path と full.json は必須です。')
    printUsage()
    process.exit(1)
  }

  const endpointPath = positional[0]!.startsWith('/') ? positional[0]! : `/${positional[0]!}`
  const fullJsonPath = positional[1]!
  const nullableJsonPath = positional[2] ?? null

  return { method, endpointPath, fullJsonPath, nullableJsonPath, dryRun }
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────

function main(): void {
  const { method, endpointPath, fullJsonPath, nullableJsonPath, dryRun } = parseArgs()

  console.log(`\n=== OpenAPI スキーマ更新 ===`)
  console.log(`エンドポイント: ${method} ${endpointPath}`)
  console.log(`full.json:     ${fullJsonPath}`)
  console.log(`nullable.json: ${nullableJsonPath ?? '(なし)'}`)
  console.log(`dry-run:       ${dryRun}`)
  console.log()

  // 入力 JSON の読み込み
  let fullJson: unknown
  try {
    fullJson = JSON.parse(readFileSync(fullJsonPath, 'utf-8'))
  } catch (err) {
    console.error(`エラー: full.json の読み込みに失敗: ${fullJsonPath}`)
    console.error(err)
    process.exit(1)
  }

  let nullableJson: unknown = undefined
  if (nullableJsonPath) {
    try {
      nullableJson = JSON.parse(readFileSync(nullableJsonPath, 'utf-8'))
    } catch (err) {
      console.error(`エラー: nullable.json の読み込みに失敗: ${nullableJsonPath}`)
      console.error(err)
      process.exit(1)
    }
  }

  // スキーマ推論
  console.log('スキーマを推論中...')
  const schema = buildResponseSchema(fullJson, nullableJson)

  // 統計表示
  const stats = countSchemaStats(schema)
  // トップが array の場合は items の中身も数える
  if (schema.type === 'array' && schema.items) {
    const itemStats = countSchemaStats(schema.items)
    stats.totalFields += itemStats.totalFields
    stats.nullableFields += itemStats.nullableFields
    stats.objectFields += itemStats.objectFields
    stats.arrayFields += itemStats.arrayFields
  }

  console.log(`  フィールド数: ${stats.totalFields}`)
  console.log(`  nullable:    ${stats.nullableFields}`)
  console.log(`  object:      ${stats.objectFields}`)
  console.log(`  array:       ${stats.arrayFields}`)
  console.log()

  if (dryRun) {
    console.log('--- 生成されるスキーマ (YAML) ---')
    console.log(yaml.dump({ schema }, YAML_DUMP_OPTIONS))
    console.log('--- dry-run のため openapi.yml は更新しません ---')
    return
  }

  // openapi.yml の読み込み (存在しなければ自動生成)
  const doc = readOrCreateOpenApiDoc(OPENAPI_PATH) as OpenAPIDocument

  // 更新
  const { action } = updateOpenAPIDocument(doc, endpointPath, method, schema)

  // 書き出し
  const output = yaml.dump(doc, YAML_DUMP_OPTIONS)
  writeFileSync(OPENAPI_PATH, output)

  console.log(
    `openapi.yml を${action === 'created' ? '新規作成' : '更新'}しました: ${method} ${endpointPath}`,
  )
  console.log('完了！')
}

main()
