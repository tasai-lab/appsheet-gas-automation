# Appsheet_利用者_反映

**Script ID:** 1GiQ4nt4Rm-TZTqMpVaGArH2GiBme3vW5rAKNzbZaeqWv_DB-Z6hJ93ia

**Created:** 2025-07-30T02:03:49.344Z

**Modified:** 2025-10-21

**Owners:**

## 概要

依頼情報から利用者（クライアント）の基本情報をVertex AI（Gemini 2.5 Pro）で抽出し、AppSheetの利用者テーブルに新規登録するGASプロジェクトです。
依頼メモや添付資料を解析して、利用者の氏名、生年月日、性別、電話番号、要介護度などを自動的に抽出します。

## 主な機能

### コア機能

- ✅ **利用者ID自動採番**: AppSheetから既存利用者数を取得し、連番で新しいIDを生成（CL-00001形式）
- ✅ **AI情報抽出**: Vertex AI Gemini 2.5 Proで依頼メモ・添付資料から利用者情報を抽出
- ✅ **年号変換**: 和暦から西暦への自動変換（昭和6年 → 1931年）
- ✅ **年齢自動計算**: 生年月日から現在の年齢を自動算出
- ✅ **依頼ステータス更新**: 処理完了後、元の依頼を「反映済み」に自動更新
- ✅ **エラー記録**: 処理失敗時は依頼テーブルにエラー詳細を記録

### Vertex AI統合

- **モデル**: Gemini 2.5 Pro
- **認証**: OAuth2（`ScriptApp.getOAuthToken()`）
- **プロンプト**: 医療事務スタッフロールで高精度抽出
- **JSON構造化レスポンス**: 利用者情報を定義されたスキーマで取得
- **添付資料対応**: Drive上のファイル（画像・PDF）をbase64エンコードして解析

## Structure

### スクリプトファイル構成

#### メイン処理
- [コード.gs](./scripts/コード.gs): メインロジック（Webhook受信・AI抽出・AppSheet更新）
- [config.gs](./scripts/config.gs): 設定管理（AppSheet認証情報・Vertex AI設定）

#### 共通モジュール
- [logger.gs](./scripts/logger.gs): 一元化された実行ログ記録
- [duplication_prevention.gs](./scripts/duplication_prevention.gs): 重複防止機能
- [gemini_client.gs](./scripts/gemini_client.gs): Vertex AIクライアント（共通モジュール）
- [script_properties_manager.gs](./scripts/script_properties_manager.gs): ScriptPropertiesのクリーンアップ

#### レガシー
- [utils_duplicationPrevention.gs](./scripts/utils_duplicationPrevention.gs): 旧重複防止実装（非推奨）

### その他
- `appsscript.json`: プロジェクトマニフェスト
- `project_metadata.json`: プロジェクトメタデータ
- [FLOW.md](./FLOW.md): フロー図（Mermaid）
- [SPECIFICATIONS.md](./SPECIFICATIONS.md): 詳細仕様書
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md): 移行ガイド

## Referenced Spreadsheets

- **GAS実行ログ** (ID: 15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE)

## 処理フロー

### Webhook処理

1. **Webhook受信**: AppSheetからPOSTリクエスト受信
2. **重複チェック**: リクエストIDでの重複防止
3. **ID採番**: 既存利用者数 + 1で新しいClientIDを生成
4. **AI抽出**: Vertex AIで依頼メモ・添付資料から利用者情報を抽出
5. **利用者作成**: AppSheetのClientsテーブルに新規レコード追加
6. **ステータス更新**: 元の依頼レコードを「反映済み」に更新
7. **ログ記録**: 実行結果を集中ログスプレッドシートに記録

### 直接実行（テスト用）

GASエディタから `processRequestDirect()` 関数を実行することで、Webhookを使わずにテストが可能です。

## 抽出する情報

Vertex AIで以下の情報を自動抽出します：

| 項目 | 説明 | 例 |
|------|------|-----|
| last_name | 姓 | 山田 |
| first_name | 名 | 太郎 |
| last_name_kana | セイ（カタカナ） | ヤマダ |
| first_name_kana | メイ（カタカナ） | タロウ |
| gender | 性別 | 男性 / 女性 / その他 |
| birth_date | 生年月日（西暦） | 1931/02/01 |
| birth_date_nengo | 年号 | 昭和 |
| birth_date_nengo_year | 年号の年数 | 6 |
| age | 年齢（自動計算） | 94 |
| is_welfare_recipient | 生活保護受給 | true / false |
| care_level_name | 要介護度 | 要介護３ |
| phone1 | 電話番号1 | 090-1234-5678 |
| phone1_destination | 電話番号1の持ち主 | 本人 |
| phone2 | 電話番号2 | 03-9876-5432 |
| phone2_destination | 電話番号2の持ち主 | 長女 |
| special_notes | 特記事項 | アレルギー、ADLなど |

## 設定

### AppSheet API設定（[config.gs](./scripts/config.gs:5-27)）

```javascript
const REQUESTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const REQUESTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';
const CLIENTS_APP_ID = 'f40c4b11-b140-4e31-a60c-600f3c9637c8';
const CLIENTS_APP_ACCESS_KEY = 'V2-s6fif-zteYn-AGhoC-EhNLX-NNwgP-nHXAr-hHGZp-XxyPY';

const REQUESTS_TABLE_NAME = 'Client_Requests';
const CLIENTS_TABLE_NAME = 'Clients';
const DOCUMENTS_TABLE_NAME = 'Client_Documents';
```

### Vertex AI設定（[config.gs](./scripts/config.gs:29-32)）

```javascript
const GCP_PROJECT_ID = 'macro-shadow-458705-v8';
const GCP_LOCATION = 'us-central1';
const VERTEX_AI_MODEL = 'gemini-2.5-pro';
```

## テスト

### テスト関数

GASエディタで以下の関数を直接実行してテストできます：

```javascript
// 標準テスト（paramsオブジェクト渡し）
function testProcessRequest()

// 直接実行テスト（個別引数渡し）
function testProcessRequestDirect()
```

### テストデータ例

```javascript
testProcessRequestDirect(
  'CR-TEST001',  // requestId
  '山田太郎様、昭和30年5月10日生まれ、男性、要介護3、電話: 090-1234-5678（本人）、生活保護受給中',  // clientInfoTemp
  '新規利用者の登録依頼',  // requestReason
  null,  // documentFileId
  'STF-001',  // staffId
  'フラクタル訪問看護ステーション'  // providerOffice
);
```

## エラーハンドリング

### エラー時の動作

1. **必須パラメータ不足**: エラーを投げて処理中断
2. **Vertex AIエラー**: エラーログ記録 + 依頼テーブルにエラー詳細記録
3. **AppSheet APIエラー**: エラーログ記録 + 依頼テーブルにエラー詳細記録

### エラーログ記録先

- 実行ログスプレッドシート（15Z_GT4-pDAnjDpd8vkX3B9FgYlQIQwdUF1QIEj7bVnE）
- 依頼テーブルの `error_details` カラム

## デプロイ

```bash
# 統合デプロイスクリプトを使用（推奨）
python deploy_unified.py Appsheet_利用者_反映 "v##: 説明"
```

詳細は [DEPLOY_GUIDE.md](../../../DEPLOY_GUIDE.md) を参照してください。

## 注意事項

### API使用

- **Vertex AI**: OAuth2認証を使用（Google AI Studio APIは廃止）
- **AppSheet API**: ApplicationAccessKeyによる認証

### 制限事項

- **実行時間**: GAS Webhookの6分制限
- **ファイルサイズ**: base64エンコード時のメモリ制限に注意
- **同時実行**: 重複防止機能で制御

### セキュリティ

- APIキーはコード内にハードコード（本番環境ではScript Propertiesへの移行を推奨）
- OAuth2トークンは自動取得（`ScriptApp.getOAuthToken()`）

## トラブルシューティング

### よくある問題

1. **Vertex AI認証エラー**
   - `appsscript.json`に`https://www.googleapis.com/auth/cloud-platform`スコープが設定されているか確認
   - GCPプロジェクトでVertex AI APIが有効化されているか確認

2. **年齢計算がnull**
   - `birth_date`が正しい形式（YYYY/MM/DD）で抽出されているか確認
   - ログで抽出されたJSONを確認

3. **AppSheet API 400エラー**
   - テーブル名・カラム名がAppSheetと一致しているか確認
   - APIキーが有効か確認

## 関連ドキュメント

- [FLOW.md](./FLOW.md) - フロー図（Mermaid）
- [SPECIFICATIONS.md](./SPECIFICATIONS.md) - 詳細仕様書
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - 移行ガイド
- [CLAUDE.md](../../../CLAUDE.md) - プロジェクト全体のガイド
