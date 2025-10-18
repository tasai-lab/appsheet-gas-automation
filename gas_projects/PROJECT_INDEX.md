# プロジェクト索引 (Project Index)

**最終更新**: 2025-10-18
**総プロジェクト数**: 30

---

## 📊 カテゴリ別サマリー

| カテゴリ | プロジェクト数 | Vertex AI使用 | パス |
|---------|--------------|--------------|------|
| [訪問看護](#訪問看護-nursing) | 8 | 6/8 (75%) | `projects/nursing/` |
| [営業](#営業-sales) | 3 | 2/3 (67%) | `projects/sales/` |
| [通話](#通話-calls) | 5 | 2/5 (40%) | `projects/calls/` |
| [クライアント管理](#クライアント管理-clients) | 6 | 5/6 (83%) | `projects/clients/` |
| [共通機能](#共通機能-common) | 6 | 1/6 (17%) | `projects/common/` |
| [自動化](#自動化-automation) | 2 | 1/2 (50%) | `projects/automation/` |
| **合計** | **30** | **17/30 (57%)** | - |

---

## 訪問看護 (Nursing)

### 🔵 Vertex AI使用プロジェクト (6)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | 訪問看護_書類OCR | PDF/画像OCR・分類 | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_書類OCR/) |
| 2 | 訪問看護_書類仕分け | 自動文書仕分け (2783行) | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_書類仕分け/) |
| 3 | 訪問看護_通常記録 | 音声→看護記録変換 | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_通常記録/) |
| 4 | 訪問看護_報告書 | 報告書自動生成 | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_報告書/) |
| 5 | 訪問看護_計画書問題点 | 問題点抽出 | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_計画書問題点/) |
| 6 | 訪問看護_計画書問題点_評価 | 評価文生成 (50文字以内) | gemini-2.5-pro | [📁](./projects/nursing/Appsheet_訪問看護_計画書問題点_評価/) |

### ⚪ 非AI プロジェクト (2)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 7 | 訪問看護_訪問者自動 | 訪問者割り当て | [📁](./projects/nursing/Appsheet_訪問看護_訪問者自動/) |
| 8 | 訪問看護_定期スケジュール | スケジュール管理 | [📁](./projects/nursing/Appsheet_訪問看護_定期スケジュール/) |

---

## 営業 (Sales)

### 🔵 Vertex AI使用プロジェクト (2)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | 営業_音声記録 | 音声記録処理 | gemini-2.5-pro | [📁](./projects/sales/Appsheet_営業_音声記録/) |
| 2 | 営業レポート | レポート分析・要約 | gemini-2.5-pro | [📁](./projects/sales/Appsheet_営業レポート/) |

### ⚪ 非AI プロジェクト (1)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 3 | 営業_ファイルID取得 | ファイル管理 | [📁](./projects/sales/Appsheet_営業_ファイルID取得/) |

---

## 通話 (Calls)

### 🔵 Vertex AI使用プロジェクト (2)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | 通話_要約生成 | 通話内容要約 | gemini-2.5-pro | [📁](./projects/calls/Appsheet_通話_要約生成/) |
| 2 | 通話_質疑応答 | Q&A自動生成 | gemini-2.5-pro/flash | [📁](./projects/calls/Appsheet_通話_質疑応答/) |

### ⚪ 非AI プロジェクト (3)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 3 | 通話_スレッド投稿 | Google Chat投稿 | [📁](./projects/calls/Appsheet_通話_スレッド投稿/) |
| 4 | 通話_イベント・タスク作成 | Calendar/Tasks連携 | [📁](./projects/calls/Appsheet_通話_イベント・タスク作成/) |
| 5 | 通話_ファイルID取得 | ファイル管理 | [📁](./projects/calls/Appsheet_通話_ファイルID取得/) |

---

## クライアント管理 (Clients)

### 🔵 Vertex AI使用プロジェクト (5)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | 利用者_基本情報上書き | OCR→基本情報抽出 | gemini-2.5-pro | [📁](./projects/clients/Appsheet_利用者_基本情報上書き/) |
| 2 | 利用者_質疑応答 | Q&A処理・要約 | gemini-2.5-pro | [📁](./projects/clients/Appsheet_利用者_質疑応答/) |
| 3 | 利用者_フェースシート | フェースシート生成 | gemini-2.5-pro | [📁](./projects/clients/Appsheet_利用者_フェースシート/) |
| 4 | 利用者_反映 | 依頼情報→利用者情報 | gemini-2.5-pro | [📁](./projects/clients/Appsheet_利用者_反映/) |
| 5 | 利用者_家族情報作成 | OCR→家族情報抽出 | gemini-2.5-pro | [📁](./projects/clients/Appsheet_利用者_家族情報作成/) |
| 6 | 名刺取り込み | 名刺OCR・事業所判定 | gemini-2.5-pro/flash | [📁](./projects/clients/Appsheet_名刺取り込み/) |

### ⚪ 非AI プロジェクト (1)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 7 | 関係機関_作成 | 関係機関登録 | [📁](./projects/clients/Appsheet_関係機関_作成/) |

---

## 共通機能 (Common)

### 🔵 Vertex AI使用プロジェクト (1)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | ALL_スレッド更新 | Chat更新・変更点要約 | gemini-2.5-flash | [📁](./projects/common/Appsheet_ALL_スレッド更新/) |

### ⚪ 非AI プロジェクト (5)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 2 | ALL_スレッド投稿 | Google Chat投稿 | [📁](./projects/common/Appsheet_ALL_スレッド投稿/) |
| 3 | ALL_Event | イベント処理 | [📁](./projects/common/Appsheet_ALL_Event/) |
| 4 | ALL_ファイルID | ファイル管理 | [📁](./projects/common/AppSheet_ALL_ファイルID/) |
| 5 | All_ファイル検索＋ID挿入 | ファイル検索・ID挿入 | [📁](./projects/common/Appsheet_All_ファイル検索＋ID挿入/) |
| 6 | AppSheetSecureConnector | セキュア接続 | [📁](./projects/common/AppSheetSecureConnector/) |

---

## 自動化 (Automation)

### 🔵 Vertex AI使用プロジェクト (1)

| # | プロジェクト名 | 主な機能 | モデル | パス |
|---|-------------|---------|--------|------|
| 1 | レシート | レシート処理 (2.0→2.5更新済) | gemini-2.5-flash | [📁](./projects/automation/Automation_レシート/) |

### ⚪ 非AI プロジェクト (1)

| # | プロジェクト名 | 主な機能 | パス |
|---|-------------|---------|------|
| 2 | 請求書データ | 請求書データ抽出 | [📁](./projects/automation/Automation_請求書データ/) |

---

## 🎯 特殊プロジェクト

### 📝 詳細ドキュメント付き

以下のプロジェクトには開発ログ (`CLAUDE.md`) が含まれています:

| プロジェクト | CLAUDE.md | 内容 |
|------------|-----------|------|
| 訪問看護_書類OCR | ✅ | Google AI削除、Vertex AI移行の詳細 |
| 訪問看護_通常記録 | ✅ | リトライループ削除、API制限実装の詳細 |

### 🔧 大規模ファイル

| プロジェクト | ファイル | 行数 | 備考 |
|------------|---------|------|------|
| 訪問看護_書類仕分け | main.gs | 2783行 | 最大規模のファイル |
| レシート | main.gs | 800+行 | 複雑なOCR処理 |

---

## 🔍 検索ヘルパー

### 機能別

- **OCR処理**: 書類OCR, 書類仕分け, 基本情報上書き, 名刺取り込み, レシート
- **音声処理**: 通常記録, 音声記録, 要約生成
- **文書生成**: 報告書, 計画書問題点, 計画書問題点_評価
- **Q&A処理**: 利用者_質疑応答, 通話_質疑応答
- **Google Chat**: スレッド更新, スレッド投稿
- **Calendar/Tasks**: イベント・タスク作成

### モデル別

- **gemini-2.5-pro**: 15プロジェクト (複雑な推論・長文処理)
- **gemini-2.5-flash**: 2プロジェクト (高速処理)
- **非AI**: 13プロジェクト (ワークフロー・連携)

---

## 📊 統計サマリー

### プロジェクト規模

| 指標 | 値 |
|------|-----|
| 総プロジェクト数 | 30 |
| Vertex AI使用 | 17 (57%) |
| 平均ファイル数/プロジェクト | ~5-10 |
| 最大コード行数 | 2783行 (書類仕分け) |
| 総コード行数 | ~15,000行 (推定) |

### 技術スタック

| 技術 | 使用プロジェクト数 |
|------|-----------------|
| Vertex AI API | 17 |
| AppSheet API | 30 |
| Google Drive API | ~25 |
| Google Sheets API | ~20 |
| Cloud Storage API | ~8 |
| Google Chat API | ~5 |
| Calendar/Tasks API | ~3 |

---

## 🚀 クイックアクセス

### よく使うプロジェクト

```bash
# 訪問看護 - 通常記録
cd projects/nursing/Appsheet_訪問看護_通常記録

# 営業レポート
cd projects/sales/Appsheet_営業レポート

# レシート処理
cd projects/automation/Automation_レシート
```

### 共通リソース

```bash
# 共通モジュール
cd shared/modules/common

# ドキュメント
cd docs/
```

---

## 📝 メンテナンス情報

**最終全体監査**: 2025-10-18
**次回監査予定**: 2025-11 (1ヶ月後)

**重要なマイルストーン**:
- ✅ 2025-10-18: Vertex AI完全移行完了 (18プロジェクト)
- ✅ 2025-10-18: フォルダー構造プロフェッショナル化
- ✅ 2025-10-18: サービスアカウント最適化

---

**作成**: Claude Code
**メンテナ**: Fractal Group 開発チーム
