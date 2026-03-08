import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface CachedPage {
  page: number
  items: Record<string, unknown>[]
  fetchedAt: string
}

export function savePageCache(pagesDir: string, page: number, items: Record<string, unknown>[]): void {
  mkdirSync(pagesDir, { recursive: true })
  const filePath = join(pagesDir, `page_${page}.json`)
  const data: CachedPage = { page, items, fetchedAt: new Date().toISOString() }
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
}

export function loadPageCache(pagesDir: string, page: number): CachedPage | null {
  const filePath = join(pagesDir, `page_${page}.json`)
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, 'utf-8')) as CachedPage
}

export function loadAllCachedPages(pagesDir: string): CachedPage[] {
  if (!existsSync(pagesDir)) return []
  const files = readdirSync(pagesDir).filter((f) => /^page_\d+\.json$/.test(f))
  return files
    .map((f) => JSON.parse(readFileSync(join(pagesDir, f), 'utf-8')) as CachedPage)
    .sort((a, b) => a.page - b.page)
}

// ─── Probe キャッシュ ────────────────────────────────────────────────────────

const PROBES_FILE = 'probes.json'

export function saveProbeCache(endpointDir: string, items: Record<string, unknown>[]): void {
  mkdirSync(endpointDir, { recursive: true })
  writeFileSync(resolve(endpointDir, PROBES_FILE), JSON.stringify(items, null, 2) + '\n')
}

export function loadProbeCache(endpointDir: string): Record<string, unknown>[] | null {
  const filePath = resolve(endpointDir, PROBES_FILE)
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>[]
}
