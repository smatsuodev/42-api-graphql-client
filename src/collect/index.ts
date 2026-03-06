/**
 * 42 API レスポンス収集 + OpenAPI スキーマ更新 統合ツール
 *
 * エンドポイントを指定して実行すると:
 *   1. 42 API からレスポンスをページネーション付きで収集
 *   2. full.json / nullable.json を合成・出力
 *   3. openapi.yml のレスポンススキーマを推論・更新
 *   4. filter パラメータを修正
 *
 * Usage: bun collect <endpoint> [options]
 *
 * 例:
 *   bun collect project_sessions
 *   bun collect cursus --max-pages 20
 *   bun collect --method POST users --dry-run
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fetchAllPages, PAGE_SIZE } from './fetcher'
import { CoverageTracker, synthesizeFull, synthesizeNullable } from './synthesizer'
import { updateParameters, updateSchema } from './schema'
import { fixFilters } from './filter'
import { readOrCreateOpenApiDoc } from './openapi'
import { fetchApidocParams } from './apidoc'
import { buildOpenAPIParameters, extractFieldTypes } from './params'
import { loadSnapshot, removeSnapshot, saveSnapshot } from './snapshot'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.intra.42.fr/v2'
const DEFAULT_MAX_PAGES = 50
const VALID_STEPS = ['fetch', 'synthesize', 'schema', 'apidoc', 'filter'] as const
type Step = (typeof VALID_STEPS)[number]
const OUTPUT_DIR = resolve(import.meta.dirname, '..', '..', 'scripts', 'output')
const SNAPSHOT_DIR = resolve(import.meta.dirname, '..', '..', '.collect-snapshot')

// ─── CLI パース ──────────────────────────────────────────────────────────────

export interface ParsedArgs {
  endpoint: string
  maxPages: number
  offset: number
  method: string
  dryRun: boolean
  resume: boolean
  skip: Set<Step>
}

export function parseArgs(argv?: string[]): ParsedArgs {
  const args = argv ?? process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: bun collect <endpoint> [options]

42 API のエンドポイントからレスポンスを収集し、openapi.yml を更新します。

引数:
  endpoint      エンドポイントのパス (/v2/ 以降の部分)
                例: project_sessions, cursus, campus

オプション:
  --max-pages <n>   最大ページ数 (デフォルト: ${DEFAULT_MAX_PAGES})
  --offset <n>      取得を開始するページ番号 (デフォルト: 1)
  --method <METHOD>  HTTP メソッド (デフォルト: GET)
  --dry-run          openapi.yml を書き換えず、スキーマ統計のみ表示
  --resume           前回中断したスナップショットから再開
  --skip <steps>     スキップするステップをカンマ区切りで指定
                     (${VALID_STEPS.join(', ')})
  --help, -h         このヘルプを表示

例:
  bun collect project_sessions
  bun collect cursus --max-pages 20
  bun collect cursus --offset 5 --max-pages 10
  bun collect --dry-run project_sessions
  bun collect project_sessions --resume`)
    process.exit(0)
  }

  let method = 'GET'
  let maxPages = DEFAULT_MAX_PAGES
  let offset = 1
  let dryRun = false
  let resume = false
  const skip = new Set<Step>()
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--max-pages' && args[i + 1]) {
      maxPages = Number.parseInt(args[i + 1]!, 10)
      if (Number.isNaN(maxPages) || maxPages < 1) {
        throw new Error('--max-pages は 1 以上の整数を指定してください')
      }
      i++
    } else if (arg === '--offset' && args[i + 1]) {
      offset = Number.parseInt(args[i + 1]!, 10)
      if (Number.isNaN(offset) || offset < 1) {
        throw new Error('--offset は 1 以上の整数を指定してください')
      }
      i++
    } else if (arg === '--method' && args[i + 1]) {
      method = args[i + 1]!.toUpperCase()
      i++
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--resume') {
      resume = true
    } else if (arg === '--skip' && args[i + 1]) {
      for (const s of args[i + 1]!.split(',')) {
        const trimmed = s.trim()
        if (!VALID_STEPS.includes(trimmed as Step)) {
          throw new Error(
            `不明なステップ: ${trimmed} (有効なステップ: ${VALID_STEPS.join(', ')})`,
          )
        }
        skip.add(trimmed as Step)
      }
      i++
    } else if (arg.startsWith('-')) {
      throw new Error(`不明なオプション: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length === 0) {
    throw new Error('エンドポイントを指定してください')
  }

  // 先頭の / を除去
  const endpoint = positional[0]!.replace(/^\//, '')

  return { endpoint, maxPages, offset, method, dryRun, resume, skip }
}

// ─── メイン処理 ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const {
    endpoint,
    maxPages: origMaxPages,
    offset: origOffset,
    method,
    dryRun,
    resume,
    skip,
  } = parseArgs()
  const safeName = endpoint.replace(/\//g, '_')

  // ─── スナップショット復元 ──────────────────────────────────────────────

  let initialItems: Record<string, unknown>[] = []
  let tracker = new CoverageTracker()
  let maxPages = origMaxPages
  let offset = origOffset

  if (resume) {
    const snapshot = loadSnapshot(SNAPSHOT_DIR, safeName)
    if (snapshot) {
      if (snapshot.endpoint !== endpoint || snapshot.method !== method) {
        console.warn(
          `[snapshot] スナップショットのエンドポイント (${snapshot.endpoint}, ${snapshot.method}) が` +
            `現在の指定 (${endpoint}, ${method}) と一致しません。無視します。`,
        )
      } else {
        initialItems = snapshot.items
        tracker = CoverageTracker.fromJSON(snapshot.coverage)
        offset = snapshot.nextPage
        // 残りページ数 = 元の最終ページ - 再開ページ + 1
        const origLastPage = snapshot.offset + snapshot.maxPages - 1
        maxPages = Math.max(1, origLastPage - offset + 1)

        console.log(
          `[snapshot] スナップショットから復元: ${initialItems.length} 件, ページ ${offset} から再開`,
        )
      }
    } else {
      console.log('[snapshot] スナップショットが見つかりません。最初から開始します。')
    }
  }

  console.log('\n=== 42 API レスポンス収集 ===')
  console.log(`エンドポイント: ${API_BASE}/${endpoint}`)
  console.log(`開始ページ: ${offset}`)
  console.log(`最大ページ数: ${maxPages}`)
  console.log(`ページサイズ: ${PAGE_SIZE}`)
  console.log(`HTTP メソッド: ${method}`)
  console.log(`dry-run: ${dryRun}`)
  console.log(`resume: ${resume}`)
  if (skip.size > 0) {
    console.log(`skip: ${[...skip].join(', ')}`)
  }
  console.log(`出力先: ${OUTPUT_DIR}/${safeName}_*.json\n`)

  // ─── Step 1-2: API 収集 ────────────────────────────────────────────────

  const fullPath = resolve(OUTPUT_DIR, `${safeName}_full.json`)
  const nullablePath = resolve(OUTPUT_DIR, `${safeName}_nullable.json`)
  let full: unknown
  let nullable: unknown

  if (!skip.has('fetch')) {
    const { items: allItems } = await fetchAllPages(
      endpoint,
      maxPages,
      offset,
      () => tracker.isFullyCovered(),
      (records) => {
        for (const record of records) {
          tracker.update(record)
        }
        tracker.printProgress()
      },
      {
        initialItems,
        onPageFetched: (nextPage, currentItems) => {
          saveSnapshot(SNAPSHOT_DIR, safeName, {
            endpoint,
            method,
            nextPage,
            maxPages: origMaxPages,
            offset: origOffset,
            items: currentItems,
            coverage: tracker.toJSON(),
            savedAt: new Date().toISOString(),
          })
        },
      },
    )

    if (allItems.length === 0) {
      throw new Error('レスポンスを 1 件も取得できませんでした')
    }

    console.log(`\n合計 ${allItems.length} 件のレスポンスを収集しました。合成を開始します...\n`)

    // ─── Step 3: 合成 ──────────────────────────────────────────────────────

    if (!skip.has('synthesize')) {
      full = [synthesizeFull(allItems)]
      nullable = [synthesizeNullable(allItems)]

      // ─── Step 4: 中間ファイル書き出し ──────────────────────────────────────

      mkdirSync(OUTPUT_DIR, { recursive: true })

      writeFileSync(fullPath, JSON.stringify(full, null, 2) + '\n')
      writeFileSync(nullablePath, JSON.stringify(nullable, null, 2) + '\n')

      console.log(`[output] ${fullPath}`)
      console.log(`[output] ${nullablePath}`)

      // カバレッジサマリー
      tracker.printSummary()
    } else {
      console.log('[skip] synthesize をスキップしました')
    }
  } else {
    console.log('[skip] fetch をスキップしました')
  }

  // ─── Step 5: OpenAPI スキーマ更新 ──────────────────────────────────────

  const endpointPath = `/${endpoint}`

  if (!skip.has('schema')) {
    if (!full || !nullable) {
      if (!existsSync(fullPath) || !existsSync(nullablePath)) {
        throw new Error(
          `schema ステップには ${fullPath} と ${nullablePath} が必要です。先に fetch + synthesize を実行してください。`,
        )
      }
      full = [JSON.parse(readFileSync(fullPath, 'utf-8'))]
      nullable = [JSON.parse(readFileSync(nullablePath, 'utf-8'))]
    }
    updateSchema(full!, nullable!, endpointPath, method, dryRun)
  } else {
    console.log('[skip] schema をスキップしました')
  }

  // ─── Step 5.5: apidoc パラメータ取得 ──────────────────────────────────

  if (!skip.has('apidoc')) {
    try {
      const apidocParams = await fetchApidocParams(safeName)
      console.log(
        `[apidoc] sort: ${apidocParams.sort.length}, filter: ${apidocParams.filter.length}, range: ${apidocParams.range.length}, page: ${apidocParams.hasPage}`,
      )

      // レスポンススキーマからフィールド型マップを構築
      const doc = readOrCreateOpenApiDoc()
      const operation = doc.paths?.[endpointPath]?.[method.toLowerCase()] as
        | Record<string, unknown>
        | undefined
      const responses = operation?.responses as Record<string, Record<string, unknown>> | undefined
      const content = responses?.['200']?.content as Record<string, Record<string, unknown>> | undefined
      const responseSchema = content?.['application/json']?.schema as
        | Record<string, unknown>
        | undefined
      const fieldTypes = responseSchema ? extractFieldTypes(responseSchema) : undefined

      const parameters = buildOpenAPIParameters(apidocParams, fieldTypes)
      if (parameters.length > 0) {
        updateParameters(endpointPath, method, parameters, dryRun)
      } else {
        console.log('[apidoc] パラメータが見つかりませんでした')
      }
    } catch (err) {
      console.warn(
        `[apidoc] パラメータ取得に失敗しました (続行します): ${err instanceof Error ? err.message : err}`,
      )
    }
  } else {
    console.log('[skip] apidoc をスキップしました')
  }

  // ─── Step 6: filter パラメータ修正 ─────────────────────────────────────

  if (!skip.has('filter')) {
    if (!dryRun) {
      fixFilters()
    }
  } else {
    console.log('[skip] filter をスキップしました')
  }

  // ─── Step 7: スナップショットクリーンアップ ────────────────────────────

  removeSnapshot(SNAPSHOT_DIR, safeName)
  console.log('[snapshot] スナップショットを削除しました')

  console.log('\n完了！')
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`\nエラー: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  })
}
