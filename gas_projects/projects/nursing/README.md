# 訪問看護プロジェクト (Nursing Projects)

**カテゴリ**: 訪問看護支援システム
**プロジェクト数**: 8
**最終更新**: 2025-10-18

---

## 📋 概要

訪問看護業務を効率化するための自動化プロジェクト群です。文書OCR、音声記録の自動変換、計画書・報告書の生成など、看護記録業務の大幅な効率化を実現します。

---

## 🗂️ プロジェクト一覧

### 1. 書類OCR (Document OCR)
**ディレクトリ**: `Appsheet_訪問看護_書類OCR/`

**機能**:
- PDF・画像文書のOCR処理
- AI による文書分類
- 構造化データ抽出

**技術**:
- Vertex AI (Gemini 2.5-pro)
- Document AI
- Cloud Storage

**ステータス**: 🟢 Production

---

### 2. 書類仕分け (Document Classification)
**ディレクトリ**: `Appsheet_訪問看護_書類仕分け/`

**機能**:
- 文書の自動分類
- カテゴリ別振り分け
- メタデータ抽出

**技術**:
- Vertex AI (Gemini 2.5-pro)
- 2783行の大規模処理ロジック

**ステータス**: 🟢 Production

---

### 3. 通常記録 (Standard Records)
**ディレクトリ**: `Appsheet_訪問看護_通常記録/`

**機能**:
- 音声ファイルから看護記録を自動生成
- 通常記録・精神科記録の両対応
- バイタル、S情報、O情報の構造化

**技術**:
- Vertex AI (Gemini 2.5-pro)
- Cloud Storage (音声ファイル)
- インラインデータ処理

**ステータス**: 🟢 Production

**特記事項**:
- リトライループ完全削除済み
- API呼び出し制限機能実装
- 詳細: [CLAUDE.md](./Appsheet_訪問看護_通常記録/CLAUDE.md)

---

### 4. 報告書 (Reports)
**ディレクトリ**: `Appsheet_訪問看護_報告書/`

**機能**:
- 訪問看護報告書の自動生成
- テンプレートベース文書作成
- 複数パターン対応

**技術**:
- Vertex AI (Gemini 2.5-pro)
- GeminiClient モジュール

**ステータス**: 🟢 Production

---

### 5. 計画書問題点 (Care Plan Issues)
**ディレクトリ**: `Appsheet_訪問看護_計画書問題点/`

**機能**:
- 看護計画から問題点を抽出
- 構造化された問題リスト生成
- 優先順位付け

**技術**:
- Vertex AI (Gemini 2.5-pro)
- JSON構造化出力

**ステータス**: 🟢 Production

---

### 6. 計画書問題点_評価 (Issue Evaluation)
**ディレクトリ**: `Appsheet_訪問看護_計画書問題点_評価/`

**機能**:
- 看護計画の評価文自動生成
- 記録との比較分析
- 50文字以内の簡潔な評価

**技術**:
- Vertex AI (Gemini 2.5-pro)
- 常体表現の医療記録様式

**ステータス**: 🟢 Production

---

### 7. 訪問者自動 (Auto Visitor Assignment)
**ディレクトリ**: `Appsheet_訪問看護_訪問者自動/`

**機能**:
- 訪問者の自動割り当て
- スケジュール最適化
- 負荷分散

**技術**:
- AppSheet Automation
- Google Sheets連携

**ステータス**: 🟢 Production

---

### 8. 定期スケジュール (Regular Schedule)
**ディレクトリ**: `Appsheet_訪問看護_定期スケジュール/`

**機能**:
- 定期訪問スケジュール管理
- 自動リマインダー
- カレンダー連携

**技術**:
- AppSheet Automation
- Google Calendar API

**ステータス**: 🟢 Production

---

## 📊 技術統計

| 項目 | 数値 |
|------|------|
| **Vertex AI 使用** | 6/8プロジェクト (75%) |
| **主要モデル** | gemini-2.5-pro |
| **平均コード行数** | ~500行 |
| **最大ファイル** | 2783行 (書類仕分け) |

---

## 🔄 ワークフロー例

### 音声記録 → 看護記録

```
1. 訪問看護師が音声で記録
   ↓
2. AppSheet から GAS Webhook 呼び出し
   ↓
3. Cloud Storage に音声アップロード
   ↓
4. Vertex AI (Gemini 2.5-pro) で音声→テキスト変換
   ↓
5. 構造化された看護記録を生成
   ↓
6. AppSheet の Care_Records テーブルに登録
```

### 書類OCR → データ抽出

```
1. PDF/画像をアップロード
   ↓
2. Document AI で OCR処理
   ↓
3. Vertex AI で文書分類
   ↓
4. 必要情報を構造化データとして抽出
   ↓
5. AppSheet テーブルに自動登録
```

---

## 🚀 セットアップ

### 共通設定

すべてのプロジェクトで必要:

```javascript
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const APPSHEET_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const APPSHEET_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';
```

### OAuth Scopes

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly"
  ]
}
```

---

## 📚 関連ドキュメント

- [Vertex AI 移行ガイド](../../docs/migration/GEMINI_API_ABOLITION.md)
- [通常記録 開発ログ](./Appsheet_訪問看護_通常記録/CLAUDE.md)
- [書類OCR 開発ログ](./Appsheet_訪問看護_書類OCR/CLAUDE.md)

---

## 🔐 セキュリティ

- ✅ OAuth2 認証のみ使用
- ✅ Vertex AI API 専用
- ✅ APIキー認証は完全廃止
- ✅ 最小権限の原則

---

**最終更新**: 2025-10-18
**メンテナ**: Fractal Group 開発チーム
