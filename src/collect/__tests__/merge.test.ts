import { describe, expect, test } from 'bun:test'
import { mergeOpenAPISchema, mergeParameters } from '../merge'

describe('mergeOpenAPISchema', () => {
  test('既存typeがincomingの"null"より優先される', () => {
    const existing = { type: 'string' }
    const incoming = { type: 'null' }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({ type: 'string' })
  })

  test('既存が空の場合incomingで補完', () => {
    const existing = {}
    const incoming = { type: 'string', nullable: true }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({ type: 'string', nullable: true })
  })

  test('既存のnullableが保持される', () => {
    const existing = { type: 'string', nullable: false }
    const incoming = { type: 'string', nullable: true }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({ type: 'string', nullable: false })
  })

  test('incomingのnullableが未定義フィールドを補完', () => {
    const existing = { type: 'string' }
    const incoming = { type: 'null', nullable: true }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({ type: 'string', nullable: true })
  })

  test('propertiesの再帰マージ（既存type保持）', () => {
    const existing = {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
    }
    const incoming = {
      type: 'object' as const,
      properties: { name: { type: 'null' } },
    }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
    })
  })

  test('新規プロパティの追加', () => {
    const existing = {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
    }
    const incoming = {
      type: 'object' as const,
      properties: { name: { type: 'null' }, age: { type: 'integer' } },
    }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
    })
  })

  test('既存のみのプロパティ保持', () => {
    const existing = {
      type: 'object' as const,
      properties: { name: { type: 'string' }, extra: { type: 'boolean' } },
    }
    const incoming = {
      type: 'object' as const,
      properties: { name: { type: 'null' } },
    }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({
      type: 'object',
      properties: { name: { type: 'string' }, extra: { type: 'boolean' } },
    })
  })

  test('requiredから人間が削除したエントリが保持される', () => {
    const existing = {
      type: 'object' as const,
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
      required: ['name'],
    }
    const incoming = {
      type: 'object' as const,
      properties: { name: { type: 'null' }, age: { type: 'null' } },
      required: ['name', 'age'],
    }
    // 既存のrequiredを保持（ageは人間が意図的に削除した）
    expect(mergeOpenAPISchema(existing, incoming).required).toEqual(['name'])
  })

  test('新規プロパティのrequiredがincomingから引き継がれる', () => {
    const existing = {
      type: 'object' as const,
      properties: { name: { type: 'string' } },
      required: ['name'],
    }
    const incoming = {
      type: 'object' as const,
      properties: { name: { type: 'null' }, age: { type: 'integer' } },
      required: ['name', 'age'],
    }
    // name は既存required維持、age は新規なのでincomingから引き継ぐ
    expect(mergeOpenAPISchema(existing, incoming).required).toEqual(['name', 'age'])
  })

  test('空items {}がincomingで置換される', () => {
    const existing = { type: 'array', items: {} }
    const incoming = { type: 'array', items: { type: 'string' } }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({
      type: 'array',
      items: { type: 'string' },
    })
  })

  test('非空itemsの再帰マージ', () => {
    const existing = { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } }
    const incoming = { type: 'array', items: { type: 'object', properties: { id: { type: 'null' }, name: { type: 'string' } } } }
    expect(mergeOpenAPISchema(existing, incoming)).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' } },
      },
    })
  })

  test('ネストされたオブジェクトの深いマージ', () => {
    const existing = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            profile: {
              type: 'object',
              properties: { bio: { type: 'string' } },
            },
          },
        },
      },
    }
    const incoming = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'null' },
            profile: {
              type: 'object',
              properties: { bio: { type: 'null' }, avatar: { type: 'string' } },
            },
          },
        },
      },
    }
    const result = mergeOpenAPISchema(existing, incoming)
    expect(result.properties?.user?.properties?.name).toEqual({ type: 'string' })
    expect(result.properties?.user?.properties?.profile?.properties?.bio).toEqual({ type: 'string' })
    expect(result.properties?.user?.properties?.profile?.properties?.avatar).toEqual({ type: 'string' })
  })
})

describe('mergeParameters', () => {
  test('同名パラメータは既存が保持される', () => {
    const existing = [{ name: 'page', in: 'query', schema: { type: 'integer' }, description: 'custom' }]
    const incoming = [{ name: 'page', in: 'query', schema: { type: 'string' }, description: 'auto' }]
    expect(mergeParameters(existing, incoming)).toEqual(existing)
  })

  test('新規パラメータが追加される', () => {
    const existing = [{ name: 'page', in: 'query' }]
    const incoming = [{ name: 'page', in: 'query' }, { name: 'size', in: 'query' }]
    expect(mergeParameters(existing, incoming)).toEqual([
      { name: 'page', in: 'query' },
      { name: 'size', in: 'query' },
    ])
  })

  test('空のexistingはincomingをそのまま返す', () => {
    const incoming = [{ name: 'page', in: 'query' }]
    expect(mergeParameters([], incoming)).toEqual(incoming)
  })
})
