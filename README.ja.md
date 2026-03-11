# 42 Learning Navigator

<div align="center"><a href="./README.md">English</a> | <a href="./README.ja.md">日本語</a></div>

42 の学習ナビゲータです。「今やりたいこと」を自然文で入力すると、目的に合った 42 の課題を検索・推薦します。

42 REST API を GraphQL でラップするゲートウェイ基盤の上に構築されています。

> このリポジトリは [smatsuodev/42-api-graphql-client](https://github.com/smatsuodev/42-api-graphql-client) の fork です。ゲートウェイ層はそのプロジェクトに由来しています。

## アーキテクチャ

```
42 REST API
    │
    ▼
src/collect/          # 42 API をプローブして OpenAPI スキーマを自動生成
    │
    ▼
openapi.yml           # 生成された OpenAPI スキーマ
    │
    ▼
mesh.config.ts        # OpenAPI → GraphQL サブグラフ変換 (GraphQL Mesh)
gateway.config.ts     # Hive Gateway: OAuth トークン注入、/graphql を提供
    │
    ▼
src/navigator/        # (計画中) 学習ナビゲータのドメインロジック
apps/web/             # (計画中) UI 層
```

ゲートウェイ層（`openapi.yml`、`mesh.config.ts`、`gateway.config.ts`）は安定した基盤であり、ナビゲータ開発で壊してはいけません。

## 動作環境

- Bun v1.3.6 以上

## セットアップ

```bash
# 1. リポジトリをクローン
git clone git@github.com:42-hirosuzu/42-learning-navigator.git

# 2. 依存関係をインストール
bun install

# 3. 環境変数を設定
cp .env.example .env
# FT_API_CLIENT_ID と FT_API_CLIENT_SECRET を記入

# 4. GraphQL ゲートウェイを起動
bun start
# https://localhost:4000/graphql にアクセス
```

## 開発コマンド

| コマンド | 説明 |
|---|---|
| `bun start` | スーパーグラフをビルドしてゲートウェイを起動 |
| `bun dev` | ウォッチモード: 設定変更時に自動再ビルド・再起動 |
| `bun collect` | OpenAPI スキーマコレクターを実行 (`src/collect/`) |
| `bun typecheck` | TypeScript 型チェック |
| `bun lint` | リンター実行 (oxlint) |
| `bun lint:fix` | リンター自動修正付きで実行 |
| `bun fmt` | コードフォーマット (oxfmt) |
| `bun fmt:check` | フォーマットチェック |
| `bun test` | 全テスト実行 |

## プロジェクト目標

1. **42 API のドキュメント化** — API プローブで正確な OpenAPI スキーマを自動生成 (`src/collect/`)
2. **GraphQL ゲートウェイ** — 42 API を GraphQL API として公開 (GraphQL Mesh + Hive Gateway)
3. **学習ナビゲータ** — 自然文入力に基づいて 42 課題を推薦 *(MVP 開発中)*

詳細なスコープは [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md)、ロードマップは [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) を参照してください。
