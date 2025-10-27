# Claude Code設定ガイド

このディレクトリには、Claude Code (claude.ai/code) がこのプロジェクトで効率的に作業するための設定ファイルが含まれています。

## ディレクトリ構造

```
.claude/
├── README.md                    # このファイル
├── CLAUDE.md                    # プロジェクト概要とガイダンス（必読）
├── settings.json                # プロジェクト共有設定（Git管理対象）
├── settings.local.json          # 個人用設定（Git除外）
└── commands/                    # カスタムコマンド
    ├── deploy.md               # GASデプロイコマンド
    ├── retrieve.md             # Drive取得コマンド
    ├── analyze-project.md      # プロジェクト分析コマンド
    ├── check-logs.md           # ログ確認コマンド
    ├── optimize-scripts.md     # スクリプト最適化コマンド
    └── test-project.md         # テスト関数確認コマンド
```

## 設定ファイルの説明

### CLAUDE.md

プロジェクトの全体像、アーキテクチャ、開発コマンド、ベストプラクティスを記載した最も重要なドキュメント。Claude Codeはこのファイルを参照してプロジェクトを理解します。

**主な内容:**
- 32個以上のGASプロジェクトの管理方法
- 3層システム設計（Python自動化、共通モジュール、GASプロジェクト）
- Vertex AI統合パターン
- デプロイ手順とベストプラクティス

### settings.json

プロジェクト全体で共有される設定。チーム全員に適用される権限ルールやhooksを定義します。

**主な機能:**
- **権限管理**: 許可/拒否/確認が必要なツール操作を制御
- **Hooks**: ファイル編集後の自動処理（Pythonコンパイルチェック等）
- **環境変数**: プロジェクト固有の環境設定

### settings.local.json

個人用の設定ファイル。Gitで除外されるため、個人の好みに応じた設定が可能です。

### commands/

スラッシュコマンド（`/deploy`, `/retrieve`等）として利用可能なカスタムコマンド。頻繁に使用するワークフローを簡単に実行できます。

## カスタムコマンドの使い方

Claude Codeで `/` を入力すると、利用可能なコマンドのリストが表示されます：

- `/deploy` - GASプロジェクトをデプロイ
- `/retrieve` - Google DriveからGASプロジェクトを取得
- `/analyze-project` - プロジェクト構造を分析
- `/check-logs` - 実行ログを確認
- `/optimize-scripts` - 共通モジュールを適用
- `/test-project` - テスト関数を確認

## 権限設定の概要

### 自動許可（allow）

以下の操作は確認なしで自動実行されます：

- Python関連コマンド（`python`, `python3`, `python -m py_compile`）
- clasp関連コマンド（`clasp status`, `clasp open`等）※pushを除く
- git関連コマンド（`git status`, `git diff`, `git log`, `git add`, `git commit`等）※pushを除く
- 基本的なファイル操作（`ls`, `cat`, `find`, `grep`, `mkdir`, `mv`, `cp`）
- Web検索とドキュメント取得（特定のドメインのみ）

### 確認が必要（ask）

以下の操作は実行前に確認が求められます：

- `git push` - リモートへのプッシュ
- `clasp push` - GASへのデプロイ
- `git reset --hard` - 破壊的なgit操作
- `git rebase` - 履歴の書き換え
- `rm -rf` - 一括削除
- `gcloud deploy` - GCPデプロイ

### 拒否（deny）

以下のファイルへのアクセスは完全にブロックされます：

- `.env`, `.env.*` - 環境変数ファイル
- `credentials.json` - 認証情報
- `token.pickle` - 認証トークン
- `secrets/**` - 機密情報ディレクトリ

## Hooksの仕組み

### PostToolUse Hooks

ファイル編集後に自動実行される処理：

```json
{
  "PostToolUse": {
    "Write(**.py)": "python -m py_compile \"$FILE_PATH\" 2>&1 || true",
    "Edit(**.py)": "python -m py_compile \"$FILE_PATH\" 2>&1 || true"
  }
}
```

Pythonファイルを作成・編集すると、自動的に構文チェックが実行されます。

## .claudeignore

プロジェクトルートの `.claudeignore` ファイルで、Claude Codeがアクセスすべきでないファイルやディレクトリを指定できます。

**除外対象:**
- 認証情報と機密ファイル
- バックアップファイル（`*_backup.gs`, `**/_backup/`等）
- ビルド成果物とキャッシュ
- IDE設定
- ログファイル

## 設定のカスタマイズ

### 個人用設定の追加

`.claude/settings.local.json` に個人用の設定を追加できます：

```json
{
  "permissions": {
    "allow": [
      "Bash(custom-command:*)"
    ]
  },
  "env": {
    "MY_CUSTOM_VAR": "value"
  }
}
```

### 新しいカスタムコマンドの追加

`.claude/commands/` ディレクトリに新しいMarkdownファイルを作成：

```markdown
---
description: コマンドの簡単な説明
---

詳細な手順やプロンプト...
```

## トラブルシューティング

### 権限エラーが発生する場合

`settings.json` の `permissions.allow` に該当するコマンドパターンを追加してください。

### カスタムコマンドが表示されない場合

- ファイル名が `.md` 拡張子で終わっているか確認
- frontmatter（`---`で囲まれた部分）に `description` が含まれているか確認

### Hooksが動作しない場合

- ファイルパスパターンが正しいか確認
- コマンドが実行可能か確認（例: `python` コマンドがPATHに含まれているか）

## 参考リンク

- [Claude Code公式ドキュメント](https://docs.claude.com/en/docs/claude-code)
- [設定ガイド](https://docs.claude.com/en/docs/claude-code/settings)
- [Hooksガイド](https://docs.claude.com/en/docs/claude-code/hooks-guide)
