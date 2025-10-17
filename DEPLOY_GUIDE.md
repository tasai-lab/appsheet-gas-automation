# デプロイスクリプト使用ガイド

## 📋 概要

GASプロジェクトのデプロイを効率化する2つのスクリプトを提供しています。

## 🚀 deploy_unified.py（推奨）

**1つのバージョンで複数デプロイメントを一括更新**

### 特徴
- ✅ 1回のバージョン作成で全デプロイメント更新
- ✅ v96, v97, v98のような複数バージョンが作られない
- ✅ シンプルで高速
- ✅ Read-onlyデプロイメントは自動スキップ

### 使用方法

```bash
python deploy_unified.py <プロジェクトフォルダ> "<バージョン説明>"
```

### 例

```bash
# 通話要約プロジェクトをデプロイ
python deploy_unified.py Appsheet_通話_要約生成 "v96: バグ修正"

# 質疑応答プロジェクトをデプロイ
python deploy_unified.py Appsheet_通話_質疑応答 "v33: 新機能追加"
```

### 実行結果

```
======================================================================
  GASデプロイ統合スクリプト
======================================================================

プロジェクト: Appsheet_通話_要約生成
説明: v96: バグ修正

📦 バージョン作成中: v96: バグ修正
✅ バージョン 96 作成完了

📋 既存デプロイメント取得中...
✓ 3件のデプロイメント発見

🔄 デプロイメント更新中（バージョン 96 に統一）

  [1/3] AKfycbzAZNF7KswC_IDkZe2v3H2uCW-HycVawbuxRGxn7... ✓ 更新完了 → @96
  [2/3] AKfycbzhm61db1fl3dXR_YEpJPGJLXiPw8XroaLUm8J0N... ✓ 更新完了 → @96
  [3/3] AKfycbwWd9bHaAHFElB8tZLhVskpEEpp7e5FQl8Ir5ZJ-... ✓ 更新完了 → @96

======================================================================
📊 デプロイ結果サマリー
======================================================================
  ✅ 更新成功: 3件
  ⊘ スキップ: 0件
  ✗ エラー: 0件
  📦 使用バージョン: v96
======================================================================

✨ 全てのデプロイメントがバージョン 96 に統一されました
```

## 📦 deploy_single_project.py

**Google Apps Script API経由で直接デプロイ**（旧方式）

### 特徴
- Apps Script API使用（token.pickle必要）
- より詳細な制御が可能
- 複雑な設定が必要

### 使用方法

1. `deploy_single_project.py`を編集してSCRIPT_IDを設定
2. 実行:

```bash
python deploy_single_project.py
```

### 推奨使用ケース

- clasp経由でうまくいかない場合
- より詳細なエラー情報が必要な場合
- APIレベルでの制御が必要な場合

## 🔧 バックアップファイルについて

### 自動除外設定

`.claspignore`に以下のパターンが追加されており、バックアップファイルはGASにpushされません：

```
**/_backup/**
**/*_backup.gs
**/*_v[0-9]*.gs
```

### バックアップの保存場所

```
gas_projects/
└── Appsheet_通話_要約生成/
    └── scripts/
        ├── _backup/          # ← バックアップフォルダ
        │   ├── core_vertexai_v1_backup.gs
        │   └── core_webhook_v3_backup.gs
        ├── core_vertexai.gs  # ← 本番ファイル
        └── core_webhook_v3.gs
```

## 📝 ベストプラクティス

### 1. デプロイ前の確認

```bash
# 変更をGASにpush
cd gas_projects/Appsheet_通話_要約生成
clasp push

# pushされたファイルを確認
clasp push --watch  # ライブ監視モード
```

### 2. バージョン説明の命名規則

```bash
# 良い例
python deploy_unified.py Appsheet_通話_要約生成 "v96: API統合最適化"
python deploy_unified.py Appsheet_通話_要約生成 "v97: バグ修正 - 依頼作成エラー"

# 避けるべき例
python deploy_unified.py Appsheet_通話_要約生成 "update"  # 曖昧
python deploy_unified.py Appsheet_通話_要約生成 "fix"     # 内容不明
```

### 3. デプロイ後の確認

```bash
# デプロイメント一覧を確認
cd gas_projects/Appsheet_通話_要約生成
clasp deployments

# 結果例:
# - AKfycbx4cdha7ofILNwasxkVnPV9FcvjuyYOSM0NEEkgnc0o @HEAD
# - AKfycbzAZNF7KswC_IDkZe2v3H2uCW-HycVawbuxRGxn75CGcNqD9hzTE7mZPqb7xusBQ-06Pg @96
# - AKfycbzhm61db1fl3dXR_YEpJPGJLXiPw8XroaLUm8J0NAJyYQwutKSFINsKHKbBoxutEhfriA @96
# - AKfycbwWd9bHaAHFElB8tZLhVskpEEpp7e5FQl8Ir5ZJ-5ZAvutzGbkdLtOwW-F-_ay-33xcFQ @96
```

## ⚠️ トラブルシューティング

### エラー: "Read-only deployment"

**原因**: @HEADデプロイメントは読み取り専用

**対処**: 自動スキップされるため、問題なし

### エラー: "Project not found"

**原因**: プロジェクトパスが間違っている

**対処**:
```bash
# 正しいフォルダ名を確認
ls gas_projects/

# 正しい名前で再実行
python deploy_unified.py Appsheet_通話_要約生成 "v96: 修正"
```

### 複数バージョンが作成される

**原因**: 古いデプロイ方法を使用している

**対処**: `deploy_unified.py`を使用する

```bash
# ❌ 旧方式（各デプロイで個別にバージョン作成）
clasp deploy -i XXXXX -d "description"  # → v96
clasp deploy -i YYYYY -d "description"  # → v97
clasp deploy -i ZZZZZ -d "description"  # → v98

# ✅ 新方式（1つのバージョンで全て更新）
python deploy_unified.py Appsheet_通話_要約生成 "v96: description"
# → 全てのデプロイメントが v96 に統一
```

## 📊 比較表

| 機能 | deploy_unified.py | deploy_single_project.py |
|------|-------------------|--------------------------|
| バージョン管理 | ⭐ 1つに統一 | 複数作成される可能性 |
| 実行速度 | ⚡ 高速 | やや遅い |
| 設定の簡単さ | ⭐ 簡単 | token.pickle必要 |
| エラー情報 | 標準 | 詳細 |
| 推奨度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🎯 まとめ

**通常のデプロイには `deploy_unified.py` を使用してください。**

```bash
# 基本的なデプロイコマンド
python deploy_unified.py <プロジェクト名> "<バージョン説明>"
```

これにより、1つのバージョンで全てのデプロイメントが統一され、バージョン履歴が整理されます。

---

**最終更新**: 2025年10月17日
