/**
 * スナップショット保存・復元
 *
 * collect コマンドの実行中にページ取得ごとにスナップショットを保存し、
 * エラーで中断しても --resume フラグで途中から再開できるようにする。
 * アイテムデータはページキャッシュに保存されるため、スナップショットには含めない。
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
  /** 元の開始オフセット */
  offset: number
  /** CoverageTracker のシリアライズ結果 */
  coverage: Record<string, FieldCoverage>
  /** 保存時刻 (ISO 8601) */
  savedAt: string
}

// ─── ファイル名 ──────────────────────────────────────────────────────────────

function snapshotFilePath(endpointDir: string): string {
  return join(endpointDir, 'snapshot.json')
}

// ─── 保存 ────────────────────────────────────────────────────────────────────

/**
 * スナップショットをファイルに書き出す (アトミック書き込み: tmp → rename)
 */
export function saveSnapshot(endpointDir: string, data: SnapshotData): void {
  mkdirSync(endpointDir, { recursive: true })

  const target = snapshotFilePath(endpointDir)
  const tmp = `${target}.tmp`

  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, target)
}

// ─── 読み込み ────────────────────────────────────────────────────────────────

/**
 * スナップショットを読み込む。ファイルが存在しない場合は null を返す。
 */
export function loadSnapshot(endpointDir: string): SnapshotData | null {
  const target = snapshotFilePath(endpointDir)
  if (!existsSync(target)) return null

  const content = readFileSync(target, 'utf-8')
  return JSON.parse(content) as SnapshotData
}

// ─── 削除 ────────────────────────────────────────────────────────────────────

/**
 * スナップショットを削除する。ファイルが存在しない場合は何もしない。
 */
export function removeSnapshot(endpointDir: string): void {
  const target = snapshotFilePath(endpointDir)
  if (existsSync(target)) {
    unlinkSync(target)
  }
}
