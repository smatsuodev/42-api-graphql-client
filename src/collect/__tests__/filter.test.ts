import { describe, expect, test } from 'bun:test'
import { fixFilterParams } from '../filter'

// ─── ヘルパー: OpenAPIドキュメント構築 ───────────────────────────────────────

function buildDoc(params: Record<string, unknown>[]): Record<string, unknown> {
  return {
    paths: {
      '/users': {
        get: {
          parameters: params,
        },
      },
    },
  }
}

function filterParam(
  name: string,
  schema: Record<string, unknown>,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name,
    in: 'query',
    schema,
    ...extras,
  }
}

// ─── スカラー→配列 変換 ─────────────────────────────────────────────────────

describe('fixFilterParams - スカラー→配列変換', () => {
  test('filter[id]のinteger型をarrayに変換する', () => {
    const doc = buildDoc([filterParam('filter[id]', { type: 'integer' })])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(1)
    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.schema.type).toBe('array')
    expect(param.schema.items.type).toBe('integer')
  })

  test('filter[name]のstring型をarrayに変換する', () => {
    const doc = buildDoc([filterParam('filter[name]', { type: 'string' })])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(1)
    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.schema.type).toBe('array')
    expect(param.schema.items.type).toBe('string')
  })

  test('filter[score]のnumber型をarrayに変換する', () => {
    const doc = buildDoc([filterParam('filter[score]', { type: 'number' })])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(1)
    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.schema.type).toBe('array')
    expect(param.schema.items.type).toBe('number')
  })
})

// ─── styleとexplodeの設定 ────────────────────────────────────────────────────

describe('fixFilterParams - style/explode', () => {
  test('パラメータレベルにstyle:formとexplode:falseを設定する', () => {
    const doc = buildDoc([filterParam('filter[id]', { type: 'integer' })])

    fixFilterParams(doc as any)

    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.style).toBe('form')
    expect(param.explode).toBe(false)
  })

  test('schema内のstyleとexplodeを削除する', () => {
    const doc = buildDoc([
      filterParam('filter[id]', {
        type: 'array',
        items: { type: 'integer' },
        style: 'form',
        explode: true,
      }),
    ])

    fixFilterParams(doc as any)

    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.schema.style).toBeUndefined()
    expect(param.schema.explode).toBeUndefined()
  })
})

// ─── 変更不要なケース ────────────────────────────────────────────────────────

describe('fixFilterParams - 変更不要なケース', () => {
  test('filter[]パターンに一致しないパラメータは変更しない', () => {
    const doc = buildDoc([filterParam('page', { type: 'integer' })])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(0)
    const param = (doc as any).paths['/users'].get.parameters[0]
    expect(param.schema.type).toBe('integer')
  })

  test('queryでないパラメータは変更しない', () => {
    const doc = buildDoc([{ name: 'filter[id]', in: 'path', schema: { type: 'integer' } }])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(0)
  })

  test('pathsが空の場合は0を返す', () => {
    const count = fixFilterParams({ paths: {} } as any)
    expect(count).toBe(0)
  })

  test('pathsがundefinedの場合は0を返す', () => {
    const count = fixFilterParams({} as any)
    expect(count).toBe(0)
  })

  test('既に正しく設定済みのfilterパラメータは変更数に含まれない', () => {
    const doc = buildDoc([
      filterParam(
        'filter[id]',
        { type: 'array', items: { type: 'integer' } },
        { style: 'form', explode: false },
      ),
    ])

    const count = fixFilterParams(doc as any)

    expect(count).toBe(0)
  })
})

// ─── 複数パスとメソッド ──────────────────────────────────────────────────────

describe('fixFilterParams - 複数パス・メソッド', () => {
  test('複数のエンドポイントにまたがるfilterパラメータをすべて修正する', () => {
    const doc = {
      paths: {
        '/users': {
          get: {
            parameters: [filterParam('filter[id]', { type: 'integer' })],
          },
        },
        '/projects': {
          get: {
            parameters: [filterParam('filter[name]', { type: 'string' })],
          },
        },
      },
    }

    const count = fixFilterParams(doc as any)

    expect(count).toBe(2)
  })

  test('postメソッドのfilterパラメータも修正する', () => {
    const doc = {
      paths: {
        '/users': {
          post: {
            parameters: [filterParam('filter[id]', { type: 'integer' })],
          },
        },
      },
    }

    const count = fixFilterParams(doc as any)

    expect(count).toBe(1)
  })
})
