# RAGシステム ドキュメント

**最終更新**: 2025-10-28
**バージョン**: V3（Cloud SQL移行）
**総ドキュメント数**: 10個

---

## 🎉 最新情報 (2025-10-28)

### 🚀 V3プロジェクト開始
- **Cloud SQL (MySQL)** への移行プロジェクト開始
- **プロンプト最適化機能** 追加（Gemini 2.5 Flash-Lite）
- **検索精度向上**: 類似度上位20件、利用者情報自動組み込み
- **パフォーマンス目標**: 検索1-2秒、全体5-8秒以内
- **期間**: 6週間（2025-10-28 〜 2025-12-09）

### 📝 ドキュメント整理完了
- **32個 → 10個**（-69%）に最適化
- V2関連ドキュメント・アーカイブ全削除
- ファイル名を簡潔化（V3_SUMMARY、V3_ARCHITECTURE等）

---

## 📚 ドキュメント構成

### 🚀 V3プロジェクト（5個）

1. **[V3_SUMMARY.md](V3_SUMMARY.md)** ⭐ **まずはこれを読む**
   - V3プロジェクト総合サマリー
   - 目標、スケジュール、期待される効果、コスト分析

2. **[V3_ARCHITECTURE.md](V3_ARCHITECTURE.md)**
   - V3アーキテクチャ設計書
   - Cloud SQL、プロンプト最適化、進捗バー、データベーススキーマ

3. **[V3_ROADMAP.md](V3_ROADMAP.md)**
   - V2 → V3 移行ロードマップ
   - 6週間、38日、17タスク、Phase別詳細計画

4. **[V3_TASKS.md](V3_TASKS.md)**
   - V3タスクバックログ
   - Phase別タスク詳細、優先度、見積もり

5. **[PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md)**
   - プロジェクト管理ガイド
   - 開発ワークフロー、タスク管理、ブランチ戦略

---

### 📖 コアドキュメント（5個）

6. **[01_PROJECT_OVERVIEW.md](01_PROJECT_OVERVIEW.md)**
   - プロジェクト概要
   - ビジョン、技術スタック、プロジェクトゴール

7. **[04_API_SPECIFICATION.md](04_API_SPECIFICATION.md)**
   - API仕様書
   - エンドポイント、リクエスト/レスポンス形式、認証

8. **[07_SECURITY.md](07_SECURITY.md)**
   - セキュリティ設計
   - 認証、データ保護、個人情報マスキング、GDPR準拠

9. **[ERROR_LOG.md](ERROR_LOG.md)** ⭐ **開発前に必ず確認**
   - エラー記録・教訓
   - 過去の失敗例と再発防止策（API呼び出しリトライループ等）

10. **[DECISIONS.md](DECISIONS.md)**
    - アーキテクチャ決定記録（ADR）
    - 技術選定の理由と背景（Vertex AI、Reranker、Cloud SQL等）

---

## 🗺️ ドキュメントナビゲーション

### 新規参加者向け

1. **[V3_SUMMARY.md](V3_SUMMARY.md)** - プロジェクト全体像を理解
2. **[V3_ARCHITECTURE.md](V3_ARCHITECTURE.md)** - アーキテクチャを学習
3. **[ERROR_LOG.md](ERROR_LOG.md)** - 過去の失敗例を確認
4. **[PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md)** - 開発フロー理解

### 実装担当者向け

**Backend開発者:**
1. [V3_ARCHITECTURE.md](V3_ARCHITECTURE.md) - Section 3（データベース設計）
2. [V3_ROADMAP.md](V3_ROADMAP.md) - Phase 1-2
3. [V3_TASKS.md](V3_TASKS.md) - Backend タスク
4. [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) - API仕様

**Frontend開発者:**
1. [V3_ARCHITECTURE.md](V3_ARCHITECTURE.md) - Section 7（UI/UX改善）
2. [V3_ROADMAP.md](V3_ROADMAP.md) - Phase 3
3. [V3_TASKS.md](V3_TASKS.md) - Frontend タスク
4. [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) - API統合

**DevOps担当者:**
1. [V3_ARCHITECTURE.md](V3_ARCHITECTURE.md) - Section 3.1（Cloud SQL）
2. [V3_ROADMAP.md](V3_ROADMAP.md) - Phase 0, Phase 4
3. [07_SECURITY.md](07_SECURITY.md) - セキュリティ設定

### プロジェクトマネージャー向け

1. [V3_SUMMARY.md](V3_SUMMARY.md) - 全体概要
2. [V3_ROADMAP.md](V3_ROADMAP.md) - スケジュール
3. [PROJECT_MANAGEMENT.md](PROJECT_MANAGEMENT.md) - 管理フロー
4. [V3_TASKS.md](V3_TASKS.md) - タスク詳細

---

## 🔍 よくある質問（FAQ）

| 質問 | ドキュメント |
|------|------------|
| V3プロジェクトの目標は？ | [V3_SUMMARY.md](V3_SUMMARY.md) |
| Cloud SQLのスキーマは？ | [V3_ARCHITECTURE.md](V3_ARCHITECTURE.md#31-cloud-sql-mysql-スキーマ) |
| プロンプト最適化の仕様は？ | [V3_ARCHITECTURE.md](V3_ARCHITECTURE.md#4-プロンプト最適化機能) |
| タスクの詳細は？ | [V3_TASKS.md](V3_TASKS.md) |
| スケジュールは？ | [V3_ROADMAP.md](V3_ROADMAP.md) |
| 過去のエラーは？ | [ERROR_LOG.md](ERROR_LOG.md) |
| API仕様は？ | [04_API_SPECIFICATION.md](04_API_SPECIFICATION.md) |
| セキュリティ設計は？ | [07_SECURITY.md](07_SECURITY.md) |

---

## 📊 ドキュメント最適化統計

| 項目 | 整理前 | 整理後 | 改善率 |
|------|-------|--------|--------|
| **総ドキュメント数** | 32個 | 10個 | **-69%** |
| **V3プロジェクト** | 0個 | 5個 | **+∞** |
| **コアドキュメント** | 6個 | 5個 | 変更なし |
| **V2関連（削除）** | 15個 | 0個 | **-100%** |
| **重複（削除）** | 5個 | 0個 | **-100%** |
| **アーカイブ（削除）** | 8個 | 0個 | **-100%** |

---

## 🔄 次のステップ（V3プロジェクト）

### 即座に着手すべきタスク

1. **[Task 0.1] 設計レビュー** 🔴 High
   - V3_ARCHITECTURE.md のレビュー
   - ステークホルダー承認

2. **[Task 0.2] 開発環境準備** 🔴 High
   - GCP プロジェクト設定
   - ローカル環境セットアップ

3. **[Task 0.3] Cloud SQL インスタンス作成** 🔴 High
   - db-n1-standard-2 インスタンス作成
   - 初期設定

### 週次計画

**Week 1（2025-10-28〜11-03）:**
- Phase 0完了
- Cloud SQL稼働開始

**Week 2-6（2025-11-04〜12-09）:**
- Phase 1-4実装
- 詳細は [V3_ROADMAP.md](V3_ROADMAP.md) 参照

---

## 🆘 サポート

- **Slack**: `#rag-v3-project`
- **GitHub**: Issues / Discussions
- **Email**: rag-team@example.com

---

**管理者**: Claude (AI Assistant)
**最終更新**: 2025-10-28
**次回レビュー**: 毎週月曜日
