---
name: collect-endpoint
description: 42 APIの未対応エンドポイントのOpenAPIスキーマを自動生成するワークフロー。未対応APIの調査、スキーマ収集、openapi.ymlの手動修正が必要な箇所の検出と修正を行う。`bun collect`で新しいAPIエンドポイントを追加したい時に使う。
---

# collect-endpoint: 42 API エンドポイント収集ワークフロー

42 APIの未対応エンドポイントを調査し、`bun collect`でOpenAPIスキーマを自動生成した後、手動修正が必要な箇所を検出・修正するワークフローです。

## ワークフロー

### Step 0: ブランチの確認

mainブランチにいることを確認する。もしmainブランチでなければ、別のcollectを実行中の可能性が高いので、ここでタスクを中断する

### Step 1: 未対応エンドポイントの調査

`bun collect --show-compatibility --method GET --format json` を実行し、未対応のAPIエンドポイントを一覧表示する。

出力はJSON形式で、各エントリに `supported: false` のエンドポイントが未対応。一番上の未対応のエンドポイントを選び、`support-get-<エンドポイント名>`ブランチを作成し移動する

### Step 2: スキーマ収集

一番上の未対応のエンドポイントに対して `bun collect <endpoint>` を実行する。

- `<endpoint>` は `/v2/` 以降のパス部分（例: `achievements`, `campus`）
- 実行にはAPIキーが必要（環境変数 `FT_API_CLIENT_ID`, `FT_API_CLIENT_SECRET`）
- レート制限があるため（2req/sec, 1200req/hour）、実行完了まで待つ
- エラーが出た場合は `--resume` フラグで再開可能

実行結果のログを確認し、ステップごとの進行状況をユーザーに伝える。

### Step 3: openapi.yml の差分確認

`git diff openapi.yml` を実行して変更内容を確認する。

### Step 4: 手動修正が必要な箇所の検出と修正

openapi.ymlの変更差分の中から、以下のパターンを検出して修正する:

#### 4a: `type: 'null'` の修正

`bun collect`のスキーマ推論では、APIレスポンスのfull.jsonとnullable.jsonの両方でフィールドがnullだった場合、型を推論できず `type: 'null'` になる。

これは有効なOpenAPI型ではないため、手動で正しい型に修正する必要がある。修正方針:
- フィールド名から型を推測する（例: `_id` → integer, `_at` → string, `_url` → string, `name` → string）
- 同じAPI内の似たフィールドの型を参考にする
- 確信が持てない場合はユーザーに確認する
- 修正する場合は `nullable: true` を付ける（元々null値しか観測されなかったため）

#### 4b: 空の `items: {}` の修正

配列フィールドで要素が空だった場合、`items: {}` になる。可能であればフィールド名やAPIの文脈から適切な型を推測する。確信が持てない場合は TODO コメント等でマークしてユーザーに伝える。

#### 4c: その他の問題

- 型の不整合（同じフィールドがintegerとstringの両方で出現する場合等）
- 不自然なスキーマ構造

### Step 5: 完了報告

変更点をcommitしてpushし、ghコマンドを使ってPRを作成する。
その時に、以下の点をコメントする
- 追加したエンドポイント
- 手動修正した箇所とその理由
- 残っている既知の問題（あれば）

PRが作成できたらmainブランチに戻る