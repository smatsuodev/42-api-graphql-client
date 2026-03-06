/**
 * OpenAPI パラメータ定義生成
 *
 * apidoc から抽出したパラメータ情報を OpenAPI パラメータ配列に変換する
 */

import type { ApidocParams } from './apidoc'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface OpenAPIParameter {
  name: string
  in: string
  style?: string
  explode?: boolean
  schema: Record<string, unknown>
}

// ─── パラメータ生成 ──────────────────────────────────────────────────────────

export function buildOpenAPIParameters(
  apidocParams: ApidocParams,
  fieldTypes?: Record<string, string>,
): OpenAPIParameter[] {
  const parameters: OpenAPIParameter[] = []

  // sort
  if (apidocParams.sort.length > 0) {
    const enumValues = [
      ...apidocParams.sort,
      ...apidocParams.sort.map((field) => `-${field}`),
    ]
    parameters.push({
      name: 'sort',
      in: 'query',
      style: 'form',
      explode: false,
      schema: { type: 'array', items: { type: 'string', enum: enumValues } },
    })
  }

  // filter[field]
  for (const field of apidocParams.filter) {
    const fieldType = fieldTypes?.[field] ?? 'string'
    if (fieldType === 'boolean') {
      parameters.push({
        name: `filter[${field}]`,
        in: 'query',
        schema: { type: 'boolean' },
      })
    } else {
      parameters.push({
        name: `filter[${field}]`,
        in: 'query',
        style: 'form',
        explode: false,
        schema: { type: 'array', items: { type: fieldType } },
      })
    }
  }

  // range[field]
  for (const field of apidocParams.range) {
    parameters.push({
      name: `range[${field}]`,
      in: 'query',
      schema: { type: 'string' },
    })
  }

  // page[number], page[size]
  if (apidocParams.hasPage) {
    parameters.push({
      name: 'page[number]',
      in: 'query',
      schema: { type: 'integer' },
    })
    parameters.push({
      name: 'page[size]',
      in: 'query',
      schema: { type: 'integer' },
    })
  }

  return parameters
}

// ─── レスポンススキーマからフィールド型マップ抽出 ────────────────────────────

export function extractFieldTypes(responseSchema: Record<string, unknown>): Record<string, string> {
  let properties: Record<string, Record<string, unknown>> | undefined

  if (responseSchema.type === 'array' && responseSchema.items) {
    const items = responseSchema.items as Record<string, unknown>
    properties = items.properties as Record<string, Record<string, unknown>> | undefined
  } else if (responseSchema.type === 'object') {
    properties = responseSchema.properties as Record<string, Record<string, unknown>> | undefined
  }

  if (!properties) return {}

  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(properties)) {
    const t = val.type as string | undefined
    if (t && t !== 'object' && t !== 'array') {
      result[key] = t
    }
  }
  return result
}
