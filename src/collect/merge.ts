/**
 * OpenAPI スキーマのディープマージ
 *
 * 既存値を優先し、新規フィールドのみ incoming で補完する
 */

interface OpenAPISchema {
  type?: string
  nullable?: boolean
  items?: OpenAPISchema
  properties?: Record<string, OpenAPISchema>
  required?: string[]
  [key: string]: unknown
}

/**
 * 既存スキーマを優先しつつ incoming で補完するディープマージ
 */
export function mergeOpenAPISchema(existing: OpenAPISchema, incoming: OpenAPISchema): OpenAPISchema {
  const result: OpenAPISchema = { ...existing }

  // リーフ値: 既存が未定義の場合のみ incoming で補完
  for (const key of Object.keys(incoming)) {
    if (key === 'properties' || key === 'required' || key === 'items') continue
    if (!(key in result)) {
      result[key] = incoming[key]
    }
  }

  // properties: 再帰マージ
  if (existing.properties || incoming.properties) {
    const existingProps = existing.properties ?? {}
    const incomingProps = incoming.properties ?? {}
    const mergedProps: Record<string, OpenAPISchema> = {}

    const allKeys = new Set([...Object.keys(existingProps), ...Object.keys(incomingProps)])
    for (const key of allKeys) {
      if (key in existingProps && key in incomingProps) {
        mergedProps[key] = mergeOpenAPISchema(existingProps[key]!, incomingProps[key]!)
      } else if (key in existingProps) {
        mergedProps[key] = existingProps[key]!
      } else {
        mergedProps[key] = incomingProps[key]!
      }
    }

    result.properties = mergedProps
  }

  // required: 既存を保持し、新規プロパティのみ incoming から引き継ぐ
  if (existing.required || incoming.required) {
    const existingProps = existing.properties ?? {}
    const existingRequired = existing.required ?? []
    const incomingRequired = new Set(incoming.required ?? [])

    const merged = [...existingRequired]
    // 新規プロパティ（既存 properties に無かったキー）の required を引き継ぐ
    for (const key of incomingRequired) {
      if (!(key in existingProps) && !merged.includes(key)) {
        merged.push(key)
      }
    }

    result.required = merged
  }

  // items: 空 {} なら incoming で置換、非空なら再帰マージ
  if (existing.items !== undefined || incoming.items !== undefined) {
    const existingItems = existing.items
    const incomingItems = incoming.items

    if (!existingItems || Object.keys(existingItems).length === 0) {
      result.items = incomingItems
    } else if (incomingItems) {
      result.items = mergeOpenAPISchema(existingItems, incomingItems)
    } else {
      result.items = existingItems
    }
  }

  return result
}

/**
 * パラメータの name ベースマージ。同名は既存を保持、新規のみ追加。
 */
export function mergeParameters(
  existing: Record<string, unknown>[],
  incoming: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (existing.length === 0) return incoming

  const existingNames = new Set(existing.map((p) => p.name))
  const newParams = incoming.filter((p) => !existingNames.has(p.name))

  return [...existing, ...newParams]
}
