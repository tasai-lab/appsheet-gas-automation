# ドキュメント総合インデックス

このディレクトリには、Google Apps Script自動化プロジェクトの全てのドキュメントが含まれています。

## 📚 メインドキュメント

### 🎯 推奨: 日本語ドキュメント

**[ja/README.md](ja/README.md)** ⭐ - プロジェクト総合ドキュメント
- プロジェクト概要と管理対象32プロジェクト
- システム構成とセットアップ手順
- 使用方法とトラブルシューティング

新規ユーザーは以下の順序で読むことをお勧めします：

1. **[ja/README.md](ja/README.md)** - プロジェクト全体を理解
2. **[ja/Geminiモデル仕様.md](ja/Geminiモデル仕様.md)** - Gemini APIの使い方を学習
3. **[ja/デプロイガイド.md](ja/デプロイガイド.md)** - デプロイ方法を習得


## 🔧 技術ドキュメント

### Gemini API関連

**[ja/Geminiモデル仕様.md](ja/Geminiモデル仕様.md)** ⭐
- 最新モデル情報（2025年1月時点）
- モデル選択ガイド（Flash vs Thinking）
- API仕様、パラメータ調整、エラーハンドリング

**[GEMINI_VS_VERTEX_COMPARISON.md](../GEMINI_VS_VERTEX_COMPARISON.md)** ※英語参照用
- Gemini API vs Vertex AI の比較分析

**[GEMINI_MODEL_REFERENCE.md](GEMINI_MODEL_REFERENCE.md)** ※英語参照用
- Gemini APIの詳細リファレンス

### システム機能

**[ja/重複防止機能.md](ja/重複防止機能.md)** ⭐
- Webhook重複実行の解決策
- リクエストID方式の実装
- パフォーマンス考慮事項

**[DUPLICATION_PREVENTION_GUIDE.md](../DUPLICATION_PREVENTION_GUIDE.md)** ※英語参照用
- 重複防止ライブラリ使用ガイド

**[ja/実行ログ管理.md](ja/実行ログ管理.md)** ⭐
- 実行ログシステムの完全ガイド
- スプレッドシート構造とログ記録
- ログ活用とメンテナンス

### デプロイメント

**[ja/デプロイガイド.md](ja/デプロイガイド.md)** ⭐
- デプロイ手順（手動・自動）
- バージョン管理とロールバック
- Webhook URL管理

## 🛠️ 開発者向けドキュメント

### システム設計

**[ARCHITECTURE.md](ARCHITECTURE.md)** ※英語
- システム全体のアーキテクチャ
- レイヤー構成とモジュール詳細
- シーケンス図、データフロー図

**[DATA_MODELS.md](DATA_MODELS.md)** ※英語
- データモデル仕様（GASFile, SpreadsheetInfo等）
- クラス図、ER図

**[SERVICE_CLASSES.md](SERVICE_CLASSES.md)** ※英語
- サービスクラスの詳細仕様
- AuthService, DriveService, ScriptService等

### ツール仕様書

**[RETRIEVE_GAS_SPEC.md](RETRIEVE_GAS_SPEC.md)** ※英語
- GAS取得ツールの完全仕様
- コマンドライン引数、処理フロー

**[APPLY_DEDUP_SPEC.md](APPLY_DEDUP_SPEC.md)** ※英語
- 重複防止適用ツールの完全仕様
- 分析ロジック、適用条件


## 📂 フォルダー構造

```
docs/
├── ja/                                    # 日本語ドキュメント（メイン） ⭐
│   ├── README.md                         # プロジェクト総合ドキュメント
│   ├── Geminiモデル仕様.md               # Gemini API完全ガイド
│   ├── 重複防止機能.md                   # 重複防止システム
│   ├── 実行ログ管理.md                   # ログ管理システム
│   └── デプロイガイド.md                 # デプロイ手順
│
├── README.md                              # このファイル（総合インデックス）
├── ARCHITECTURE.md                        # システムアーキテクチャ（英語）
├── API_REFERENCE.md                       # APIリファレンス（英語）
├── DATA_MODELS.md                         # データモデル（英語）
├── SERVICE_CLASSES.md                     # サービスクラス（英語）
├── GEMINI_MODEL_REFERENCE.md              # Geminiモデルリファレンス（英語）
├── GEMINI_VS_VERTEX_AI.md                 # Gemini vs Vertex比較（英語）
├── RETRIEVE_GAS_SPEC.md                   # GAS取得仕様（英語）
└── APPLY_DEDUP_SPEC.md                    # 重複防止仕様（英語）
```

## 🗺️ ドキュメントナビゲーション

### 目的別ガイド

**初めての方**
1. [ja/README.md](ja/README.md) - プロジェクト概要
2. [SETUP_GUIDE_JP.md](../SETUP_GUIDE_JP.md) - セットアップ手順

**API使用方法を知りたい**
- [ja/Geminiモデル仕様.md](ja/Geminiモデル仕様.md) - Gemini API完全ガイド
- [API_REFERENCE.md](API_REFERENCE.md) - 全般的なAPI（英語）

**システムを理解したい開発者**
1. [ARCHITECTURE.md](ARCHITECTURE.md) - アーキテクチャ
2. [DATA_MODELS.md](DATA_MODELS.md) - データ構造
3. [SERVICE_CLASSES.md](SERVICE_CLASSES.md) - サービスクラス

**デプロイ・運用担当者**
1. [ja/デプロイガイド.md](ja/デプロイガイド.md) - デプロイ手順
2. [ja/実行ログ管理.md](ja/実行ログ管理.md) - ログ運用

**トラブルシューティング**
- [ja/README.md](ja/README.md) - よくある問題
- [ja/デプロイガイド.md](ja/デプロイガイド.md) - デプロイ関連
- [ja/重複防止機能.md](ja/重複防止機能.md) - 重複問題


## 🔍 よくある質問（FAQ）

| 質問 | ドキュメント |
|-----|-------------|
| プロジェクト全体を知りたい | [ja/README.md](ja/README.md) |
| Gemini APIの使い方は? | [ja/Geminiモデル仕様.md](ja/Geminiモデル仕様.md) |
| デプロイ方法は? | [ja/デプロイガイド.md](ja/デプロイガイド.md) |
| 重複実行を防ぐには? | [ja/重複防止機能.md](ja/重複防止機能.md) |
| ログを確認したい | [ja/実行ログ管理.md](ja/実行ログ管理.md) |
| システム構造を理解したい | [ARCHITECTURE.md](ARCHITECTURE.md) |
| データ構造は? | [DATA_MODELS.md](DATA_MODELS.md) |
| カスタマイズしたい | [SERVICE_CLASSES.md](SERVICE_CLASSES.md) |

## ✅ ドキュメント品質管理

### 更新履歴

| 日付 | バージョン | 変更内容 |
|-----|-----------|---------|
| 2025-10-16 | 3.0 | 日本語ドキュメントに統合・整理 |
| 2025-10-16 | 2.0 | リファクタリング後の全ドキュメント作成 |
| 2025-10-16 | 1.0 | 初版（モノリシック版） |

### 統合・整理の詳細

**削除されたドキュメント（内容は統合済み）:**
- GEMINI_LATEST_MODELS_2025.md → Geminiモデル仕様.mdに統合
- GEMINI_MODEL_INFO.md → Geminiモデル仕様.mdに統合
- GEMINI_MODEL_OPTIMIZATION_LOG.md → 不要（実装完了）
- GEMINI_MODEL_OPTIMIZATION_RECORD.md → 不要（実装完了）
- GEMINI_MODEL_UPDATE_LOG.md → 不要（実装完了）
- GEMINI_OPTIMIZATION_IMPLEMENTATION.md → 不要（実装完了）
- GEMINI_OPTIMIZATION_REPORT.md → 不要（実装完了）
- IMPLEMENTATION_REPORT.md → README.mdに統合
- IMPLEMENTATION_SUMMARY.md → README.mdに統合
- MIGRATION_ANALYSIS.md → README.mdに統合
- OPTIMIZATION_COMPLETION_REPORT.md → README.mdに統合
- OPTIMIZATION_PLAN.md → README.mdに統合
- PROJECT_COMPLETION_REPORT.md → README.mdに統合
- REFACTORING_REPORT.md → README.mdに統合
- README_NEW.md → README.mdに統合

**保持されたドキュメント:**
- GEMINI_VS_VERTEX_COMPARISON.md → 参照用として保持
- DUPLICATION_PREVENTION_GUIDE.md → 英語参照用として保持
- SETUP_GUIDE_JP.md → セットアップガイドとして保持

## 📧 フィードバック

ドキュメントの改善提案や誤りの報告は、実行ログスプレッドシートまたは開発チームまでお願いします。

## 🤝 コントリビューション

ドキュメントの改善提案はIssuesでお願いします。

---

**Last Updated**: 2025-10-16  
**Version**: 3.0  
**Maintainer**: Development Team
