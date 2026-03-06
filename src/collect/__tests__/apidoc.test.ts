import { describe, expect, test } from 'bun:test'
import { parseApidocHtml } from '../apidoc'

// ─── テスト用HTMLフィクスチャ ─────────────────────────────────────────────────

const SAMPLE_HTML = `
<div id='method-params'>
<h3>Params</h3>
<table class='table'>
<thead>
<tr><th>Param name</th><th>Description</th></tr>
</thead>
<tbody>
<tr data-level='0'>
<td><strong>sort</strong></td>
<td>
<span>. Must be one of: <code>id</code>, <code>name</code>, <code>created_at</code>.</span>
</td>
</tr>
<tr data-level='0'>
<td><strong>filter</strong></td>
<td>
<span>. Must be one of: <code>id</code>, <code>name</code>, <code>active</code>, <code>future</code>.</span>
<div class='collapse' id='collapseFilter'>
<h5>Filterable fields:</h5>
<ul>
<li><b>id </b>(standard field)</li>
<li><b>name </b>(standard field)</li>
<li><b>active </b>(standard field)</li>
<li><b>future </b>(special filter)</li>
</ul>
</div>
</td>
</tr>
<tr data-level='0'>
<td><strong>range</strong></td>
<td>
<span>. Must be one of: <code>id</code>, <code>created_at</code>.</span>
<div class='collapse' id='collapseRange'>
<h5>Rangeable fields:</h5>
<ul>
<li><b>id</b></li>
<li><b>created_at</b></li>
</ul>
</div>
</td>
</tr>
<tr data-level='0'>
<td><strong>page[number]</strong></td>
<td><span>. Must be Fixnum</span></td>
</tr>
<tr data-level='0'>
<td><strong>page[size]</strong></td>
<td><span>. Must be Fixnum</span></td>
</tr>
</tbody>
</table>
</div>
`

// ─── parseApidocHtml ─────────────────────────────────────────────────────────

describe('parseApidocHtml - sort', () => {
  test('sortフィールド一覧を抽出する', () => {
    const result = parseApidocHtml(SAMPLE_HTML)
    expect(result.sort).toEqual(['id', 'name', 'created_at'])
  })

  test('sortパラメータがない場合は空配列を返す', () => {
    const html = '<div id="method-params"><table class="table"><tbody></tbody></table></div>'
    const result = parseApidocHtml(html)
    expect(result.sort).toEqual([])
  })
})

describe('parseApidocHtml - filter', () => {
  test('filterフィールド一覧を抽出する', () => {
    const result = parseApidocHtml(SAMPLE_HTML)
    expect(result.filter).toEqual(['id', 'name', 'active', 'future'])
  })

  test('filterパラメータがない場合は空配列を返す', () => {
    const html = '<div id="method-params"><table class="table"><tbody></tbody></table></div>'
    const result = parseApidocHtml(html)
    expect(result.filter).toEqual([])
  })
})

describe('parseApidocHtml - range', () => {
  test('rangeフィールド一覧を抽出する', () => {
    const result = parseApidocHtml(SAMPLE_HTML)
    expect(result.range).toEqual(['id', 'created_at'])
  })

  test('rangeパラメータがない場合は空配列を返す', () => {
    const html = '<div id="method-params"><table class="table"><tbody></tbody></table></div>'
    const result = parseApidocHtml(html)
    expect(result.range).toEqual([])
  })
})

describe('parseApidocHtml - page', () => {
  test('page[number]とpage[size]がある場合hasPageはtrueになる', () => {
    const result = parseApidocHtml(SAMPLE_HTML)
    expect(result.hasPage).toBe(true)
  })

  test('pageパラメータがない場合hasPageはfalseになる', () => {
    const html = '<div id="method-params"><table class="table"><tbody></tbody></table></div>'
    const result = parseApidocHtml(html)
    expect(result.hasPage).toBe(false)
  })
})

describe('parseApidocHtml - sortのみのページ', () => {
  test('sortだけがある場合、他は空/falseになる', () => {
    const html = `
    <div id='method-params'>
    <table class='table'><tbody>
    <tr data-level='0'>
    <td><strong>sort</strong></td>
    <td><span>. Must be one of: <code>id</code>, <code>name</code>.</span></td>
    </tr>
    </tbody></table>
    </div>
    `
    const result = parseApidocHtml(html)
    expect(result.sort).toEqual(['id', 'name'])
    expect(result.filter).toEqual([])
    expect(result.range).toEqual([])
    expect(result.hasPage).toBe(false)
  })
})
