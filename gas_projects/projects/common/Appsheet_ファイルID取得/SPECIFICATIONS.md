# Appsheet_ファイルID取得 - 技術仕様書

## 概要

ファイルパス（相対パス）からGoogle DriveのファイルIDとURLを取得するGAS Webhookサービス。共有ドライブ完全対応。

## システムアーキテクチャ

### コンポーネント構成

```
┌─────────────────────────────────────────────┐
│          AppSheet / 外部システム             │
└─────────────────────────────────────────────┘
                     │
                     ▼ POST Request
┌─────────────────────────────────────────────┐
│         main.gs: doPost()                   │
│         - リクエスト受信                     │
│         - CommonWebhook経由で処理            │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      CommonWebhook.gs                       │
│      - リクエストパース                      │
│      - エラーハンドリング                    │
│      - レスポンス生成                        │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      main.gs: processRequest()              │
│      - パラメータ検証                        │
│      - 単一/複数ファイル判定                 │
│      - FileIdUtilitiesへ処理委譲            │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      FileIdUtilities.gs                     │
│      - ファイルパス解析                      │
│      - フォルダー階層の探索                  │
│      - ファイル検索                          │
│      - 共有ドライブ対応                      │
└─────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│      Google Drive API                       │
│      - DriveApp（標準）                     │
│      - Drive API v3（共有ドライブ）         │
└─────────────────────────────────────────────┘
```

## API仕様

### エンドポイント

**URL:** デプロイされたWeb Appの公開URL
**Method:** POST
**Content-Type:** application/json

### リクエストパラメータ

#### 単一ファイル検索

```json
{
  "baseFolderId": "1ABC123...",
  "filePath": "2025年/請求書/invoice.pdf"
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| baseFolderId | String | ✅ | 検索の起点となるフォルダーID（共有ドライブ内のフォルダーIDを推奨） |
| filePath | String | ✅ | 起点フォルダーからの相対ファイルパス（フォルダー区切りは `/`） |

#### 複数ファイル検索

```json
{
  "baseFolderId": "1ABC123...",
  "filePath": [
    "2025年/請求書/invoice1.pdf",
    "2025年/領収書/receipt1.pdf"
  ]
}
```

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| baseFolderId | String | ✅ | 検索の起点となるフォルダーID |
| filePath | Array<String> | ✅ | ファイルパスの配列 |

### レスポンスフォーマット

#### 成功時（単一ファイル）

```json
{
  "status": "success",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "data": {
    "success": true,
    "mode": "single",
    "filePath": "2025年/請求書/invoice.pdf",
    "fileId": "1XYZ789...",
    "fileUrl": "https://drive.google.com/file/d/1XYZ789.../view",
    "timestamp": "2025-10-21T12:34:56.789Z"
  }
}
```

#### 成功時（複数ファイル）

```json
{
  "status": "success",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "data": {
    "success": true,
    "mode": "multiple",
    "totalCount": 2,
    "successCount": 2,
    "errorCount": 0,
    "results": [
      {
        "path": "2025年/請求書/invoice1.pdf",
        "id": "1XYZ789...",
        "url": "https://drive.google.com/file/d/..."
      },
      {
        "path": "2025年/領収書/receipt1.pdf",
        "id": "1ABC456...",
        "url": "https://drive.google.com/file/d/..."
      }
    ],
    "timestamp": "2025-10-21T12:34:56.789Z"
  }
}
```

#### エラー時

```json
{
  "status": "error",
  "timestamp": "2025-10-21T12:34:56.789Z",
  "error": {
    "message": "ファイルが見つかりません: \"invoice.pdf\"",
    "stack": "Error: ...",
    "params": {
      "baseFolderId": "1ABC123...",
      "filePath": "2025年/請求書/invoice.pdf"
    }
  }
}
```

## データモデル

### FileResult（単一ファイル）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| success | Boolean | 処理成功フラグ（true固定） |
| mode | String | "single"固定 |
| filePath | String | 検索したファイルパス |
| fileId | String | Google DriveのファイルID |
| fileUrl | String | ファイルのURL |
| timestamp | String | 処理時刻（ISO 8601形式） |

### MultipleFileResult（複数ファイル）

| フィールド | 型 | 説明 |
|-----------|-----|------|
| success | Boolean | 処理成功フラグ（true固定） |
| mode | String | "multiple"固定 |
| totalCount | Number | 合計ファイル数 |
| successCount | Number | 成功件数 |
| errorCount | Number | エラー件数 |
| results | Array<FileItem> | 結果配列 |
| timestamp | String | 処理時刻（ISO 8601形式） |

### FileItem

| フィールド | 型 | 説明 |
|-----------|-----|------|
| path | String | ファイルパス |
| id | String \| null | ファイルID（エラー時はnull） |
| url | String \| null | ファイルURL（エラー時はnull） |
| error | String? | エラーメッセージ（成功時は存在しない） |

## エラーハンドリング

### エラータイプ

1. **パラメータエラー**
   - エラーメッセージ例: `"必須パラメータが不足しています: baseFolderId"`
   - 原因: 必須パラメータ未指定または空文字列
   - HTTPステータス: 200（GASはHTTP 200で返却）

2. **フォルダー未検出**
   - エラーメッセージ例: `"フォルダーが見つかりません: \"2025年\""`
   - 原因: 指定されたパスのフォルダーが存在しない
   - 対処: フォルダー名とパス階層を確認

3. **ファイル未検出**
   - エラーメッセージ例: `"ファイルが見つかりません: \"invoice.pdf\""`
   - 原因: 指定されたファイル名が存在しない
   - 対処: ファイル名（拡張子含む）を確認

4. **権限エラー**
   - エラーメッセージ例: `"フォルダーが見つかりません: 1ABC123..."`
   - 原因: スクリプトに起点フォルダーへのアクセス権限がない
   - 対処: GASにDriveへのアクセス権限を付与、または共有設定を確認

5. **JSONパースエラー**
   - エラーメッセージ例: `"JSONパースエラー: Unexpected token"`
   - 原因: リクエストボディが不正なJSON形式
   - 対処: JSON構文を確認

### 部分的成功（複数ファイル処理）

複数ファイル処理では、一部のファイルがエラーでも処理を継続します。

```json
{
  "success": true,
  "mode": "multiple",
  "totalCount": 3,
  "successCount": 2,
  "errorCount": 1,
  "results": [
    {
      "path": "2025年/請求書/invoice1.pdf",
      "id": "1XYZ789...",
      "url": "https://drive.google.com/..."
    },
    {
      "path": "2025年/請求書/invoice2.pdf",
      "id": null,
      "url": null,
      "error": "ファイルが見つかりません: \"invoice2.pdf\""
    },
    {
      "path": "2025年/領収書/receipt1.pdf",
      "id": "1ABC456...",
      "url": "https://drive.google.com/..."
    }
  ]
}
```

## 共有ドライブ対応

### 標準ドライブと共有ドライブの違い

1. **アクセス方法**
   - 標準ドライブ: `DriveApp.getFolderById()` で取得可能
   - 共有ドライブ: `Drive API v3` の `supportsAllDrives: true` が必要な場合がある

2. **実装戦略**
   - まず `DriveApp.getFolderById()` を試行（パフォーマンス優先）
   - 失敗した場合、`Drive API v3` を使用（フォールバック）

3. **必要な設定**
   - GASエディタ → サービス → "Drive API v3" を追加
   - OAuth Scope: `https://www.googleapis.com/auth/drive`

### 共有ドライブの制限事項

- 共有ドライブのルートフォルダーIDは直接使用できない場合がある
- 起点フォルダーとして共有ドライブ内のサブフォルダーIDを使用することを推奨

## パフォーマンス

### 実行時間

- **単一ファイル検索**: 約1〜3秒
  - フォルダー階層が深い場合: +1秒/階層
- **複数ファイル検索**: 約1〜3秒 × ファイル数
  - 同一フォルダー内の複数ファイル: 約2〜5秒（キャッシュ効果）

### 制限事項

1. **GAS実行時間**: 最大6分（Web Appの場合）
2. **Drive API クォータ**:
   - ユーザーあたりのクエリ数: 1,000/100秒
   - プロジェクトあたりのクエリ数: 20,000/100秒
3. **同時実行**: GASの同時実行数制限に依存（通常30〜50並列）

### 最適化のヒント

1. **baseFolderIdの選定**: なるべく検索対象に近いフォルダーIDを指定
2. **パスの正規化**: 余計な空白や重複スラッシュを除去
3. **バッチ処理**: 複数ファイル検索機能を活用（1リクエストで複数取得）

## セキュリティ

### アクセス制御

1. **GASの実行権限**
   - スクリプト実行ユーザー: スクリプトのオーナー
   - Driveアクセス権限: オーナーのDrive権限に依存

2. **OAuth Scope**
   ```json
   {
     "oauthScopes": [
       "https://www.googleapis.com/auth/script.external_request",
       "https://www.googleapis.com/auth/drive",
       "https://www.googleapis.com/auth/userinfo.email"
     ]
   }
   ```

3. **Web App設定**
   - デプロイ時の実行権限: "自分"または"アクセスしているユーザー"
   - アクセスできるユーザー: "組織内のユーザー"または"全員"

### データ保護

- パラメータ検証により、不正なフォルダーIDやパスを拒否
- エラーメッセージに機密情報を含めない（フォルダー名とパスのみ）
- ログ出力は最小限（デバッグ情報は本番環境で無効化推奨）

## テスト

### 手動テスト（GASエディタ）

#### 単一ファイルテスト

```javascript
function testGetSingleFile() {
  const result = getFileIdAndUrlDirect(
    "1ABC123...",  // 実際のフォルダーID
    "2025年/請求書/invoice.pdf"
  );
  console.log(result);
}
```

#### 複数ファイルテスト

```javascript
function testGetMultipleFiles() {
  const result = getFileIdAndUrlDirect(
    "1ABC123...",
    ["2025年/請求書/invoice1.pdf", "2025年/領収書/receipt1.pdf"]
  );
  console.log(result);
}
```

### Webhook統合テスト

#### cURLでのテスト

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" \
  -H "Content-Type: application/json" \
  -d '{
    "baseFolderId": "1ABC123...",
    "filePath": "2025年/請求書/invoice.pdf"
  }'
```

#### AppSheetでのテスト

1. AppSheetでWebhookアクションを作成
2. URLにデプロイURLを設定
3. Body Templateにリクエストパラメータを設定
4. テストボタンでWebhook実行
5. レスポンスを確認

## デプロイ

### 初回デプロイ

```bash
cd "gas_projects/projects/common/Appsheet_ファイルID取得"

# .clasp.jsonが存在しない場合
clasp create --type standalone --title "Appsheet_ファイルID取得"

# スクリプトをプッシュ
clasp push --force

# Web Appとしてデプロイ
clasp deploy --description "初回デプロイ"
```

### 更新デプロイ

```bash
# 統合デプロイツールを使用（推奨）
cd gas_projects
python deploy_unified.py "Appsheet_ファイルID取得" "v2: バグ修正"

# または手動でデプロイ
cd "projects/common/Appsheet_ファイルID取得"
clasp push --force
clasp deploy --description "v2: バグ修正"
```

## トラブルシューティング

### よくある問題

#### 問題1: "フォルダーが見つかりません"

**原因:**
- 起点フォルダーIDが間違っている
- スクリプトに権限がない

**対処:**
1. フォルダーIDを確認（Google DriveのURL末尾）
2. スクリプトオーナーがフォルダーにアクセスできることを確認
3. 共有ドライブの場合、Drive API v3が有効か確認

#### 問題2: "ファイルが見つかりません"

**原因:**
- ファイルパスが間違っている
- ファイル名の大文字小文字が異なる
- 拡張子が含まれていない

**対処:**
1. ファイルパスを確認（フォルダー区切りは `/`）
2. ファイル名を正確に確認（拡張子含む）
3. Google Driveで実際のパスを確認

#### 問題3: "JSONパースエラー"

**原因:**
- リクエストボディが不正なJSON形式
- 文字エンコーディングの問題

**対処:**
1. JSONバリデーターでリクエストボディを確認
2. Content-Typeヘッダーが `application/json` であることを確認
3. 特殊文字を適切にエスケープ

## バージョン履歴

### v1.0.0 (2025-10-21)
- 初回リリース
- 単一ファイル検索機能
- 複数ファイル検索機能
- 共有ドライブ対応
- エラーハンドリング実装
- CommonWebhook統合

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [FLOW.md](./FLOW.md) - 処理フロー図
- [共通モジュール仕様](../../../common_modules/README.md)

## 技術スタック

- **言語**: JavaScript（Google Apps Script）
- **ランタイム**: V8 Engine
- **API**:
  - DriveApp（標準）
  - Drive API v3（共有ドライブ対応）
- **デプロイ**: Clasp
- **バージョン管理**: Git

## ライセンス

Fractal Group Internal Use Only
