import { describe, expect, test } from 'bun:test'
import { buildOpenAPIParameters, extractFieldTypes } from '../params'
import type { ApidocParams } from '../apidoc'

// ─── ヘルパー ────────────────────────────────────────────────────────────────

function emptyParams(): ApidocParams {
  return { sort: [], filter: [], range: [], hasPage: false }
}

// ─── sort パラメータ ──────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - sort', () => {
  test('sortフィールドがある場合sortパラメータをenum付きarray型で生成する', () => {
    const params = buildOpenAPIParameters({ ...emptyParams(), sort: ['id', 'name'] })
    const sortParam = params.find((p) => p.name === 'sort')
    expect(sortParam).toBeDefined()
    expect(sortParam!.in).toBe('query')
    expect(sortParam!.style).toBe('form')
    expect(sortParam!.explode).toBe(false)
    expect(sortParam!.schema).toEqual({
      type: 'array',
      items: { type: 'string', enum: ['id', 'name', '-id', '-name'] },
    })
  })

  test('sortフィールドが空の場合sortパラメータを生成しない', () => {
    const params = buildOpenAPIParameters(emptyParams())
    const sortParam = params.find((p) => p.name === 'sort')
    expect(sortParam).toBeUndefined()
  })
})

// ─── filter パラメータ ────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - filter', () => {
  test('各filterフィールドごとにfilter[field]パラメータを生成する', () => {
    const params = buildOpenAPIParameters({ ...emptyParams(), filter: ['id', 'name'] })
    const filterIdParam = params.find((p) => p.name === 'filter[id]')
    const filterNameParam = params.find((p) => p.name === 'filter[name]')

    expect(filterIdParam).toBeDefined()
    expect(filterIdParam!.in).toBe('query')
    expect(filterIdParam!.style).toBe('form')
    expect(filterIdParam!.explode).toBe(false)
    expect(filterIdParam!.schema).toEqual({ type: 'array', items: { type: 'string' } })

    expect(filterNameParam).toBeDefined()
  })

  test('filterフィールドが空の場合filterパラメータを生成しない', () => {
    const params = buildOpenAPIParameters(emptyParams())
    const filterParams = params.filter((p) => p.name.startsWith('filter['))
    expect(filterParams).toHaveLength(0)
  })
})

// ─── range パラメータ ─────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - range', () => {
  test('各rangeフィールドごとにrange[field]パラメータを生成する', () => {
    const params = buildOpenAPIParameters({ ...emptyParams(), range: ['id', 'created_at'] })
    const rangeIdParam = params.find((p) => p.name === 'range[id]')
    const rangeCreatedAtParam = params.find((p) => p.name === 'range[created_at]')

    expect(rangeIdParam).toBeDefined()
    expect(rangeIdParam!.in).toBe('query')
    expect(rangeIdParam!.schema).toEqual({ type: 'string' })

    expect(rangeCreatedAtParam).toBeDefined()
  })

  test('rangeフィールドが空の場合rangeパラメータを生成しない', () => {
    const params = buildOpenAPIParameters(emptyParams())
    const rangeParams = params.filter((p) => p.name.startsWith('range['))
    expect(rangeParams).toHaveLength(0)
  })
})

// ─── page パラメータ ──────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - page', () => {
  test('hasPageがtrueの場合page[number]とpage[size]を生成する', () => {
    const params = buildOpenAPIParameters({ ...emptyParams(), hasPage: true })
    const pageNumberParam = params.find((p) => p.name === 'page[number]')
    const pageSizeParam = params.find((p) => p.name === 'page[size]')

    expect(pageNumberParam).toBeDefined()
    expect(pageNumberParam!.in).toBe('query')
    expect(pageNumberParam!.schema).toEqual({ type: 'integer' })

    expect(pageSizeParam).toBeDefined()
    expect(pageSizeParam!.in).toBe('query')
    expect(pageSizeParam!.schema).toEqual({ type: 'integer' })
  })

  test('hasPageがfalseの場合pageパラメータを生成しない', () => {
    const params = buildOpenAPIParameters(emptyParams())
    const pageParams = params.filter((p) => p.name.startsWith('page['))
    expect(pageParams).toHaveLength(0)
  })
})

// ─── filter 型推論 ───────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - filter 型推論', () => {
  test('fieldTypesを渡すとfilterのitems.typeがマップの値になる', () => {
    const params = buildOpenAPIParameters(
      { ...emptyParams(), filter: ['id', 'name'] },
      { id: 'integer', name: 'string' },
    )
    const filterId = params.find((p) => p.name === 'filter[id]')
    const filterName = params.find((p) => p.name === 'filter[name]')

    expect(filterId!.schema).toEqual({ type: 'array', items: { type: 'integer' } })
    expect(filterName!.schema).toEqual({ type: 'array', items: { type: 'string' } })
  })

  test('fieldTypesにフィールドがない場合はstringにフォールバックする', () => {
    const params = buildOpenAPIParameters(
      { ...emptyParams(), filter: ['id', 'unknown_field'] },
      { id: 'integer' },
    )
    const filterUnknown = params.find((p) => p.name === 'filter[unknown_field]')

    expect(filterUnknown!.schema).toEqual({ type: 'array', items: { type: 'string' } })
  })

  test('fieldTypesが未指定の場合は従来通り全てstringになる', () => {
    const params = buildOpenAPIParameters({ ...emptyParams(), filter: ['id'] })
    const filterId = params.find((p) => p.name === 'filter[id]')

    expect(filterId!.schema).toEqual({ type: 'array', items: { type: 'string' } })
  })

  test('booleanフィールドのfilterは配列ではなく単一のbooleanになる', () => {
    const params = buildOpenAPIParameters(
      { ...emptyParams(), filter: ['solo', 'id'] },
      { solo: 'boolean', id: 'integer' },
    )
    const filterSolo = params.find((p) => p.name === 'filter[solo]')
    const filterId = params.find((p) => p.name === 'filter[id]')

    expect(filterSolo!.schema).toEqual({ type: 'boolean' })
    expect(filterSolo!.style).toBeUndefined()
    expect(filterSolo!.explode).toBeUndefined()

    // non-boolean は従来通り array
    expect(filterId!.schema).toEqual({ type: 'array', items: { type: 'integer' } })
    expect(filterId!.style).toBe('form')
    expect(filterId!.explode).toBe(false)
  })
})

// ─── 複合 ────────────────────────────────────────────────────────────────────

describe('buildOpenAPIParameters - 複合', () => {
  test('全パラメータ種別を組み合わせて生成する', () => {
    const params = buildOpenAPIParameters({
      sort: ['id'],
      filter: ['id', 'name'],
      range: ['id'],
      hasPage: true,
    })

    // sort(1) + filter(2) + range(1) + page(2) = 6
    expect(params).toHaveLength(6)
  })

  test('すべて空の場合は空配列を返す', () => {
    const params = buildOpenAPIParameters(emptyParams())
    expect(params).toEqual([])
  })
})

// ─── extractFieldTypes ──────────────────────────────────────────────────────

describe('extractFieldTypes', () => {
  test('objectスキーマからプリミティブ型のフィールドマップを抽出する', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        solo: { type: 'boolean' },
      },
    }
    expect(extractFieldTypes(schema)).toEqual({
      id: 'integer',
      name: 'string',
      solo: 'boolean',
    })
  })

  test('arrayスキーマのitemsからフィールドマップを抽出する', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          created_at: { type: 'string' },
        },
      },
    }
    expect(extractFieldTypes(schema)).toEqual({
      id: 'integer',
      created_at: 'string',
    })
  })

  test('objectやarrayのフィールドは除外する', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        tags: { type: 'array', items: { type: 'string' } },
        meta: { type: 'object', properties: {} },
      },
    }
    expect(extractFieldTypes(schema)).toEqual({ id: 'integer' })
  })

  test('propertiesがない場合は空オブジェクトを返す', () => {
    expect(extractFieldTypes({ type: 'object' })).toEqual({})
    expect(extractFieldTypes({})).toEqual({})
  })
})
