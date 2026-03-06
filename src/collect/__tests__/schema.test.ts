import { describe, expect, test } from 'bun:test'
import { buildResponseSchema } from '../schema'

// ─── プリミティブ型の推論 ────────────────────────────────────────────────────

describe('buildResponseSchema - プリミティブ型', () => {
  test('文字列からstringスキーマを推論する', () => {
    const schema = buildResponseSchema('hello')
    expect(schema.type).toBe('string')
    expect(schema.nullable).toBeUndefined()
  })

  test('整数からintegerスキーマを推論する', () => {
    const schema = buildResponseSchema(42)
    expect(schema.type).toBe('integer')
  })

  test('小数からnumberスキーマを推論する', () => {
    const schema = buildResponseSchema(3.14)
    expect(schema.type).toBe('number')
  })

  test('真偽値からbooleanスキーマを推論する', () => {
    const schema = buildResponseSchema(true)
    expect(schema.type).toBe('boolean')
  })
})

// ─── nullable 判定 ───────────────────────────────────────────────────────────

describe('buildResponseSchema - nullable', () => {
  test('nullableValueがnullの場合nullable:trueになる', () => {
    const schema = buildResponseSchema('hello', null)
    expect(schema.type).toBe('string')
    expect(schema.nullable).toBe(true)
  })

  test('nullableValueがnullでない場合nullableにならない', () => {
    const schema = buildResponseSchema('hello', 'world')
    expect(schema.type).toBe('string')
    expect(schema.nullable).toBeUndefined()
  })

  test('整数のnullable判定', () => {
    const schema = buildResponseSchema(42, null)
    expect(schema.type).toBe('integer')
    expect(schema.nullable).toBe(true)
  })

  test('booleanのnullable判定', () => {
    const schema = buildResponseSchema(false, null)
    expect(schema.type).toBe('boolean')
    expect(schema.nullable).toBe(true)
  })
})

// ─── null / undefined ────────────────────────────────────────────────────────

describe('buildResponseSchema - null/undefined', () => {
  test('fullValueがnullでnullableValueもnullの場合type:nullになる', () => {
    const schema = buildResponseSchema(null, null)
    expect(schema.type).toBe('null')
  })

  test('fullValueがnullでnullableValueに値がある場合、nullableValueから推論する', () => {
    const schema = buildResponseSchema(null, 'hello')
    expect(schema.type).toBe('string')
  })

  test('fullValueがundefinedの場合type:nullになる', () => {
    const schema = buildResponseSchema(undefined)
    expect(schema.type).toBe('null')
  })
})

// ─── 配列の推論 ──────────────────────────────────────────────────────────────

describe('buildResponseSchema - 配列', () => {
  test('要素ありの配列からarray+itemsスキーマを推論する', () => {
    const schema = buildResponseSchema([1, 2, 3])
    expect(schema.type).toBe('array')
    expect(schema.items?.type).toBe('integer')
  })

  test('空配列の場合itemsは空オブジェクトになる', () => {
    const schema = buildResponseSchema([])
    expect(schema.type).toBe('array')
    expect(schema.items).toEqual({})
  })

  test('配列のnullable判定', () => {
    const schema = buildResponseSchema([1, 2], null)
    expect(schema.type).toBe('array')
    expect(schema.nullable).toBe(true)
  })

  test('オブジェクト配列の場合itemsにpropertiesが含まれる', () => {
    const schema = buildResponseSchema([{ id: 1, name: 'Alice' }])
    expect(schema.type).toBe('array')
    expect(schema.items?.type).toBe('object')
    expect(schema.items?.properties?.id?.type).toBe('integer')
    expect(schema.items?.properties?.name?.type).toBe('string')
  })
})

// ─── オブジェクトの推論 ──────────────────────────────────────────────────────

describe('buildResponseSchema - オブジェクト', () => {
  test('フラットなオブジェクトからpropertiesを推論する', () => {
    const schema = buildResponseSchema({ id: 1, name: 'Alice', active: true })
    expect(schema.type).toBe('object')
    expect(schema.properties?.id?.type).toBe('integer')
    expect(schema.properties?.name?.type).toBe('string')
    expect(schema.properties?.active?.type).toBe('boolean')
  })

  test('全フィールドがrequiredに含まれる', () => {
    const schema = buildResponseSchema({ id: 1, name: 'Alice' })
    expect(schema.required).toContain('id')
    expect(schema.required).toContain('name')
  })

  test('ネストオブジェクトを再帰的に推論する', () => {
    const schema = buildResponseSchema({
      user: { name: 'Alice', address: { city: 'Tokyo' } },
    })
    expect(schema.properties?.user?.type).toBe('object')
    expect(schema.properties?.user?.properties?.address?.type).toBe('object')
    expect(schema.properties?.user?.properties?.address?.properties?.city?.type).toBe('string')
  })

  test('nullableなフィールドを持つオブジェクト', () => {
    const full = { id: 1, name: 'Alice' }
    const nullable = { id: 2, name: null }
    const schema = buildResponseSchema(full, nullable)
    expect(schema.properties?.id?.nullable).toBeUndefined()
    expect(schema.properties?.name?.nullable).toBe(true)
  })

  test('空オブジェクトの場合propertiesは設定されない', () => {
    const schema = buildResponseSchema({})
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeUndefined()
  })
})

// ─── 複合的なケース ──────────────────────────────────────────────────────────

describe('buildResponseSchema - 複合的なケース', () => {
  test('APIレスポンス風のオブジェクトを正しく推論する', () => {
    const full = {
      id: 42,
      login: 'jdoe',
      email: 'jdoe@example.com',
      pool_year: '2023',
      cursus_users: [
        {
          id: 100,
          grade: 'Member',
          level: 4.2,
          skills: [{ id: 1, name: 'Unix', level: 8.5 }],
        },
      ],
    }
    const nullable = {
      id: 43,
      login: 'asmith',
      email: null,
      pool_year: null,
      cursus_users: [],
    }

    const schema = buildResponseSchema(full, nullable)

    expect(schema.type).toBe('object')
    expect(schema.properties?.email?.nullable).toBe(true)
    expect(schema.properties?.pool_year?.nullable).toBe(true)
    expect(schema.properties?.cursus_users?.type).toBe('array')
    expect(schema.properties?.cursus_users?.items?.properties?.level?.type).toBe('number')
    expect(schema.properties?.cursus_users?.items?.properties?.skills?.type).toBe('array')
  })
})
