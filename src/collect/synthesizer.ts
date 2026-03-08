/**
 * レスポンス合成 + フィールドカバレッジ追跡
 *
 * 収集した全アイテムから以下の 2 つの合成 JSON を生成する:
 *   - full: すべてのフィールドに非 null の値が入ったオブジェクト
 *   - nullable: 可能な限り null / 空配列のフィールドを持つオブジェクト
 */

// ─── フィールドカバレッジ追跡 ────────────────────────────────────────────────

export interface FieldCoverage {
  /** 非 null / 非空の値を見つけたか */
  hasValue: boolean
  /** null / 空の値を見つけたか */
  hasNull: boolean
}

/**
 * 値が「空」かどうかを判定する
 * - null, undefined → true
 * - 空配列 [] → true
 * - それ以外 → false (空文字列 "", 0, false は「有効な値」)
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

export class CoverageTracker {
  /** フィールドパス → カバレッジ状態 */
  private coverage = new Map<string, FieldCoverage>()

  /**
   * オブジェクトのフィールドを再帰的に走査し、カバレッジを更新する
   */
  update(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key

      if (!this.coverage.has(path)) {
        this.coverage.set(path, { hasValue: false, hasNull: false })
      }
      const entry = this.coverage.get(path)!

      if (isEmpty(value)) {
        entry.hasNull = true
      } else {
        entry.hasValue = true
      }

      // ネストオブジェクトを再帰的に走査
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        this.update(value as Record<string, unknown>, path)
      }

      // 配列の場合、要素を走査してフィールドを収集
      if (Array.isArray(value) && value.length > 0) {
        for (const item of value) {
          if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            this.update(item as Record<string, unknown>, `${path}[]`)
          }
        }
      }
    }
  }

  /**
   * 指定フィールドを non-nullable としてマークする。
   * probe で non-nullable と確認されたフィールドは null サンプル不要なので、
   * カバレッジ上「null 側も確認済み」として扱う。
   */
  markNonNullable(field: string): void {
    const entry = this.coverage.get(field)
    if (entry) {
      entry.hasNull = true
    } else {
      this.coverage.set(field, { hasValue: false, hasNull: true })
    }
  }

  /**
   * カバレッジの進捗を表示する
   */
  printProgress(): void {
    let total = 0
    let bothCovered = 0
    let valueOnly = 0
    let nullOnly = 0

    for (const entry of this.coverage.values()) {
      total++
      if (entry.hasValue && entry.hasNull) bothCovered++
      else if (entry.hasValue) valueOnly++
      else if (entry.hasNull) nullOnly++
    }

    const pct = total > 0 ? Math.round((bothCovered / total) * 100) : 0
    console.log(
      `[coverage] フィールド数: ${total}, 完全カバー: ${bothCovered} (${pct}%), 値のみ: ${valueOnly}, null のみ: ${nullOnly}`,
    )
  }

  /**
   * すべてのフィールドで非 null と null の両方が見つかったかどうか
   */
  isFullyCovered(): boolean {
    if (this.coverage.size === 0) return false
    for (const entry of this.coverage.values()) {
      if (!entry.hasValue || !entry.hasNull) return false
    }
    return true
  }

  /**
   * カバレッジ状態をシリアライズ可能なオブジェクトとして返す
   */
  toJSON(): Record<string, FieldCoverage> {
    return Object.fromEntries(this.coverage)
  }

  /**
   * シリアライズされたカバレッジ状態から CoverageTracker を復元する
   */
  static fromJSON(data: Record<string, FieldCoverage>): CoverageTracker {
    const tracker = new CoverageTracker()
    for (const [path, entry] of Object.entries(data)) {
      tracker.coverage.set(path, { ...entry })
    }
    return tracker
  }

  /**
   * カバレッジサマリーを表示する
   */
  printSummary(): void {
    console.log(`\n=== カバレッジサマリー ===`)
    let uncoveredValue = 0
    let uncoveredNull = 0
    for (const [path, entry] of this.coverage) {
      if (!entry.hasValue) {
        uncoveredValue++
        console.log(`  [値なし] ${path}`)
      }
      if (!entry.hasNull) {
        uncoveredNull++
        console.log(`  [null なし] ${path}`)
      }
    }
    if (uncoveredValue === 0 && uncoveredNull === 0) {
      console.log('  全フィールドで非 null / null の両方のサンプルが見つかりました。')
    } else {
      console.log(
        `\n  非 null 未発見: ${uncoveredValue} フィールド, null 未発見: ${uncoveredNull} フィールド`,
      )
    }
  }
}

// ─── 合成ロジック ────────────────────────────────────────────────────────────

/**
 * 収集された全アイテムから「全フィールドに値が入った」オブジェクトを合成する
 * 各フィールドについて、最初に見つかった非 null 値を採用する
 */
export function synthesizeFull(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {}
  return mergeFields(items, false)
}

/**
 * 収集された全アイテムから「可能な限り null / 空のフィールド」を持つオブジェクトを合成する
 * 各フィールドについて、null / 空配列の値を優先的に採用する
 * null が見つからないフィールドは非 null 値を採用する (フィールドの存在を保証するため)
 */
export function synthesizeNullable(items: Record<string, unknown>[]): Record<string, unknown> {
  if (items.length === 0) return {}
  return mergeFields(items, true)
}

/**
 * 複数のオブジェクトからフィールドをマージして 1 つのオブジェクトを合成する
 * @param preferNull true の場合、null / 空の値を優先する
 */
function mergeFields(
  items: Record<string, unknown>[],
  preferNull: boolean,
): Record<string, unknown> {
  // まず全フィールドのキーを収集
  const allKeys = new Set<string>()
  for (const item of items) {
    for (const key of Object.keys(item)) {
      allKeys.add(key)
    }
  }

  const result: Record<string, unknown> = {}

  for (const key of allKeys) {
    if (preferNull) {
      // null / 空の値を優先
      const nullItem = items.find((item) => key in item && isEmpty(item[key]))
      if (nullItem !== undefined) {
        result[key] = nullItem[key] ?? null
      } else {
        // null が見つからない場合は値を使う（ネストオブジェクトは再帰処理）
        const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
        if (valueItem !== undefined) {
          result[key] = processNestedValue(items, key, preferNull)
        } else {
          result[key] = null
        }
      }
    } else {
      // 非 null の値を優先
      const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
      if (valueItem !== undefined) {
        result[key] = processNestedValue(items, key, preferNull)
      } else {
        // 非 null が見つからない場合は null / 空を使う
        const anyItem = items.find((item) => key in item)
        result[key] = anyItem ? (anyItem[key] ?? null) : null
      }
    }
  }

  return result
}

/**
 * ネストされた値を再帰的に処理する
 */
function processNestedValue(
  items: Record<string, unknown>[],
  key: string,
  preferNull: boolean,
): unknown {
  // 非 null の値を持つアイテムを探す
  const valueItem = items.find((item) => key in item && !isEmpty(item[key]))
  if (!valueItem) return null

  const value = valueItem[key]

  // ネストオブジェクトの場合: 同じキーを持つ全アイテムのネストオブジェクトを収集して再帰マージ
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const nestedItems = items
      .filter(
        (item) =>
          key in item &&
          item[key] !== null &&
          typeof item[key] === 'object' &&
          !Array.isArray(item[key]),
      )
      .map((item) => item[key] as Record<string, unknown>)
    if (nestedItems.length > 0) {
      return mergeFields(nestedItems, preferNull)
    }
    return value
  }

  // 配列の場合: 非空の配列からフィールドを収集して合成
  if (Array.isArray(value)) {
    if (preferNull) {
      // nullable の場合は空配列を返す
      return []
    }
    // full の場合は配列要素がオブジェクトなら再帰マージ
    const allArrayItems: Record<string, unknown>[] = []
    for (const item of items) {
      const arr = item[key]
      if (Array.isArray(arr)) {
        for (const elem of arr) {
          if (elem !== null && typeof elem === 'object' && !Array.isArray(elem)) {
            allArrayItems.push(elem as Record<string, unknown>)
          }
        }
      }
    }
    if (allArrayItems.length > 0) {
      return [mergeFields(allArrayItems, preferNull)]
    }
    return value
  }

  return value
}
