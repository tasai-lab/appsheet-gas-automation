# AppSheet-GAS Automation Platform

**プロジェクト**: AppSheet + Google Apps Script 自動化プラットフォーム
**組織**: Fractal Group
**GCP プロジェクト**: `macro-shadow-458705-v8`
**最終更新**: 2025-10-18

---

## 📋 概要

このリポジトリは、AppSheetとGoogle Apps Script (GAS)を組み合わせた、訪問看護・営業・クライアント管理の自動化プラットフォームです。Vertex AIを活用した文書処理、音声記録、データ抽出などの機能を提供します。

### 主な機能

- **訪問看護支援**: 書類OCR、記録生成、計画書管理
- **営業支援**: 音声記録、レポート生成、ファイル管理
- **クライアント管理**: 基本情報管理、質疑応答、フェースシート作成
- **通話処理**: 要約生成、イベント・タスク作成、スレッド投稿
- **文書自動化**: レシート処理、請求書データ抽出

---

## 🗂️ プロジェクト構成

```
gas_projects/
├── README.md                    # このファイル
├── docs/                        # 全体ドキュメント
│   ├── architecture/            # アーキテクチャ設計
│   ├── development/             # 開発ガイド
│   ├── migration/               # 移行ガイド
│   ├── security/                # セキュリティ関連
│   └── api-reference/           # API リファレンス
├── projects/                    # アクティブプロジェクト
│   ├── nursing/                 # 訪問看護 (8プロジェクト)
│   ├── sales/                   # 営業 (3プロジェクト)
│   ├── calls/                   # 通話 (5プロジェクト)
│   ├── clients/                 # クライアント管理 (6プロジェクト)
│   ├── common/                  # 共通機能 (6プロジェクト)
│   └── automation/              # 自動化 (2プロジェクト)
├── shared/                      # 共通リソース
│   ├── modules/                 # 共通モジュール
│   └── lib/                     # ライブラリ
└── _archived/                   # アーカイブ済みプロジェクト
```

---

## 🚀 プロジェクト一覧

### 訪問看護 (Nursing) - 8プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [訪問看護_書類OCR](./projects/nursing/Appsheet_訪問看護_書類OCR/) | 文書OCR・分類 | ✅ | 🟢 Active |
| [訪問看護_書類仕分け](./projects/nursing/Appsheet_訪問看護_書類仕分け/) | 自動仕分け | ✅ | 🟢 Active |
| [訪問看護_通常記録](./projects/nursing/Appsheet_訪問看護_通常記録/) | 音声→記録生成 | ✅ | 🟢 Active |
| [訪問看護_報告書](./projects/nursing/Appsheet_訪問看護_報告書/) | 報告書生成 | ✅ | 🟢 Active |
| [訪問看護_計画書問題点](./projects/nursing/Appsheet_訪問看護_計画書問題点/) | 問題点抽出 | ✅ | 🟢 Active |
| [訪問看護_計画書問題点_評価](./projects/nursing/Appsheet_訪問看護_計画書問題点_評価/) | 評価生成 | ✅ | 🟢 Active |
| [訪問看護_訪問者自動](./projects/nursing/Appsheet_訪問看護_訪問者自動/) | 訪問者割り当て | - | 🟢 Active |
| [訪問看護_定期スケジュール](./projects/nursing/Appsheet_訪問看護_定期スケジュール/) | スケジュール管理 | - | 🟢 Active |

### 営業 (Sales) - 3プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [営業_音声記録](./projects/sales/Appsheet_営業_音声記録/) | 音声記録処理 | ✅ | 🟢 Active |
| [営業レポート](./projects/sales/Appsheet_営業レポート/) | レポート分析 | ✅ | 🟢 Active |
| [営業_ファイルID取得](./projects/sales/Appsheet_営業_ファイルID取得/) | ファイル管理 | - | 🟢 Active |

### 通話 (Calls) - 5プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [通話_要約生成](./projects/calls/Appsheet_通話_要約生成/) | 通話要約 | ✅ | 🟢 Active |
| [通話_質疑応答](./projects/calls/Appsheet_通話_質疑応答/) | Q&A生成 | ✅ | 🟢 Active |
| [通話_スレッド投稿](./projects/calls/Appsheet_通話_スレッド投稿/) | Google Chat投稿 | - | 🟢 Active |
| [通話_イベント・タスク作成](./projects/calls/Appsheet_通話_イベント・タスク作成/) | Calendar/Tasks連携 | - | 🟢 Active |
| [通話_ファイルID取得](./projects/calls/Appsheet_通話_ファイルID取得/) | ファイル管理 | - | 🟢 Active |

### クライアント管理 (Clients) - 6プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [利用者_基本情報上書き](./projects/clients/Appsheet_利用者_基本情報上書き/) | 基本情報抽出 | ✅ | 🟢 Active |
| [利用者_質疑応答](./projects/clients/Appsheet_利用者_質疑応答/) | Q&A処理 | ✅ | 🟢 Active |
| [利用者_フェースシート](./projects/clients/Appsheet_利用者_フェースシート/) | フェースシート作成 | ✅ | 🟢 Active |
| [利用者_反映](./projects/clients/Appsheet_利用者_反映/) | 依頼情報反映 | ✅ | 🟢 Active |
| [利用者_家族情報作成](./projects/clients/Appsheet_利用者_家族情報作成/) | 家族情報抽出 | ✅ | 🟢 Active |
| [名刺取り込み](./projects/clients/Appsheet_名刺取り込み/) | 名刺OCR | ✅ | 🟢 Active |

### 共通機能 (Common) - 6プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [ALL_スレッド更新](./projects/common/Appsheet_ALL_スレッド更新/) | Chat更新 | ✅ | 🟢 Active |
| [ALL_スレッド投稿](./projects/common/Appsheet_ALL_スレッド投稿/) | Chat投稿 | - | 🟢 Active |
| [ALL_Event](./projects/common/Appsheet_ALL_Event/) | イベント処理 | - | 🟢 Active |
| [ALL_ファイルID](./projects/common/AppSheet_ALL_ファイルID/) | ファイル管理 | - | 🟢 Active |
| [All_ファイル検索＋ID挿入](./projects/common/Appsheet_All_ファイル検索＋ID挿入/) | ファイル検索 | - | 🟢 Active |
| [AppSheetSecureConnector](./projects/common/AppSheetSecureConnector/) | セキュア接続 | - | 🟢 Active |

### 自動化 (Automation) - 2プロジェクト

| プロジェクト | 機能 | Vertex AI | 状態 |
|------------|------|-----------|------|
| [レシート](./projects/automation/Automation_レシート/) | レシート処理 | ✅ | 🟢 Active |
| [請求書データ](./projects/automation/Automation_請求書データ/) | 請求書データ抽出 | - | 🟢 Active |

**合計**: 30プロジェクト

---

## 🛠️ 技術スタック

### コア技術

- **Google Apps Script (GAS)** - サーバーレス実行環境
- **AppSheet** - ノーコードアプリプラットフォーム
- **Vertex AI (Gemini 2.5)** - AI/ML処理
- **Google Cloud Platform** - インフラストラクチャ

### 使用API

| API | 用途 | プロジェクト数 |
|-----|------|--------------|
| Vertex AI API | AI処理 | 18 |
| Cloud Storage API | ファイル管理 | 8 |
| Google Drive API | ドキュメント管理 | 25 |
| Google Sheets API | データ管理 | 20 |
| Google Chat API | 通知・連携 | 5 |
| Gmail API | メール送信 | 3 |
| Calendar API | イベント管理 | 2 |
| Tasks API | タスク管理 | 1 |

### AIモデル

- **gemini-2.5-pro** - 複雑な推論・長文処理
- **gemini-2.5-flash** - 高速処理・簡易タスク

---

## 📚 ドキュメント

### 開発者向け

- [アーキテクチャ概要](./docs/architecture/) - システム設計
- [開発ガイド](./docs/development/) - 開発手順
- [API リファレンス](./docs/api-reference/) - API仕様

### 運用・管理

- [Vertex AI 移行ガイド](./docs/migration/GEMINI_API_ABOLITION.md) - Google AI Studio API廃止対応
- [セキュリティ監査レポート](./docs/security/) - セキュリティ状況
- [共通モジュール](./shared/modules/) - 再利用可能なコード

---

## 🔐 セキュリティ

### 認証・認可

- **OAuth 2.0** - すべてのAPI認証
- **サービスアカウント** - `gas-project@macro-shadow-458705-v8.iam.gserviceaccount.com`
- **ドメインワイド委任** - Google Workspace API用

### 権限管理

サービスアカウントには最小権限の原則を適用：
- `roles/aiplatform.user` - Vertex AI実行権限
- `roles/storage.objectAdmin` - Cloud Storage管理権限
- ~~`roles/owner`~~ - **削除済み（2025-10-18）**

### 重要な変更履歴

**2025-10-18: Google AI Studio API 完全廃止**
- ✅ 全18プロジェクトをVertex AIに移行
- ✅ APIキー認証を完全削除
- ✅ OAuth2認証に統一
- ✅ API呼び出し: 200,431/日 → <100/日 (-99.95%)

詳細: [GEMINI_API_ABOLITION.md](./docs/migration/GEMINI_API_ABOLITION.md)

---

## 🚀 クイックスタート

### 前提条件

- Google Cloud Platform アカウント
- GCP プロジェクト: `macro-shadow-458705-v8`
- clasp CLI インストール済み
- Node.js 14+

### セットアップ

```bash
# リポジトリをクローン
cd /Users/t.asai/code/appsheet-gas-automation/gas_projects

# 特定のプロジェクトにログイン
cd projects/nursing/Appsheet_訪問看護_通常記録
clasp login

# コードをプッシュ
clasp push

# ブラウザで開く
clasp open
```

### 環境変数

GCP プロジェクト設定:
```bash
GCP_PROJECT_ID=macro-shadow-458705-v8
GCP_LOCATION=us-central1
```

---

## 📊 プロジェクト統計

| 項目 | 数値 |
|------|------|
| **総プロジェクト数** | 30 |
| **Vertex AI 使用** | 18プロジェクト (60%) |
| **有効化API数** | 18個 |
| **サービスアカウント数** | 1個 |
| **API呼び出し/日** | <100 (-99.95%削減) |
| **セキュリティスコア** | 🟢 良好 |

---

## 🤝 貢献・サポート

### 開発チーム

**組織**: Fractal Group
**担当**: t.asai@fractal-group.co.jp

### 開発ルール

1. ✅ **Vertex AI のみ使用** - Google AI Studio API は禁止
2. ✅ **OAuth2 認証** - APIキー認証は禁止
3. ✅ **最小権限の原則** - 必要最小限の権限のみ
4. ✅ **コードレビュー** - すべての変更はレビュー必須
5. ✅ **ドキュメント更新** - コード変更時は文書も更新

---

## 📄 ライセンス

© 2025 Fractal Group. All rights reserved.

---

**最終更新**: 2025-10-18
**バージョン**: 2.0.0
**ステータス**: 🟢 Production Ready
