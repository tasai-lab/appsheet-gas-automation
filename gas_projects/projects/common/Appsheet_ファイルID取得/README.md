# Appsheet_ファイルID取得

**Script ID:** 1CqYclGpvImmPpp7j9xdE7NzXDd6_VxDj4OMD4z_Cb40LP1LEORn3z9HA

ファイルパスからGoogle DriveのファイルIDとURLを取得する汎用サービス

## 概要

AppSheetまたは直接実行から、ファイルパス（相対パス）を指定してファイルIDとURLを取得します。共有ドライブ完全対応。

## 主な機能

- ✅ ファイルパスからID・URL取得
- ✅ 単一ファイル・複数ファイル対応
- ✅ 共有ドライブ完全対応
- ✅ エラーハンドリング
- ✅ JSON形式のレスポンス

## 使用方法

### 1. AppSheetからWebhook呼び出し

**リクエストボディ (単一ファイル):**
```json
{
  "baseFolderId": "1ABC123...",
  "filePath": "2025年/請求書/invoice.pdf"
}
```

**リクエストボディ (複数ファイル):**
```json
{
  "baseFolderId": "1ABC123...",
  "filePath": [
    "2025年/請求書/invoice1.pdf",
    "2025年/領収書/receipt1.pdf"
  ]
}
```

**レスポンス (単一ファイル):**
```json
{
  "success": true,
  "mode": "single",
  "filePath": "2025年/請求書/invoice.pdf",
  "fileId": "1XYZ789...",
  "fileUrl": "https://drive.google.com/file/d/1XYZ789.../view",
  "timestamp": "2025-10-21T12:34:56.789Z"
}
```

**レスポンス (複数ファイル):**
```json
{
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
```

### 2. GASエディタから直接実行

```javascript
// 単一ファイル
const result = getFileIdAndUrlDirect(
  "1ABC123...",  // 起点フォルダーID
  "2025年/請求書/invoice.pdf"  // 相対パス
);

console.log(result.fileId);   // "1XYZ789..."
console.log(result.fileUrl);  // "https://drive.google.com/..."

// 複数ファイル
const result = getFileIdAndUrlDirect(
  "1ABC123...",
  ["2025年/請求書/invoice1.pdf", "2025年/領収書/receipt1.pdf"]
);

console.log(result.results);  // [{path, id, url}, ...]
```

## パラメータ

### baseFolderId (必須)
- **型:** String
- **説明:** 検索の起点となるフォルダーID
- **例:** `"1ABC123..."`
- **注意:** 共有ドライブ内のフォルダーIDを推奨

### filePath (必須)
- **型:** String または Array<String>
- **説明:** 起点フォルダーからの相対ファイルパス
- **例 (単一):** `"2025年/請求書/invoice.pdf"`
- **例 (複数):** `["2025年/請求書/invoice1.pdf", "2025年/領収書/receipt1.pdf"]`
- **注意:** フォルダー区切り文字は `/` を使用

## レスポンス

### 成功時 (単一ファイル)

| フィールド | 型 | 説明 |
|----------|-----|------|
| success | Boolean | true固定 |
| mode | String | "single"固定 |
| filePath | String | 検索したファイルパス |
| fileId | String | ファイルID |
| fileUrl | String | ファイルURL |
| timestamp | String | 処理時刻 (ISO 8601) |

### 成功時 (複数ファイル)

| フィールド | 型 | 説明 |
|----------|-----|------|
| success | Boolean | true固定 |
| mode | String | "multiple"固定 |
| totalCount | Number | 合計ファイル数 |
| successCount | Number | 成功件数 |
| errorCount | Number | エラー件数 |
| results | Array | 結果配列 [{path, id, url, error?}] |
| timestamp | String | 処理時刻 (ISO 8601) |

### エラー時

| フィールド | 型 | 説明 |
|----------|-----|------|
| success | Boolean | false固定 |
| error | String | エラーメッセージ |
| timestamp | String | 処理時刻 (ISO 8601) |

## エラーハンドリング

### よくあるエラー

1. **フォルダーが見つかりません**
   - 原因: 指定されたパスのフォルダーが存在しない
   - 対処: フォルダー名とパスを確認

2. **ファイルが見つかりません**
   - 原因: 指定されたファイル名が存在しない
   - 対処: ファイル名（拡張子含む）を確認

3. **必須パラメータが不足**
   - 原因: baseFolderIdまたはfilePathが未指定
   - 対処: 両方のパラメータを指定

## 技術仕様

### 依存モジュール
- `FileIdUtilities.gs` - ファイル検索機能
- `CommonWebhook.gs` - Webhook処理共通化

### 必要なAPI
- **Drive API v3** (共有ドライブ対応のため)
  - GASエディタ → サービス → Drive API v3を追加

### ファイル構成
```
Appsheet_ファイルID取得/
├── README.md
├── .clasp.json
└── scripts/
    ├── main.gs                  # メインロジック
    ├── FileIdUtilities.gs       # ファイル検索機能
    ├── CommonWebhook.gs         # Webhook共通処理
    └── appsscript.json          # プロジェクト設定
```

## デプロイ

```bash
cd "gas_projects/projects/common/Appsheet_ファイルID取得"

# 初回デプロイ（スクリプトID未設定の場合）
clasp create --type standalone --title "Appsheet_ファイルID取得"

# 通常デプロイ
clasp push --force
```

## バージョン履歴

### v1.0.0 (2025-10-21)
- 初回リリース
- 単一・複数ファイル対応
- 共有ドライブ対応
- エラーハンドリング実装

## 関連ドキュメント

- [共通モジュール README](../../../common_modules/README.md)
- [FileIdUtilities.gs 仕様](../../../common_modules/FileIdUtilities.gs)

## ライセンス

Fractal Group Internal Use Only
