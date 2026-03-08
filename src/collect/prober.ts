/**
 * Probe-based nullable detection
 *
 * 42 API の `filter[field]=null` を使って各フィールドの nullability を 1 リクエストで判定する。
 * - 結果が返る → nullable
 * - 空配列 → non-nullable
 * - エラー → failedFields に記録
 */

import { fetchEndpoint } from './fetcher'

export interface ProbeResult {
  nullableFields: Set<string>
  nonNullableFields: Set<string>
  probeItems: Record<string, unknown>[]
  failedFields: string[]
}

// ─── Boolean フィールド判定 ──────────────────────────────────────────────────

export function isBooleanLikeField(field: string): boolean {
  return field.endsWith('?') || field.startsWith('is_')
}

export interface BooleanProbeResult {
  probeItems: Record<string, unknown>[]
  failedFields: string[]
  probedFieldCount: number
}

export async function probeBooleanFields(
  endpoint: string,
  booleanFields: string[],
  seenIds: Set<unknown> = new Set(),
): Promise<BooleanProbeResult> {
  const failedFields: string[] = []
  const probeItems: Record<string, unknown>[] = []

  for (const field of booleanFields) {
    let fieldFailed = false

    for (const value of ['true', 'false']) {
      const params = new Map([
        [`filter[${field}]`, value],
        ['page[size]', '5'],
      ])

      console.log(`[probe:bool] filter[${field}]=${value} をプローブ中...`)
      const result = await fetchEndpoint(endpoint, params)

      if (result === null) {
        console.warn(`[probe:bool] ${field}=${value}: リクエスト失敗`)
        if (!fieldFailed) {
          failedFields.push(field)
          fieldFailed = true
        }
        continue
      }

      for (const item of result) {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>
          const id = record.id
          if (id !== undefined && seenIds.has(id)) continue
          if (id !== undefined) seenIds.add(id)
          probeItems.push(record)
        }
      }
    }
  }

  return { probeItems, failedFields, probedFieldCount: booleanFields.length }
}

// ─── Nullable probe ─────────────────────────────────────────────────────────

export async function probeNullableFields(
  endpoint: string,
  filterFields: string[],
): Promise<ProbeResult> {
  const nullableFields = new Set<string>()
  const nonNullableFields = new Set<string>()
  const failedFields: string[] = []
  const seenIds = new Set<unknown>()
  const probeItems: Record<string, unknown>[] = []

  for (const field of filterFields) {
    const params = new Map([
      [`filter[${field}]`, 'null'],
      ['page[size]', '1'],
    ])

    console.log(`[probe] filter[${field}]=null をプローブ中...`)
    const result = await fetchEndpoint(endpoint, params)

    if (result === null) {
      console.warn(`[probe] ${field}: リクエスト失敗`)
      failedFields.push(field)
      continue
    }

    if (result.length > 0) {
      console.log(`[probe] ${field}: nullable (${result.length} 件)`)
      nullableFields.add(field)

      for (const item of result) {
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const record = item as Record<string, unknown>
          const id = record.id
          if (id !== undefined && seenIds.has(id)) continue
          if (id !== undefined) seenIds.add(id)
          probeItems.push(record)
        }
      }
    } else {
      console.log(`[probe] ${field}: non-nullable`)
      nonNullableFields.add(field)
    }
  }

  return { nullableFields, nonNullableFields, probeItems, failedFields }
}
