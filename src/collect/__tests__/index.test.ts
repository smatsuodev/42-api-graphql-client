import { describe, expect, test } from 'bun:test'
import { parseArgs } from '../index'

// ─── parseArgs ───────────────────────────────────────────────────────────────

describe('parseArgs', () => {
  test('エンドポイントのみ指定した場合のデフォルト値', () => {
    const result = parseArgs(['project_sessions'])
    expect(result.endpoint).toBe('project_sessions')
    expect(result.maxPages).toBe(50)
    expect(result.offset).toBe(1)
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
})
