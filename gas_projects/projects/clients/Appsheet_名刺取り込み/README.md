# Appsheet_名刺取り込み

**Script ID:** 1mwwFgGKKmFDw25xskQ_uRM8cTGNoEZYOqbJe1w6rlvru76vD02YG97Po

**Created:** 2025-07-24T06:00:17.976Z

**Modified:** 2025-10-23 (v2.0 リファクタリング完了)

**Version:** 2.0.0

## 概要

Google DriveとAppSheetを連携した名刺自動取り込みシステム。Vertex AI (Gemini 2.5 Flash Lite)による名刺OCR処理、重複チェック、AppSheet自動登録機能を提供します。

## 主な機能

- ✅ **名刺OCR処理**: Vertex AI Gemini 2.5 Flash Liteで高精度文字認識
- ✅ **表裏自動判定**: 氏名の有無で表裏を自動入れ替え
- ✅ **重複検出**: 氏名+カナで既存連絡先をチェック
- ✅ **組織比較**: AI判定で同一組織かを識別
- ✅ **コスト管理**: APIトークン使用量とコストを自動記録
- ✅ **アーカイブ機能**: 重複ファイルを削除せず保管
- ✅ **詳細ログ**: 処理の全ステップを記録

## システム構成

### スクリプトファイル (scripts/)

| ファイル | 役割 |
|---------|------|
| `config.gs` | 全設定値の一元管理 |
| `webhook.gs` | メイン処理・名刺ペアリング |
| `ocr_service.gs` | Vertex AI OCR処理 |
| `appsheet_service.gs` | AppSheet連携・CRUD操作 |
| `drive_service.gs` | Google Drive操作 |
| `AutomationLogger.gs` | 実行ログ・コスト計算 |
| `CommonWebhook.gs` | 共通Webhook機能 |
| `AppSheetConnector.gs` | AppSheet API接続 |
| `test_functions.gs` | テスト・デバッグ関数 |

### 連携スプレッドシート

| 名称 | ID | 用途 |
|------|-----|------|
| **GAS実行ログ** | 16UHnMlSUlnUy-67gbwuvjeeU73AwDomqzJwGi6L4rVA | 実行履歴・コスト記録 |
| **関係機関_置換SS** | 1ctSjcAlu9VSloPT9S9hsTyTd7yCw5XvNtF7-URyBeKo | 組織名マスタ |
| **関係機関シート** | 1A7rQhQODlBxqkm1pHR1ckrOa5dQZy9sxEUmB5C9xE6U | 連絡先データ |

### Google Driveフォルダー

| 名称 | ID | 用途 |
|------|-----|------|
| **名刺** | 1eOzeBli1FcusgKL6MEyhnZQUoDca-RLd | アップロード先（ソース） |
| **名刺_格納** | 1c2fguK-hSuF_zgSFkAk9MTgPo1wcboiB | 処理済み移動先 |
| **archives** | 17kpk5HXOS9iKCpxjxWqSXxiZiK4FHRz_ | 重複・エラーファイル保管 |

## 技術スタック

- **OCR**: Vertex AI - Gemini 2.5 Flash Lite
- **認証**: OAuth2 (cloud-platform scope)
- **実行環境**: Google Apps Script V8
- **API**: AppSheet API, Google Drive API v3
- **ログ管理**: Google Spreadsheet

## コスト管理

### 価格設定 (2025年10月時点)

| モデル | 入力トークン | 出力トークン |
|--------|-------------|-------------|
| gemini-2.5-flash-lite | $0.0375/1M | $0.15/1M |

### コスト記録

実行ログスプレッドシートに自動記録:
- API呼び出し回数
- 入力/出力トークン数
- 総コスト (USD)
- 処理時間

## セットアップ

### 1. OAuth2承認

```javascript
// GASエディターで実行
testOAuth2Authorization()
```

詳細は [OAUTH2_GUIDE.md](./OAUTH2_GUIDE.md) を参照

### 2. デプロイ

```bash
cd gas_projects/projects/clients/Appsheet_名刺取り込み
clasp push --force
```

### 3. テスト実行

```javascript
// 1枚の名刺でテスト
testSingleBusinessCard()

// 全名刺処理
processAllBusinessCards()
```

## 処理フロー

詳細は [FLOW.md](./FLOW.md) を参照

## 仕様書

詳細は [SPECIFICATIONS.md](./SPECIFICATIONS.md) を参照

## リファクタリング履歴

v2.0.0の変更内容は [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) を参照

## サポート

- **開発者**: Fractal Group
- **最終更新**: 2025-10-23