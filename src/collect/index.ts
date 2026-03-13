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
import { loadAllCachedPages, loadPageCache, loadProbeCache, savePageCache, saveProbeCache } from './cache'
import { isBooleanLikeField, probeBooleanFields, probeNullableFields } from './prober'
import { showCompatibility } from './compatibility'
import type { CompatOutputFormat } from './compatibility'
import type { ApidocParams } from './apidoc'

// ─── 定数 ────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.intra.42.fr/v2'
const DEFAULT_MAX_PAGES = 50
const VALID_STEPS = ['fetch', 'synthesize', 'schema', 'apidoc', 'filter'] as const
type Step = (typeof VALID_STEPS)[number]
const COLLECT_DIR = resolve(import.meta.dirname, '..', '..', '.collect')

// ─── CLI パース ──────────────────────────────────────────────────────────────

const VALID_FORMATS = ['ascii', 'markdown', 'json'] as const

export interface ParsedArgs {
  endpoint: string
  maxPages: number
  offset: number
  method: string
  dryRun: boolean
  resume: boolean
  sequential: boolean
  overwrite: boolean
  showCompatibility: boolean
  showRestricted: boolean
  compatMethodFilter: string[] | null
  compatOutputFormat: CompatOutputFormat
  skip: Set<Step>
  params: Map<string, string>
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
  --offset <n>      スキップするページ数 (デフォルト: 0)
  --method <METHOD>  HTTP メソッド (デフォルト: GET)
  --dry-run          openapi.yml を書き換えず、スキーマ統計のみ表示
  --resume           前回中断したスナップショットから再開
  --sequential       逐次取得モード (プローブベースの判定を使わない)
  --param <key=value> クエリパラメータを追加 (複数回指定可)
                     例: --param "filter[campus_id]=26"
  --overwrite        既存の手動編集を上書きする (デフォルト: マージ)
  --skip <steps>     スキップするステップをカンマ区切りで指定
                     (${VALID_STEPS.join(', ')})
  --show-compatibility  42 API の全エンドポイントと openapi.yml の対応状況を表示
                       --method と組み合わせてメソッドフィルタ可能
                       例: bun collect --show-compatibility --method GET
                           bun collect --show-compatibility --method GET,POST
  --show-restricted    制限付きエンドポイントも表示する (デフォルト: 非表示)
  --format <format>    出力形式 (ascii|markdown|json, デフォルト: ascii)
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
  let methodSpecified = false
  let maxPages = DEFAULT_MAX_PAGES
  let offset = 0
  let dryRun = false
  let resume = false
  let sequential = false
  let overwrite = false
  let showCompat = false
  let showRestricted = false
  let compatOutputFormat: CompatOutputFormat = 'ascii'
  const skip = new Set<Step>()
  const params = new Map<string, string>()
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
      if (Number.isNaN(offset) || offset < 0) {
        throw new Error('--offset は 0 以上の整数を指定してください')
      }
      i++
    } else if (arg === '--method' && args[i + 1]) {
      method = args[i + 1]!.toUpperCase()
      methodSpecified = true
      i++
    } else if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--resume') {
      resume = true
    } else if (arg === '--sequential') {
      sequential = true
    } else if (arg === '--overwrite') {
      overwrite = true
    } else if (arg === '--show-compatibility') {
      showCompat = true
    } else if (arg === '--show-restricted') {
      showRestricted = true
    } else if (arg === '--format' && args[i + 1]) {
      const fmt = args[i + 1]!
      if (!VALID_FORMATS.includes(fmt as CompatOutputFormat)) {
        throw new Error(`不明なフォーマット: ${fmt} (有効なフォーマット: ${VALID_FORMATS.join(', ')})`)
      }
      compatOutputFormat = fmt as CompatOutputFormat
      i++
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
    } else if (arg === '--param' && args[i + 1]) {
      const value = args[i + 1]!
      const eqIndex = value.indexOf('=')
      if (eqIndex === -1) {
        throw new Error('--param は key=value 形式で指定してください')
      }
      params.set(value.slice(0, eqIndex), value.slice(eqIndex + 1))
      i++
    } else if (arg.startsWith('-')) {
      throw new Error(`不明なオプション: ${arg}`)
    } else {
      positional.push(arg)
    }
  }

  if (positional.length === 0 && !showCompat) {
    throw new Error('エンドポイントを指定してください')
  }

  // 先頭の / を除去
  const endpoint = positional.length > 0 ? positional[0]!.replace(/^\//, '') : ''

  const compatMethodFilter = showCompat && methodSpecified ? method.split(',') : null

  return { endpoint, maxPages, offset, method, dryRun, resume, sequential, overwrite, showCompatibility: showCompat, showRestricted, compatMethodFilter, compatOutputFormat, skip, params }
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
    sequential,
    overwrite,
    showCompatibility: showCompat,
    showRestricted,
    compatMethodFilter,
    compatOutputFormat,
    skip,
    params,
  } = parseArgs()

  if (showCompat) {
    await showCompatibility({
      methods: compatMethodFilter,
      showRestricted,
      format: compatOutputFormat,
    })
    return
  }

  const safeName = endpoint.replace(/\//g, '_')

  // ─── ディレクトリ構造 ──────────────────────────────────────────────────

  const endpointDir = resolve(COLLECT_DIR, safeName)
  const pagesDir = resolve(endpointDir, 'pages')
  const fullPath = resolve(endpointDir, 'full.json')
  const nullablePath = resolve(endpointDir, 'nullable.json')

  // ─── スナップショット復元 ──────────────────────────────────────────────

  let tracker = new CoverageTracker()
  let maxPages = origMaxPages
  // offset はスキップするページ数なので、開始ページは offset + 1
  let startPage = origOffset + 1

  if (resume) {
    const snapshot = loadSnapshot(endpointDir)
    if (snapshot) {
      if (snapshot.endpoint !== endpoint || snapshot.method !== method) {
        console.warn(
          `[snapshot] スナップショットのエンドポイント (${snapshot.endpoint}, ${snapshot.method}) が` +
            `現在の指定 (${endpoint}, ${method}) と一致しません。無視します。`,
        )
      } else {
        tracker = CoverageTracker.fromJSON(snapshot.coverage)
        startPage = snapshot.nextPage
        // 残りページ数 = 元の最終ページ - 再開ページ + 1
        const origLastPage = snapshot.offset + 1 + snapshot.maxPages - 1
        maxPages = Math.max(1, origLastPage - startPage + 1)

        console.log(`[snapshot] スナップショットから復元: ページ ${startPage} から再開`)
      }
    } else {
      console.log('[snapshot] スナップショットが見つかりません。最初から開始します。')
    }
  }

  console.log('\n=== 42 API レスポンス収集 ===')
  console.log(`エンドポイント: ${API_BASE}/${endpoint}`)
  console.log(`モード: ${sequential ? 'sequential' : 'probe'}`)
  console.log(`開始ページ: ${startPage}`)
  console.log(`最大ページ数: ${maxPages}`)
  console.log(`ページサイズ: ${PAGE_SIZE}`)
  console.log(`HTTP メソッド: ${method}`)
  console.log(`dry-run: ${dryRun}`)
  console.log(`resume: ${resume}`)
  if (params.size > 0) {
    console.log(`params: ${[...params].map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }
  if (skip.size > 0) {
    console.log(`skip: ${[...skip].join(', ')}`)
  }
  console.log(`出力先: ${endpointDir}/\n`)

  // ─── apidoc 取得 (probe モードで使用) ──────────────────────────────────

  let apidocParams: ApidocParams | null = null

  if (!sequential && !skip.has('fetch')) {
    try {
      apidocParams = await fetchApidocParams(safeName)
      console.log(
        `[apidoc] sort: ${apidocParams.sort.length}, filter: ${apidocParams.filter.length}, range: ${apidocParams.range.length}, page: ${apidocParams.hasPage}`,
      )
    } catch (err) {
      console.warn(
        `[apidoc] パラメータ取得に失敗しました。プローブをスキップして通常 fetch にフォールバックします: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  // ─── Step 1-2: API 収集 ────────────────────────────────────────────────

  let full: unknown
  let nullable: unknown

  if (!skip.has('fetch')) {
    // ─── Probe モード (デフォルト) ────────────────────────────────────────
    if (!sequential && apidocParams && apidocParams.filter.length > 0) {
      console.log(`\n[probe] ${apidocParams.filter.length} 個の filter フィールドをプローブします...\n`)
      const probeResult = await probeNullableFields(endpoint, apidocParams.filter)

      // probe アイテムをキャッシュ + CoverageTracker に投入
      if (probeResult.probeItems.length > 0) {
        saveProbeCache(endpointDir, probeResult.probeItems)
        for (const item of probeResult.probeItems) {
          tracker.update(item)
        }
      }

      // non-nullable フィールドをカバレッジに反映
      for (const field of probeResult.nonNullableFields) {
        tracker.markNonNullable(field)
      }

      // probe サマリー表示
      console.log('\n=== Probe サマリー ===')
      const allFields = apidocParams.filter.map((f) => {
          if (probeResult.nullableFields.has(f)) return { field: f, nullable: 'nullable' as const }
          if (probeResult.nonNullableFields.has(f)) return { field: f, nullable: 'non-nullable' as const }
          return { field: f, nullable: 'failed' as const }
        })
      for (const { field, nullable } of allFields) {
        const cov = tracker.toJSON()[field]
        const value = cov?.hasValue ? '✓' : '-'
        const nil = cov?.hasNull ? '✓' : '-'
        console.log(`  ${field.padEnd(30)} ${nullable.padEnd(14)} value=${value}  null=${nil}`)
      }
      tracker.printProgress()

      // ─── Boolean probe ──────────────────────────────────────────────────
      const booleanFields = apidocParams.filter.filter(isBooleanLikeField)
      if (booleanFields.length > 0) {
        console.log(`\n[probe:bool] ${booleanFields.length} 個の boolean フィールドをプローブします...\n`)

        // nullable probe のアイテム id から seenIds を構築
        const seenIds = new Set<unknown>()
        for (const item of probeResult.probeItems) {
          if (item.id !== undefined) seenIds.add(item.id)
        }

        const boolResult = await probeBooleanFields(endpoint, booleanFields, seenIds)

        if (boolResult.probeItems.length > 0) {
          // nullable probe アイテムとマージして上書き保存
          const mergedProbeItems = [...probeResult.probeItems, ...boolResult.probeItems]
          saveProbeCache(endpointDir, mergedProbeItems)

          for (const item of boolResult.probeItems) {
            tracker.update(item)
          }
        }

        console.log(`\n[probe:bool] ${boolResult.probeItems.length} 件の新規アイテムを取得`)
        if (boolResult.failedFields.length > 0) {
          console.log(`[probe:bool] 失敗: ${boolResult.failedFields.join(', ')}`)
        }
        tracker.printProgress()
      }
    }

    // ─── 通常 fetch (probe/sequential 共通) ──────────────────────────────
    await fetchAllPages(
      endpoint,
      maxPages,
      startPage,
      () => tracker.isFullyCovered(),
      (records) => {
        for (const record of records) {
          tracker.update(record)
        }
        tracker.printProgress()
      },
      {
        params,
        loadCachedPage: (page) => loadPageCache(pagesDir, page)?.items ?? null,
        onPageData: (page, items) => {
          savePageCache(pagesDir, page, items)
        },
        onPageFetched: (nextPage) => {
          saveSnapshot(endpointDir, {
            endpoint,
            method,
            nextPage,
            maxPages: origMaxPages,
            offset: origOffset,
            coverage: tracker.toJSON(),
            savedAt: new Date().toISOString(),
          })
        },
      },
    )

    // 全キャッシュ済みページ + probe アイテムをマージ
    const allCachedPages = loadAllCachedPages(pagesDir)
    const pageItems = allCachedPages.flatMap((p) => p.items)
    const probeItems = loadProbeCache(endpointDir) ?? []
    const allItems = mergeItems(pageItems, probeItems)

    if (allItems.length === 0) {
      throw new Error('レスポンスを 1 件も取得できませんでした')
    }

    console.log(`\n合計 ${allItems.length} 件のレスポンスを収集しました。合成を開始します...\n`)

    // CoverageTracker を全アイテムで再構築
    tracker = new CoverageTracker()
    for (const item of allItems) {
      tracker.update(item)
    }

    // ─── Step 3: 合成 ──────────────────────────────────────────────────────

    if (!skip.has('synthesize')) {
      full = [synthesizeFull(allItems)]
      nullable = [synthesizeNullable(allItems)]

      // ─── Step 4: 中間ファイル書き出し ──────────────────────────────────────

      mkdirSync(endpointDir, { recursive: true })

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
    updateSchema(full!, nullable!, endpointPath, method, dryRun, overwrite)
  } else {
    console.log('[skip] schema をスキップしました')
  }

  // ─── Step 5.5: apidoc パラメータ更新 ──────────────────────────────────

  if (!skip.has('apidoc')) {
    try {
      // probe モードで既に取得済みなら再利用
      if (!apidocParams) {
        apidocParams = await fetchApidocParams(safeName)
        console.log(
          `[apidoc] sort: ${apidocParams.sort.length}, filter: ${apidocParams.filter.length}, range: ${apidocParams.range.length}, page: ${apidocParams.hasPage}`,
        )
      }

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
        updateParameters(endpointPath, method, parameters, dryRun, overwrite)
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

  removeSnapshot(endpointDir)
  console.log('[snapshot] スナップショットを削除しました')

  console.log('\n完了！')
}

/**
 * ページアイテムと probe アイテムを id ベースで重複排除してマージする
 */
function mergeItems(
  pageItems: Record<string, unknown>[],
  probeItems: Record<string, unknown>[],
): Record<string, unknown>[] {
  if (probeItems.length === 0) return pageItems

  const seenIds = new Set<unknown>()
  const merged: Record<string, unknown>[] = []

  for (const item of pageItems) {
    const id = item.id
    if (id !== undefined) seenIds.add(id)
    merged.push(item)
  }

  for (const item of probeItems) {
    const id = item.id
    if (id !== undefined && seenIds.has(id)) continue
    if (id !== undefined) seenIds.add(id)
    merged.push(item)
  }

  return merged
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`\nエラー: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  })
}
