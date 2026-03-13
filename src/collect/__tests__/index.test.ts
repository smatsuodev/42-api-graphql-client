import { describe, expect, test } from 'bun:test'
import { parseArgs } from '../index'

// ─── parseArgs ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('エンドポイントのみ指定した場合のデフォルト値', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.endpoint).toBe('project_sessions')
    expect(result.maxPages).toBe(50)
    expect(result.offset).toBe(0)
    expect(result.method).toBe('GET')
    expect(result.dryRun).toBe(false)
    expect(result.resume).toBe(false)
  })

  test('--resume フラグを認識する', () => {
    const result = parseArgs(['project_sessions', '--resume'])
    expect(result.resume).toBe(true)
  })

  test('--resume を他のオプションと組み合わせられる', () => {
    const result = parseArgs(['project_sessions', '--resume', '--max-pages', '10'])
    expect(result.resume).toBe(true)
    expect(result.maxPages).toBe(10)
  })

  test('--resume なしの場合 resume は false', () => {
    const result = parseArgs(['project_sessions', '--max-pages', '20'])
    expect(result.resume).toBe(false)
  })

  test('--skip なしの場合 skip は空の Set', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.skip.size).toBe(0)
  })

  test('--skip で単一ステップを指定できる', () => {
    const result = parseArgs(['project_sessions', '--skip', 'fetch'])
    expect(result.skip).toEqual(new Set(['fetch']))
  })

  test('--skip でカンマ区切りで複数ステップを指定できる', () => {
    const result = parseArgs(['project_sessions', '--skip', 'fetch,synthesize,filter'])
    expect(result.skip).toEqual(new Set(['fetch', 'synthesize', 'filter']))
  })

  test('--skip に不明なステップを指定するとエラー', () => {
    expect(() => parseArgs(['project_sessions', '--skip', 'unknown'])).toThrow(
      '不明なステップ: unknown',
    )
  })

  test('--skip を他のオプションと組み合わせられる', () => {
    const result = parseArgs(['project_sessions', '--skip', 'fetch', '--dry-run'])
    expect(result.skip).toEqual(new Set(['fetch']))
    expect(result.dryRun).toBe(true)
  })

  test('--param なしの場合 params は空の Map', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.params.size).toBe(0)
  })

  test('--param で単一パラメータを指定できる', () => {
    const result = parseArgs(['project_sessions', '--param', 'filter[campus_id]=26'])
    expect(result.params).toEqual(new Map([['filter[campus_id]', '26']]))
  })

  test('--param を複数回指定できる', () => {
    const result = parseArgs([
      'project_sessions',
      '--param',
      'filter[campus_id]=26',
      '--param',
      'sort=login',
    ])
    expect(result.params).toEqual(
      new Map([
        ['filter[campus_id]', '26'],
        ['sort', 'login'],
      ]),
    )
  })

  test('--param に = を含まない値を指定するとエラー', () => {
    expect(() => parseArgs(['project_sessions', '--param', 'invalid'])).toThrow(
      '--param は key=value 形式で指定してください',
    )
  })

  test('--sequential なしの場合 sequential は false', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.sequential).toBe(false)
  })

  test('--sequential フラグを認識する', () => {
    const result = parseArgs(['project_sessions', '--sequential'])
    expect(result.sequential).toBe(true)
  })

  test('--sequential を他のオプションと組み合わせられる', () => {
    const result = parseArgs(['project_sessions', '--sequential', '--max-pages', '10'])
    expect(result.sequential).toBe(true)
    expect(result.maxPages).toBe(10)
  })

  test('--overwrite なしの場合 overwrite は false', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.overwrite).toBe(false)
  })

  test('--overwrite フラグを認識する', () => {
    const result = parseArgs(['project_sessions', '--overwrite'])
    expect(result.overwrite).toBe(true)
  })

  test('--show-compatibility なしの場合 showCompatibility は false', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.showCompatibility).toBe(false)
  })

  test('--show-compatibility フラグを認識する', () => {
    const result = parseArgs(['--show-compatibility'])
    expect(result.showCompatibility).toBe(true)
  })

  test('--show-compatibility はエンドポイント未指定でもエラーにならない', () => {
    expect(() => parseArgs(['--show-compatibility'])).not.toThrow()
  })

  test('--show-compatibility とエンドポイントを組み合わせられる', () => {
    const result = parseArgs(['project_sessions', '--show-compatibility'])
    expect(result.showCompatibility).toBe(true)
    expect(result.endpoint).toBe('project_sessions')
  })

  test('--show-compatibility --method GET で compatMethodFilter が設定される', () => {
    const result = parseArgs(['--show-compatibility', '--method', 'GET'])
    expect(result.compatMethodFilter).toEqual(['GET'])
  })

  test('--show-compatibility --method GET,POST で複数メソッドフィルタ', () => {
    const result = parseArgs(['--show-compatibility', '--method', 'GET,POST'])
    expect(result.compatMethodFilter).toEqual(['GET', 'POST'])
  })

  test('--show-compatibility のみの場合 compatMethodFilter は null', () => {
    const result = parseArgs(['--show-compatibility'])
    expect(result.compatMethodFilter).toBeNull()
  })

  test('--method GET のみ (show-compatibility なし) の場合 compatMethodFilter は null', () => {
    const result = parseArgs(['project_sessions', '--method', 'GET'])
    expect(result.compatMethodFilter).toBeNull()
  })

  test('--show-restricted なしの場合 showRestricted は false', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.showRestricted).toBe(false)
  })

  test('--show-restricted フラグを認識する', () => {
    const result = parseArgs(['--show-compatibility', '--show-restricted'])
    expect(result.showRestricted).toBe(true)
  })

  test('--format なしの場合 compatOutputFormat は ascii', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.compatOutputFormat).toBe('ascii')
  })

  test('--format markdown を認識する', () => {
    const result = parseArgs(['--show-compatibility', '--format', 'markdown'])
    expect(result.compatOutputFormat).toBe('markdown')
  })

  test('--format json を認識する', () => {
    const result = parseArgs(['--show-compatibility', '--format', 'json'])
    expect(result.compatOutputFormat).toBe('json')
  })

  test('--format ascii を認識する', () => {
    const result = parseArgs(['--show-compatibility', '--format', 'ascii'])
    expect(result.compatOutputFormat).toBe('ascii')
  })

  test('--format に不明な値を指定するとエラー', () => {
    expect(() => parseArgs(['--show-compatibility', '--format', 'csv'])).toThrow(
      '不明なフォーマット: csv',
    )
  })
})
