/**
 * スナップショット保存・復元
 *
 * collect コマンドの実行中にページ取得ごとにスナップショットを保存し、
 * エラーで中断しても --resume フラグで途中から再開できるようにする。
 */

import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FieldCoverage } from './synthesizer'

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface SnapshotData {
  /** エンドポイントパス (復元時の一致検証用) */
  endpoint: string
  /** HTTP メソッド */
  method: string
  /** 次に取得すべきページ番号 */
  nextPage: number
  /** 元の最大ページ数設定 */
  maxPages: number
  /** 元の開始ページ番号 */
  offset: number
  /** 累積収集データ */
  items: Record<string, unknown>[]
  /** CoverageTracker のシリアライズ結果 */
  coverage: Record<string, FieldCoverage>
  /** 保存時刻 (ISO 8601) */
  savedAt: string
}

// ─── ファイル名 ──────────────────────────────────────────────────────────────

function snapshotPath(snapshotDir: string, safeName: string): string {
  return join(snapshotDir, `${safeName}.snapshot.json`)
}

// ─── 保存 ────────────────────────────────────────────────────────────────────

/**
 * スナップショットをファイルに書き出す (アトミック書き込み: tmp → rename)
 */
export function saveSnapshot(snapshotDir: string, safeName: string, data: SnapshotData): void {
  mkdirSync(snapshotDir, { recursive: true })

  const target = snapshotPath(snapshotDir, safeName)
  const tmp = `${target}.tmp`

  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, target)
}

// ─── 読み込み ────────────────────────────────────────────────────────────────

/**
 * スナップショットを読み込む。ファイルが存在しない場合は null を返す。
 */
export function loadSnapshot(snapshotDir: string, safeName: string): SnapshotData | null {
  const target = snapshotPath(snapshotDir, safeName)
  if (!existsSync(target)) return null

  const content = readFileSync(target, 'utf-8')
  return JSON.parse(content) as SnapshotData
}

// ─── 削除 ────────────────────────────────────────────────────────────────────

/**
 * スナップショットを削除する。ファイルが存在しない場合は何もしない。
 */
export function removeSnapshot(snapshotDir: string, safeName: string): void {
  const target = snapshotPath(snapshotDir, safeName)
  if (existsSync(target)) {
    unlinkSync(target)
  }
}
